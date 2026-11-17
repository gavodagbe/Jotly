import Dexie, { type Table } from "dexie";
import type { Note, NoteInput, NotePatch } from "../api/note-types";
import type { Reminder, ReminderCreateInput, ReminderPatch } from "../api/reminder-types";
import type { Task, TaskPatch, TaskMutationInput } from "../api/task-types";

export type TimeEntryRecord = { date: string; taskId: string; fraction: number };

/** Entities that support create / update / delete through the outbox. */
export type SyncEntity = "task" | "reminder" | "note";

export type OutboxOp =
  | { kind: "task.create"; entityId: string; payload: TaskMutationInput }
  | { kind: "task.update"; entityId: string; payload: TaskPatch; baseUpdatedAt?: string }
  | { kind: "task.delete"; entityId: string }
  | { kind: "timeEntry.put"; entityId: string; payload: { date: string; fraction: number } }
  | { kind: "reminder.create"; entityId: string; payload: ReminderCreateInput }
  | { kind: "reminder.update"; entityId: string; payload: ReminderPatch; baseUpdatedAt?: string }
  | { kind: "reminder.complete"; entityId: string }
  | { kind: "reminder.cancel"; entityId: string }
  | { kind: "note.create"; entityId: string; payload: NoteInput }
  | { kind: "note.update"; entityId: string; payload: NotePatch; baseUpdatedAt?: string }
  | { kind: "note.delete"; entityId: string };

export type OutboxKind = OutboxOp["kind"];

export type OutboxEntry = OutboxOp & {
  seq?: number;
  /** Local time (ms) of the most recent user edit merged into this entry. */
  editedAt: number;
  attempts: number;
};

export type SyncIssue = {
  kind: "conflict" | "rejected";
  entityId: string;
  opKind: OutboxKind;
  message: string;
  at: number;
};

export type MetaRecord = { key: string; value: unknown };

export class JotlyOfflineDb extends Dexie {
  tasks!: Table<Task, string>;
  timeEntries!: Table<TimeEntryRecord, [string, string]>;
  reminders!: Table<Reminder, string>;
  notes!: Table<Note, string>;
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
    // Phase 3: reminders and notes. Existing data and pending changes are kept.
    this.version(2).stores({
      reminders: "id, remindAt, status",
      notes: "id, targetDate",
    });
  }
}

/** One database per account, so pending changes survive a re-login. */
export function openOfflineDb(userId: string): JotlyOfflineDb {
  return new JotlyOfflineDb(`jotly-offline-${userId}`);
}

export function entityOf(kind: OutboxKind): SyncEntity | "timeEntry" {
  return kind.split(".")[0] as SyncEntity | "timeEntry";
}

export function actionOf(kind: OutboxKind): string {
  return kind.split(".")[1];
}

export async function readMeta<T>(db: JotlyOfflineDb, key: string, fallback: T): Promise<T> {
  const record = await db.meta.get(key);
  return record ? (record.value as T) : fallback;
}

export async function writeMeta(db: JotlyOfflineDb, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
