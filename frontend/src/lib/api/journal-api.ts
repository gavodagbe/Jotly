/** Raw network calls for the journal (affirmation, bilan, weekly, monthly), moved out of app-shell.tsx. */
import { apiRequest, requireData, withBase } from "./http";
import type {
  DayAffirmation,
  DayAffirmationInput,
  DayBilan,
  DayBilanMutationInput,
  MonthlyEntry,
  MonthlyEntryInput,
  WeeklyEntry,
  WeeklyEntryInput,
} from "./journal-types";

export async function fetchDayAffirmation(date: string, token: string, signal?: AbortSignal): Promise<DayAffirmation | null> {
  const params = new URLSearchParams({ date, _: `${Date.now()}` });
  const data = await apiRequest<DayAffirmation | null>(
    `/day-affirmation?${params.toString()}`,
    { method: "GET", token, signal },
    "Unable to load day affirmation"
  );
  return data ?? null;
}

export async function putDayAffirmation(input: DayAffirmationInput, token: string, baseUpdatedAt?: string): Promise<DayAffirmation> {
  const data = await apiRequest<DayAffirmation>(
    "/day-affirmation",
    { method: "PUT", token, body: withBase(input, baseUpdatedAt) },
    "Unable to save day affirmation"
  );
  return requireData(data, "Unable to save day affirmation");
}

export async function fetchDayBilan(date: string, token: string, signal?: AbortSignal): Promise<DayBilan | null> {
  const data = await apiRequest<DayBilan | null>(
    `/day-bilan?date=${encodeURIComponent(date)}`,
    { method: "GET", token, signal },
    "Unable to load day bilan"
  );
  return data ?? null;
}

export async function putDayBilan(input: DayBilanMutationInput, token: string, baseUpdatedAt?: string): Promise<DayBilan> {
  const data = await apiRequest<DayBilan>(
    "/day-bilan",
    { method: "PUT", token, body: withBase(input, baseUpdatedAt) },
    "Unable to save day bilan"
  );
  return requireData(data, "Unable to save day bilan");
}

export async function fetchWeeklyEntry(year: number, week: number, token: string, signal?: AbortSignal): Promise<WeeklyEntry | null> {
  const data = await apiRequest<WeeklyEntry | null>(
    `/weekly-entry?year=${year}&week=${week}`,
    { method: "GET", token, signal },
    "Unable to load weekly entry"
  );
  return data ?? null;
}

export async function putWeeklyEntry(input: WeeklyEntryInput, token: string, baseUpdatedAt?: string): Promise<WeeklyEntry> {
  const data = await apiRequest<WeeklyEntry>(
    "/weekly-entry",
    { method: "PUT", token, body: withBase(input, baseUpdatedAt) },
    "Unable to save weekly entry"
  );
  return requireData(data, "Unable to save weekly entry");
}

export async function fetchMonthlyEntry(year: number, month: number, token: string, signal?: AbortSignal): Promise<MonthlyEntry | null> {
  const data = await apiRequest<MonthlyEntry | null>(
    `/monthly-entry?year=${year}&month=${month}`,
    { method: "GET", token, signal },
    "Unable to load monthly entry"
  );
  return data ?? null;
}

export async function putMonthlyEntry(input: MonthlyEntryInput, token: string, baseUpdatedAt?: string): Promise<MonthlyEntry> {
  const data = await apiRequest<MonthlyEntry>(
    "/monthly-entry",
    { method: "PUT", token, body: withBase(input, baseUpdatedAt) },
    "Unable to save monthly entry"
  );
  return requireData(data, "Unable to save monthly entry");
}
