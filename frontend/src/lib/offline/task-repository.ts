/**
 * Task data access used by the app: same signatures as the former functions in
 * app-shell.tsx, but offline-aware.
 * - Reads: network when possible (stored locally), local database otherwise.
 * - Writes: direct when online with an empty outbox, otherwise applied locally
 *   and queued; the sync engine sends them when the network is back.
 */
import {
  deleteTask,
  fetchAllTasks,
  fetchTaskTimeEntries,
  fetchTasksByDate,
  isOfflineError,
  OfflineError,
  patchTask,
  postTask,
  putTaskTimeEntry,
} from "../api/tasks-api";
import type {
  Task,
  TaskListFilters,
  TaskMutationInput,
  TaskPatch,
  TaskStatus,
  TaskTimeEntriesPayload,
  TaskTimeEntrySavePayload,
} from "../api/task-types";
import {
  getLocalTasks,
  getLocalTasksByDate,
  getLocalTimeEntries,
  replaceTasksInRange,
  replaceTimeEntriesForDate,
  setLocalTimeEntry,
  upsertServerRecords,
} from "./local-store";
import { canWriteDirectly, queueLocally } from "./repository-helpers";
import { createClientId, getOfflineSession } from "./session";

const OFFLINE_EDIT_UNAVAILABLE = "This task is not available offline. Reconnect to edit it.";

function buildLocalTask(id: string, input: TaskMutationInput): Task {
  return {
    id,
    title: input.title,
    description: input.description,
    status: input.status,
    targetDate: input.targetDate,
    dueDate: input.dueDate,
    priority: input.priority,
    project: input.project,
    projectId: input.projectId ?? null,
    assignees: input.assignees,
    plannedTime: input.plannedTime,
    rolledFromTaskId: null,
    recurrenceSourceTaskId: null,
    recurrenceOccurrenceDate: null,
    calendarEventId: input.calendarEventId ?? null,
    autoCancelIfUntouched: input.autoCancelIfUntouched,
    createdAt: new Date().toISOString(),
  };
}

export async function loadTasksByDate(date: string, token: string, signal?: AbortSignal): Promise<Task[]> {
  const session = getOfflineSession();
  if (!session) {
    return fetchTasksByDate(date, token, signal);
  }
  try {
    const serverTasks = await fetchTasksByDate(date, token, signal);
    await replaceTasksInRange(session.db, date, date, serverTasks);
  } catch (error) {
    if (!isOfflineError(error)) throw error;
  }
  return getLocalTasksByDate(session.db, date);
}

export async function loadAllTasks(token: string, filters: TaskListFilters, signal?: AbortSignal): Promise<Task[]> {
  const session = getOfflineSession();
  if (!session) {
    return fetchAllTasks(token, filters, signal);
  }
  try {
    const serverTasks = await fetchAllTasks(token, filters, signal);
    await upsertServerRecords(session.db, session.db.tasks, serverTasks);
    return serverTasks;
  } catch (error) {
    if (!isOfflineError(error)) throw error;
    return getLocalTasks(session.db, filters);
  }
}

export async function createTask(input: TaskMutationInput, token: string): Promise<Task> {
  const session = getOfflineSession();
  if (!session) {
    return postTask(input, token);
  }
  const id = createClientId();
  if (await canWriteDirectly(session)) {
    try {
      const task = await postTask({ ...input, id }, token);
      await session.db.tasks.put(task);
      return task;
    } catch (error) {
      if (!isOfflineError(error)) throw error;
    }
  }
  const localTask = buildLocalTask(id, input);
  await session.db.tasks.put(localTask);
  await queueLocally(session, { kind: "task.create", entityId: id, payload: input });
  return localTask;
}

async function mutateTask(taskId: string, patch: TaskPatch, token: string, errorMessage: string): Promise<Task> {
  const session = getOfflineSession();
  if (!session) {
    return patchTask(taskId, patch, token, { errorMessage });
  }
  if (await canWriteDirectly(session)) {
    try {
      const task = await patchTask(taskId, patch, token, { errorMessage });
      await session.db.tasks.put(task);
      return task;
    } catch (error) {
      if (!isOfflineError(error)) throw error;
    }
  }
  const local = await session.db.tasks.get(taskId);
  if (!local) {
    throw new OfflineError(OFFLINE_EDIT_UNAVAILABLE);
  }
  // Keep the server version stamp: it is the base the queued change applies to.
  const updated: Task = { ...local, ...patch };
  await session.db.tasks.put(updated);
  await queueLocally(session, { kind: "task.update", entityId: taskId, payload: patch, baseUpdatedAt: local.updatedAt });
  return updated;
}

export function updateTask(taskId: string, input: TaskMutationInput, token: string): Promise<Task> {
  return mutateTask(taskId, input, token, "Unable to update task");
}

export function updateTaskStatus(taskId: string, status: TaskStatus, token: string): Promise<Task> {
  return mutateTask(taskId, { status }, token, "Unable to move task");
}

export function rescheduleTask(
  taskId: string,
  input: { targetDate: string; dueDate?: string },
  token: string
): Promise<Task> {
  return mutateTask(taskId, input, token, "Unable to reschedule task");
}

export async function deleteTaskById(taskId: string, token: string): Promise<void> {
  const session = getOfflineSession();
  if (!session) {
    return deleteTask(taskId, token);
  }
  if (await canWriteDirectly(session)) {
    try {
      await deleteTask(taskId, token);
      await session.db.tasks.delete(taskId);
      return;
    } catch (error) {
      if (!isOfflineError(error)) throw error;
    }
  }
  await session.db.tasks.delete(taskId);
  await queueLocally(session, { kind: "task.delete", entityId: taskId });
}

export async function loadTaskTimeEntries(
  date: string,
  token: string,
  signal?: AbortSignal
): Promise<TaskTimeEntriesPayload> {
  const session = getOfflineSession();
  if (!session) {
    return fetchTaskTimeEntries(date, token, signal);
  }
  try {
    const payload = await fetchTaskTimeEntries(date, token, signal);
    await replaceTimeEntriesForDate(session.db, date, payload.entries);
  } catch (error) {
    if (!isOfflineError(error)) throw error;
  }
  const entries = await getLocalTimeEntries(session.db, date);
  return {
    date,
    total: entries.reduce((total, entry) => total + entry.fraction, 0),
    entries: entries.map((entry) => ({ taskId: entry.taskId, fraction: entry.fraction })),
  };
}

export async function saveTaskTimeEntry(
  taskId: string,
  input: { date: string; fraction: number },
  token: string
): Promise<TaskTimeEntrySavePayload> {
  const session = getOfflineSession();
  if (!session) {
    return putTaskTimeEntry(taskId, input, token);
  }
  if (await canWriteDirectly(session)) {
    try {
      const result = await putTaskTimeEntry(taskId, input, token);
      await setLocalTimeEntry(session.db, { taskId, date: result.date, fraction: result.fraction });
      return result;
    } catch (error) {
      if (!isOfflineError(error)) throw error;
    }
  }
  const dayTotal = await setLocalTimeEntry(session.db, { taskId, ...input });
  await queueLocally(session, { kind: "timeEntry.put", entityId: taskId, payload: input });
  return { taskId, date: input.date, fraction: input.fraction, dayTotal };
}
