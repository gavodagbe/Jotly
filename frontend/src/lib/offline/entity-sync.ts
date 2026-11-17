/**
 * Per-entity sync handlers: how each queued change is sent and which local table
 * receives the server copy. Downloads for offline use live in pull-window.ts.
 */
import type { Table } from "dexie";
import { deleteTaskCommentRequest, postTaskComment } from "../api/comments-api";
import { putDayAffirmation, putDayBilan, putMonthlyEntry, putWeeklyEntry } from "../api/journal-api";
import type { DayAffirmationInput, DayBilanMutationInput, MonthlyEntryInput, WeeklyEntryInput } from "../api/journal-types";
import { deleteNote, patchNote, postNote } from "../api/notes-api";
import type { Note } from "../api/note-types";
import { postReminder, postReminderAction, putReminder } from "../api/reminders-api";
import { deleteRoutine, patchRoutine, postRoutine, putRoutineCompletion } from "../api/routines-api";
import { deleteTask, patchTask, postTask, putTaskTimeEntry } from "../api/tasks-api";
import type { JotlyOfflineDb, JournalKind, OutboxEntry, SyncEntity } from "./db";
import { hasOtherPendingOps } from "./outbox";
import { ignoreNotFound, sendUpdateResolvingConflict, storeServerRecord } from "./sync-helpers";

type Titled = { id: string; title?: string | null };

export function tableFor(db: JotlyOfflineDb, entity: string): Table<Titled, string> | null {
  const tables: Partial<Record<SyncEntity, unknown>> = {
    task: db.tasks,
    reminder: db.reminders,
    note: db.notes,
    routine: db.routines,
    comment: db.comments,
  };
  return (tables[entity as SyncEntity] as Table<Titled, string> | undefined) ?? null;
}

export function journalKindOf(key: string): JournalKind {
  return key.split(":")[0] as JournalKind;
}

function putJournal(key: string, payload: Record<string, unknown>, token: string, base?: string) {
  switch (journalKindOf(key)) {
    case "affirmation":
      return putDayAffirmation(payload as DayAffirmationInput, token, base);
    case "bilan":
      return putDayBilan(payload as DayBilanMutationInput, token, base);
    case "weekly":
      return putWeeklyEntry(payload as WeeklyEntryInput, token, base);
    case "monthly":
      return putMonthlyEntry(payload as MonthlyEntryInput, token, base);
  }
}

async function storeJournal(db: JotlyOfflineDb, entry: OutboxEntry, data: { updatedAt?: string }): Promise<void> {
  const key = entry.entityId;
  if (await hasOtherPendingOps(db, key, entry.seq ?? -1)) {
    const local = await db.journal.get(key);
    const merged = local?.data ? { ...local.data, updatedAt: data.updatedAt } : data;
    await db.journal.put({ key, kind: journalKindOf(key), data: merged });
    return;
  }
  await db.journal.put({ key, kind: journalKindOf(key), data });
}

export function noteLabel(note: Note): string {
  const text = (note.title || note.body.replace(/<[^>]+>/g, " ")).trim();
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

export async function sendEntry(db: JotlyOfflineDb, entry: OutboxEntry, token: string): Promise<void> {
  switch (entry.kind) {
    case "task.create":
      return storeServerRecord(db, db.tasks, entry, await postTask({ ...entry.payload, id: entry.entityId }, token));
    case "task.update":
      return sendUpdateResolvingConflict({
        db,
        entry,
        send: (base) => patchTask(entry.entityId, entry.payload, token, { baseUpdatedAt: base }),
        store: (task) => storeServerRecord(db, db.tasks, entry, task),
        label: (task) => task.title,
      });
    case "task.delete":
      return ignoreNotFound(() => deleteTask(entry.entityId, token));
    case "timeEntry.put":
      await putTaskTimeEntry(entry.entityId, entry.payload, token);
      return;

    case "reminder.create":
      return storeServerRecord(db, db.reminders, entry, await postReminder({ ...entry.payload, id: entry.entityId }, token));
    case "reminder.update":
      return sendUpdateResolvingConflict({
        db,
        entry,
        send: (base) => putReminder(entry.entityId, entry.payload, token, base),
        store: (reminder) => storeServerRecord(db, db.reminders, entry, reminder),
        label: (reminder) => reminder.title,
      });
    case "reminder.complete":
    case "reminder.cancel": {
      const action = entry.kind === "reminder.complete" ? "complete" : "cancel";
      return storeServerRecord(db, db.reminders, entry, await postReminderAction(entry.entityId, action, token));
    }

    case "note.create":
      return storeServerRecord(db, db.notes, entry, await postNote({ ...entry.payload, id: entry.entityId }, token));
    case "note.update":
      return sendUpdateResolvingConflict({
        db,
        entry,
        send: (base) => patchNote(entry.entityId, entry.payload, token, base),
        store: (note) => storeServerRecord(db, db.notes, entry, note),
        label: noteLabel,
      });
    case "note.delete":
      return ignoreNotFound(() => deleteNote(entry.entityId, token));

    case "journal.put":
      return sendUpdateResolvingConflict<{ updatedAt?: string }>({
        db,
        entry,
        send: (base) => putJournal(entry.entityId, entry.payload, token, base),
        store: (data) => storeJournal(db, entry, data),
        label: () => `Journal (${entry.entityId})`,
      });

    case "routine.create":
      return storeServerRecord(db, db.routines, entry, await postRoutine({ ...entry.payload, id: entry.entityId }, token));
    case "routine.update":
      return sendUpdateResolvingConflict({
        db,
        entry,
        send: (base) => patchRoutine(entry.entityId, entry.payload, token, base),
        store: (routine) => storeServerRecord(db, db.routines, entry, routine),
        label: (routine) => routine.title,
      });
    case "routine.delete":
      return ignoreNotFound(() => deleteRoutine(entry.entityId, token));
    case "routineCompletion.put": {
      const completion = await putRoutineCompletion({ routineId: entry.entityId, ...entry.payload }, token);
      await db.routineCompletions.put(completion);
      return;
    }

    case "comment.create":
      return storeServerRecord(
        db,
        db.comments,
        entry,
        await postTaskComment(entry.payload.taskId, entry.payload.body, token, entry.entityId)
      );
    case "comment.delete":
      return ignoreNotFound(() => deleteTaskCommentRequest(entry.payload.taskId, entry.entityId, token));
  }
}
