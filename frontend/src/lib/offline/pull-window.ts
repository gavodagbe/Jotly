/**
 * Downloads used to fill the offline copy after each sync:
 * tasks in the window, all reminders, notes in the window, today's journal,
 * the current week / month entries and the current routine month.
 */
import { fetchDayAffirmation, fetchDayBilan, fetchMonthlyEntry, fetchWeeklyEntry } from "../api/journal-api";
import { fetchNotes } from "../api/notes-api";
import type { Note } from "../api/note-types";
import { fetchAllReminders } from "../api/reminders-api";
import { fetchAllTasks } from "../api/tasks-api";
import type { JotlyOfflineDb } from "./db";
import { replaceMatching, replaceTasksInRange } from "./local-store";
import { getIsoWeek, journalKeys, storeServerJournal } from "./journal-local";
import { loadAndStoreRoutineMonth } from "./routine-local";

export type SyncWindow = { from: string; to: string; today: string };

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

  const today = window.today;
  const [year, month] = today.split("-").map(Number);
  const week = getIsoWeek(today);
  await storeServerJournal(db, journalKeys.affirmation(today), await fetchDayAffirmation(today, token));
  await storeServerJournal(db, journalKeys.bilan(today), await fetchDayBilan(today, token));
  await storeServerJournal(db, journalKeys.weekly(week.year, week.week), await fetchWeeklyEntry(week.year, week.week, token));
  await storeServerJournal(db, journalKeys.monthly(year, month), await fetchMonthlyEntry(year, month, token));

  await loadAndStoreRoutineMonth(db, token, today.slice(0, 7));
}
