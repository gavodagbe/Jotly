import Dexie, { type Table } from "dexie";
import type { Note, NoteInput, NotePatch } from "../api/note-types";
import type { Reminder, ReminderCreateInput, ReminderPatch } from "../api/reminder-types";
import type { Task, TaskPatch, TaskMutationInput } from "../api/task-types";
import type { TaskComment } from "../api/comment-types";
import type { RoutineCompletion, RoutineInput, RoutineTemplate } from "../api/routine-types";

/** One journal entry (affirmation, bilan, weekly, monthly); `data` is null when none exists yet. */
export type JournalKind = "affirmation" | "bilan" | "weekly" | "monthly";
export type JournalRecord = { key: string; kind: JournalKind; data: { updatedAt?: string } | null };

export type TimeEntryRecord = { date: string; taskId: string; fraction: number };

/** Entities that support create / update / delete through the outbox. */
export type SyncEntity = "task" | "reminder" | "note" | "routine" | "comment";

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
  | { kind: "note.delete"; entityId: string }
  /** entityId is the journal key, e.g. "affirmation:2026-11-17" or "weekly:2026-47". */
  | { kind: "journal.put"; entityId: string; payload: Record<string, unknown>; baseUpdatedAt?: string }
  | { kind: "routine.create"; entityId: string; payload: RoutineInput }
  | { kind: "routine.update"; entityId: string; payload: Partial<RoutineInput>; baseUpdatedAt?: string }
  | { kind: "routine.delete"; entityId: string }
  /** entityId is the routine id, so deleting a routine created offline also drops its ticks. */
  | { kind: "routineCompletion.put"; entityId: string; payload: { targetDate: string; isCompleted: boolean } }
  | { kind: "comment.create"; entityId: string; payload: { taskId: string; body: string } }
  | { kind: "comment.delete"; entityId: string; payload: { taskId: string } };

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
  journal!: Table<JournalRecord, string>;
  routines!: Table<RoutineTemplate, string>;
  routineCompletions!: Table<RoutineCompletion, [string, string]>;
  comments!: Table<TaskComment, string>;
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
    // Phase 4: journal entries, routines (+ ticks) and task comments.
    this.version(3).stores({
      journal: "key, kind",
      routines: "id, sortOrder",
      routineCompletions: "[routineId+targetDate], targetDate",
      comments: "id, taskId",
    });
  }
}

/** One database per account, so pending changes survive a re-login. */
export function openOfflineDb(userId: string): JotlyOfflineDb {
  return new JotlyOfflineDb(`jotly-offline-${userId}`);
}

export function entityOf(kind: OutboxKind): SyncEntity | "timeEntry" | "journal" | "routineCompletion" {
  return kind.split(".")[0] as SyncEntity | "timeEntry" | "journal" | "routineCompletion";
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
