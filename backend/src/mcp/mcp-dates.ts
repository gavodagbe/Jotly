import { formatDateOnly, parseDateOnly } from "../tasks/task-store";
import { McpToolError } from "./tools/tool-kit";

export const DEFAULT_TIME_ZONE = "Europe/Paris";

export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Offset (ms) of `timeZone` from UTC at `instant`. */
function offsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The calendar day (as a UTC-midnight Date, Jotly's date-only convention) of `instant` in `timeZone`. */
export function dayIn(instant: Date, timeZone: string): Date {
  const p = zonedParts(instant, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

/** Converts a wall-clock time in `timeZone` to the UTC instant (DST-aware). */
export function zonedLocalToUtc(
  local: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string
): Date {
  const guess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** [start, end) of a Jotly day in `timeZone`, as UTC instants. */
export function dayBoundsUtc(day: Date, timeZone: string): { start: Date; end: Date } {
  const local = { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate(), hour: 0, minute: 0 };
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  return {
    start: zonedLocalToUtc(local, timeZone),
    end: zonedLocalToUtc(
      { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: 0, minute: 0 },
      timeZone
    ),
  };
}

/** Optional YYYY-MM-DD tool parameter; defaults to today in the user's time zone. */
export function resolveDay(value: string | undefined, timeZone: string, now: Date): Date {
  if (!value) return dayIn(now, timeZone);
  const parsed = parseDateOnly(value);
  if (!parsed) throw new McpToolError(`Date invalide « ${value} » : format attendu AAAA-MM-JJ.`);
  return parsed;
}

/**
 * Reminder time: ISO with offset ("2026-11-26T09:00:00+01:00") is taken as is;
 * a local time without offset ("2026-11-26T09:00") is read in the user's time zone.
 */
export function parseReminderTime(value: string, timeZone: string): Date {
  const local = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (local) {
    const [, year, month, day, hour, minute] = local.map(Number);
    return zonedLocalToUtc({ year, month, day, hour, minute }, timeZone);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(value.trim())) {
    const parsed = new Date(value.trim());
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  throw new McpToolError(`Heure invalide « ${value} » : format attendu AAAA-MM-JJTHH:MM (heure locale).`);
}

/** "2026-11-26 09:00" in the user's time zone. */
export function formatLocalDateTime(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

export { formatDateOnly };

/** ISO 8601 week (year, week) of a Jotly day. */
export function isoWeekOf(day: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday); // Thursday of the same ISO week
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return { year: date.getUTCFullYear(), week: Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7) };
}

/** Number of ISO weeks (52 or 53) in an ISO year: the week of 28 December. */
export function isoWeeksInYear(year: number): number {
  return isoWeekOf(new Date(Date.UTC(year, 11, 28))).week;
}

/** Monday..Sunday of an ISO week, as Jotly days. */
export function isoWeekRange(year: number, week: number): { start: Date; end: Date } {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const start = new Date(jan4);
  start.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}
