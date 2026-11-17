/**
 * Per-entity sync handlers: how each queued change is sent, which local table it
 * belongs to, and how the offline copy is refreshed from the server.
 */
import type { Table } from "dexie";
import { deleteNote, fetchNotes, patchNote, postNote } from "../api/notes-api";
import type { Note } from "../api/note-types";
import { fetchAllReminders, postReminder, postReminderAction, putReminder } from "../api/reminders-api";
import { deleteTask, fetchAllTasks, patchTask, postTask, putTaskTimeEntry } from "../api/tasks-api";
import type { JotlyOfflineDb, OutboxEntry, SyncEntity } from "./db";
import { replaceMatching, replaceTasksInRange } from "./local-store";
import { ignoreNotFound, sendUpdateResolvingConflict, storeServerRecord } from "./sync-helpers";

export type SyncWindow = { from: string; to: string };

export function tableFor(db: JotlyOfflineDb, entity: SyncEntity): Table<{ id: string; title?: string | null }, string> {
  const tables = { task: db.tasks, reminder: db.reminders, note: db.notes };
  return tables[entity] as unknown as Table<{ id: string; title?: string | null }, string>;
}

export async function sendEntry(db: JotlyOfflineDb, entry: OutboxEntry, token: string): Promise<void> {
  switch (entry.kind) {
    case "task.create":
      return storeServerRecord(db, db.tasks, entry, await postTask({ ...entry.payload, id: entry.entityId }, token));
    case "task.update":
      return sendUpdateResolvingConflict({
        db,
        table: db.tasks,
        entry,
        send: (base) => patchTask(entry.entityId, entry.payload, token, { baseUpdatedAt: base }),
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
        table: db.reminders,
        entry,
        send: (base) => putReminder(entry.entityId, entry.payload, token, base),
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
        table: db.notes,
        entry,
        send: (base) => patchNote(entry.entityId, entry.payload, token, base),
        label: noteLabel,
      });
    case "note.delete":
      return ignoreNotFound(() => deleteNote(entry.entityId, token));
  }
}

export function noteLabel(note: Note): string {
  const text = (note.title || note.body.replace(/<[^>]+>/g, " ")).trim();
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

/** UTC calendar day (YYYY-MM-DD) of a calendar event start, as the server filters notes by day. */
function eventDay(note: Note): string | null {
  return note.linkedCalendarEvent ? note.linkedCalendarEvent.startTime.slice(0, 10) : null;
}

export function isNoteOnDate(note: Note, date: string): boolean {
  return note.targetDate === date || eventDay(note) === date;
}

function isNoteInWindow(note: Note, window: SyncWindow): boolean {
  const day = note.targetDate ?? eventDay(note);
  return day === null || (day >= window.from && day <= window.to);
}

/** Refresh the offline copy of every entity from the server. */
export async function pullAll(db: JotlyOfflineDb, token: string, window: SyncWindow): Promise<void> {
  const tasks = await fetchAllTasks(token, { dateFrom: window.from, dateTo: window.to });
  await replaceTasksInRange(db, window.from, window.to, tasks);

  const reminders = await fetchAllReminders(token);
  await replaceMatching(db, db.reminders, () => true, reminders);

  const notes = await fetchNotes(token);
  await replaceMatching(db, db.notes, () => true, notes.filter((note) => isNoteInWindow(note, window)));
}
