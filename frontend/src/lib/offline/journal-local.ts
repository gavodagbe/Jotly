/** Local copy of journal entries (affirmation, bilan, weekly, monthly), keyed by period. */
import type { JotlyOfflineDb, JournalKind } from "./db";
import { getPendingEntityIds } from "./local-store";

const pad = (value: number) => String(value).padStart(2, "0");

export const journalKeys = {
  affirmation: (date: string) => `affirmation:${date}`,
  bilan: (date: string) => `bilan:${date}`,
  weekly: (year: number, week: number) => `weekly:${year}-${pad(week)}`,
  monthly: (year: number, month: number) => `monthly:${year}-${pad(month)}`,
};

/** ISO-8601 week of a YYYY-MM-DD date (weeks start on Monday; week 1 contains January 4th). */
export function getIsoWeek(date: string): { year: number; week: number } {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const isoYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: isoYear, week };
}

function kindOf(key: string): JournalKind {
  return key.split(":")[0] as JournalKind;
}

/** Store what the server returned, unless a local save for that entry is still waiting. */
export async function storeServerJournal(db: JotlyOfflineDb, key: string, data: { updatedAt?: string } | null): Promise<void> {
  if ((await getPendingEntityIds(db)).has(key)) return;
  await db.journal.put({ key, kind: kindOf(key), data });
}

export async function getLocalJournal<T>(db: JotlyOfflineDb, key: string): Promise<{ found: boolean; data: T | null }> {
  const record = await db.journal.get(key);
  return { found: record !== undefined, data: (record?.data as T | null) ?? null };
}

export async function putLocalJournal(db: JotlyOfflineDb, key: string, data: { updatedAt?: string }): Promise<void> {
  await db.journal.put({ key, kind: kindOf(key), data });
}
