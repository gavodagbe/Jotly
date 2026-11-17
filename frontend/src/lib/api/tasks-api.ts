/**
 * Raw network calls for tasks (moved out of app-shell.tsx).
 * The offline layer (src/lib/offline/task-repository.ts) wraps these.
 */
import type {
  Task,
  TaskListFilters,
  TaskMutationInput,
  TaskPatch,
  TaskTimeEntriesPayload,
  TaskTimeEntrySavePayload,
} from "./task-types";
import { apiRequest as request, requireData, withBase } from "./http";

export { ApiError, isOfflineError, OfflineError } from "./http";

export async function fetchTasksByDate(date: string, token: string, signal?: AbortSignal): Promise<Task[]> {
  const data = await request<Task[]>(
    `/tasks?date=${encodeURIComponent(date)}`,
    { method: "GET", token, signal },
    "Unable to load tasks for this date"
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchAllTasks(token: string, filters: TaskListFilters, signal?: AbortSignal): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.project) params.set("project", filters.project);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await request<Task[]>(`/tasks/all${query}`, { method: "GET", token, signal }, "Unable to load tasks");
  return Array.isArray(data) ? data : [];
}

export async function postTask(input: TaskMutationInput & { id?: string }, token: string): Promise<Task> {
  const data = await request<Task>("/tasks", { method: "POST", token, body: input }, "Unable to create task");
  return requireData(data, "Unable to create task");
}

export async function patchTask(
  taskId: string,
  patch: TaskPatch,
  token: string,
  options: { baseUpdatedAt?: string; errorMessage?: string } = {}
): Promise<Task> {
  const message = options.errorMessage ?? "Unable to update task";
  const body = withBase(patch, options.baseUpdatedAt);
  const data = await request<Task>(`/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", token, body }, message);
  return requireData(data, message);
}

export async function deleteTask(taskId: string, token: string): Promise<void> {
  await request<Task>(`/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE", token }, "Unable to delete task");
}

export async function fetchTaskTimeEntries(
  date: string,
  token: string,
  signal?: AbortSignal
): Promise<TaskTimeEntriesPayload> {
  const data = await request<TaskTimeEntriesPayload>(
    `/tasks/time-entries?date=${encodeURIComponent(date)}`,
    { method: "GET", token, signal },
    "Unable to load imputed time"
  );
  return data ?? { date, total: 0, entries: [] };
}

export async function putTaskTimeEntry(
  taskId: string,
  input: { date: string; fraction: number },
  token: string
): Promise<TaskTimeEntrySavePayload> {
  const data = await request<TaskTimeEntrySavePayload>(
    `/tasks/${encodeURIComponent(taskId)}/time-entry`,
    { method: "PUT", token, body: input },
    "Unable to save imputed time"
  );
  return requireData(data, "Unable to save imputed time");
}
