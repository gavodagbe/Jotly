/**
 * Local database helpers: merging server data without overwriting pending local
 * changes, and local queries used while offline.
 */
import type { Task, TaskListFilters } from "../api/task-types";
import type { JotlyOfflineDb, TimeEntryRecord } from "./db";

export async function getPendingEntityIds(db: JotlyOfflineDb): Promise<Set<string>> {
  const entries = await db.outbox.toArray();
  return new Set(entries.map((entry) => entry.entityId));
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    const byDate = left.targetDate.localeCompare(right.targetDate);
    if (byDate !== 0) return byDate;
    return (left.createdAt ?? "￿").localeCompare(right.createdAt ?? "￿");
  });
}

/**
 * Replace the local copy of the tasks whose targetDate is in [from, to] with the
 * server list. Tasks with pending local changes are left untouched.
 */
export async function replaceTasksInRange(
  db: JotlyOfflineDb,
  from: string,
  to: string,
  serverTasks: Task[]
): Promise<void> {
  await db.transaction("rw", db.tasks, db.outbox, async () => {
    const pending = await getPendingEntityIds(db);
    const serverIds = new Set(serverTasks.map((task) => task.id));
    const localInRange = await db.tasks.where("targetDate").between(from, to, true, true).toArray();
    const staleIds = localInRange
      .filter((task) => !serverIds.has(task.id) && !pending.has(task.id))
      .map((task) => task.id);
    await db.tasks.bulkDelete(staleIds);
    await db.tasks.bulkPut(serverTasks.filter((task) => !pending.has(task.id)));
  });
}

/** Store server tasks (e.g. from a filtered list) without removing anything. */
export async function upsertServerTasks(db: JotlyOfflineDb, serverTasks: Task[]): Promise<void> {
  await db.transaction("rw", db.tasks, db.outbox, async () => {
    const pending = await getPendingEntityIds(db);
    await db.tasks.bulkPut(serverTasks.filter((task) => !pending.has(task.id)));
  });
}

export async function getLocalTasksByDate(db: JotlyOfflineDb, date: string): Promise<Task[]> {
  return sortTasks(await db.tasks.where("targetDate").equals(date).toArray());
}

export async function getLocalTasks(db: JotlyOfflineDb, filters: TaskListFilters): Promise<Task[]> {
  const all = await db.tasks.toArray();
  return sortTasks(
    all.filter((task) => {
      if (filters.dateFrom && task.targetDate < filters.dateFrom) return false;
      if (filters.dateTo && task.targetDate > filters.dateTo) return false;
      if (filters.status && filters.status !== "all" && task.status !== filters.status) return false;
      if (filters.project && task.project !== filters.project && task.projectId !== filters.project) return false;
      return true;
    })
  );
}

export async function replaceTimeEntriesForDate(
  db: JotlyOfflineDb,
  date: string,
  entries: Array<{ taskId: string; fraction: number }>
): Promise<void> {
  await db.transaction("rw", db.timeEntries, db.outbox, async () => {
    const pendingTaskIds = new Set(
      (await db.outbox.toArray())
        .filter((entry) => entry.kind === "timeEntry.put" && entry.payload.date === date)
        .map((entry) => entry.entityId)
    );
    const local = await db.timeEntries.where("date").equals(date).toArray();
    await db.timeEntries.bulkDelete(
      local.filter((entry) => !pendingTaskIds.has(entry.taskId)).map((entry) => [entry.date, entry.taskId] as [string, string])
    );
    await db.timeEntries.bulkPut(
      entries
        .filter((entry) => !pendingTaskIds.has(entry.taskId))
        .map((entry) => ({ date, taskId: entry.taskId, fraction: entry.fraction }))
    );
  });
}

export async function getLocalTimeEntries(db: JotlyOfflineDb, date: string): Promise<TimeEntryRecord[]> {
  return db.timeEntries.where("date").equals(date).toArray();
}

export async function setLocalTimeEntry(db: JotlyOfflineDb, record: TimeEntryRecord): Promise<number> {
  if (record.fraction === 0) {
    await db.timeEntries.delete([record.date, record.taskId]);
  } else {
    await db.timeEntries.put(record);
  }
  const dayEntries = await getLocalTimeEntries(db, record.date);
  return dayEntries.reduce((total, entry) => total + entry.fraction, 0);
}
