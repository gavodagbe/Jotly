/**
 * Journal data access used by the app (same signatures as the former functions in
 * app-shell.tsx): day affirmation, day bilan, weekly and monthly entries.
 * Every entry is a "save the whole entry" call, so replays are harmless.
 */
import {
  fetchDayAffirmation,
  fetchDayBilan,
  fetchMonthlyEntry,
  fetchWeeklyEntry,
  putDayAffirmation,
  putDayBilan,
  putMonthlyEntry,
  putWeeklyEntry,
} from "../api/journal-api";
import type {
  DayAffirmation,
  DayAffirmationInput,
  DayBilan,
  DayBilanMutationInput,
  MonthlyEntry,
  MonthlyEntryInput,
  WeeklyEntry,
  WeeklyEntryInput,
} from "../api/journal-types";
import { getLocalJournal, journalKeys, putLocalJournal, storeServerJournal } from "./journal-local";
import { queueLocally, refreshFromServer, writeThrough } from "./repository-helpers";
import { getOfflineSession } from "./session";

type Versioned = { id: string; updatedAt: string };

/** Placeholder ids for entries first written offline; their updatedAt is not a server version. */
const LOCAL_ID_PREFIX = "local-";

async function loadEntry<T extends Versioned>(
  key: string,
  fetchFromServer: () => Promise<T | null>
): Promise<T | null> {
  const session = getOfflineSession();
  if (!session) return fetchFromServer();
  await refreshFromServer(async () => storeServerJournal(session.db, key, await fetchFromServer()));
  return (await getLocalJournal<T>(session.db, key)).data;
}

async function saveEntry<T extends Versioned>(options: {
  key: string;
  payload: Record<string, unknown>;
  token: string;
  send: (base?: string) => Promise<T>;
  buildLocal: (existing: T | null, now: string) => Omit<T, "id" | "createdAt" | "updatedAt">;
}): Promise<T> {
  const session = getOfflineSession();
  if (!session) return options.send();
  return writeThrough(
    session,
    async () => {
      const saved = await options.send();
      await putLocalJournal(session.db, options.key, saved);
      return saved;
    },
    async () => {
      const existing = (await getLocalJournal<T>(session.db, options.key)).data;
      const now = new Date().toISOString();
      const local = {
        id: existing?.id ?? `${LOCAL_ID_PREFIX}${options.key}`,
        createdAt: (existing as { createdAt?: string } | null)?.createdAt ?? now,
        updatedAt: existing?.updatedAt ?? now,
        ...options.buildLocal(existing, now),
      } as unknown as T;
      await putLocalJournal(session.db, options.key, local);
      const isServerVersion = existing !== null && !existing.id.startsWith(LOCAL_ID_PREFIX);
      await queueLocally(session, {
        kind: "journal.put",
        entityId: options.key,
        payload: options.payload,
        baseUpdatedAt: isServerVersion ? existing.updatedAt : undefined,
      });
      return local;
    }
  );
}

export function loadDayAffirmation(date: string, token: string, signal?: AbortSignal) {
  return loadEntry(journalKeys.affirmation(date), () => fetchDayAffirmation(date, token, signal));
}

export function upsertDayAffirmation(input: DayAffirmationInput, token: string): Promise<DayAffirmation> {
  return saveEntry<DayAffirmation>({
    key: journalKeys.affirmation(input.date),
    payload: input,
    token,
    send: (base) => putDayAffirmation(input, token, base),
    buildLocal: (existing, now) => ({
      targetDate: input.date,
      text: input.text,
      isCompleted: input.isCompleted,
      completedAt: input.isCompleted ? existing?.completedAt ?? now : null,
    }),
  });
}

export function loadDayBilan(date: string, token: string, signal?: AbortSignal) {
  return loadEntry(journalKeys.bilan(date), () => fetchDayBilan(date, token, signal));
}

export function upsertDayBilan(input: DayBilanMutationInput, token: string): Promise<DayBilan> {
  const { date, ...fields } = input;
  return saveEntry<DayBilan>({
    key: journalKeys.bilan(date),
    payload: input,
    token,
    send: (base) => putDayBilan(input, token, base),
    buildLocal: () => ({ targetDate: date, ...fields }),
  });
}

export function loadWeeklyEntry(year: number, week: number, token: string, signal?: AbortSignal) {
  return loadEntry(journalKeys.weekly(year, week), () => fetchWeeklyEntry(year, week, token, signal));
}

export function upsertWeeklyEntry(input: WeeklyEntryInput, token: string): Promise<WeeklyEntry> {
  return saveEntry<WeeklyEntry>({
    key: journalKeys.weekly(input.year, input.week),
    payload: input,
    token,
    send: (base) => putWeeklyEntry(input, token, base),
    buildLocal: (existing) => ({
      year: input.year,
      isoWeek: input.week,
      objective: input.objective !== undefined ? input.objective : existing?.objective ?? null,
      review: input.review !== undefined ? input.review : existing?.review ?? null,
    }),
  });
}

export function loadMonthlyEntry(year: number, month: number, token: string, signal?: AbortSignal) {
  return loadEntry(journalKeys.monthly(year, month), () => fetchMonthlyEntry(year, month, token, signal));
}

export function upsertMonthlyEntry(input: MonthlyEntryInput, token: string): Promise<MonthlyEntry> {
  return saveEntry<MonthlyEntry>({
    key: journalKeys.monthly(input.year, input.month),
    payload: input,
    token,
    send: (base) => putMonthlyEntry(input, token, base),
    buildLocal: (existing) => ({
      year: input.year,
      month: input.month,
      objective: input.objective !== undefined ? input.objective : existing?.objective ?? null,
      review: input.review !== undefined ? input.review : existing?.review ?? null,
    }),
  });
}
