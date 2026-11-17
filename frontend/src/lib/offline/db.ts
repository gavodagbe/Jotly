import Dexie, { type Table } from "dexie";
import type { Task, TaskPatch, TaskMutationInput } from "../api/task-types";

export type TimeEntryRecord = { date: string; taskId: string; fraction: number };

export type OutboxOp =
  | { kind: "task.create"; entityId: string; payload: TaskMutationInput }
  | { kind: "task.update"; entityId: string; payload: TaskPatch; baseUpdatedAt?: string }
  | { kind: "task.delete"; entityId: string }
  | { kind: "timeEntry.put"; entityId: string; payload: { date: string; fraction: number } };

export type OutboxEntry = OutboxOp & {
  seq?: number;
  /** Local time (ms) of the most recent user edit merged into this entry. */
  editedAt: number;
  attempts: number;
};

export type SyncIssue = {
  kind: "conflict" | "rejected";
  entityId: string;
  opKind: OutboxOp["kind"];
  message: string;
  at: number;
};

export type MetaRecord = { key: string; value: unknown };

export class JotlyOfflineDb extends Dexie {
  tasks!: Table<Task, string>;
  timeEntries!: Table<TimeEntryRecord, [string, string]>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<MetaRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      tasks: "id, targetDate",
      timeEntries: "[date+taskId], date, taskId",
      outbox: "++seq, entityId",
      meta: "key",
    });
  }
}

/** One database per account, so pending changes survive a re-login. */
export function openOfflineDb(userId: string): JotlyOfflineDb {
  return new JotlyOfflineDb(`jotly-offline-${userId}`);
}

export async function readMeta<T>(db: JotlyOfflineDb, key: string, fallback: T): Promise<T> {
  const record = await db.meta.get(key);
  return record ? (record.value as T) : fallback;
}

export async function writeMeta(db: JotlyOfflineDb, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
