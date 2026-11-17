/**
 * Local copy of the routine tracker: templates, ticks, and the monthly summary
 * recomputed with the same formula as the server (routes/routines.ts).
 */
import { fetchRoutineMonth } from "../api/routines-api";
import type { RoutineCompletion, RoutineMonthlySummary, RoutineTemplate } from "../api/routine-types";
import type { JotlyOfflineDb } from "./db";
import { getPendingEntityIds, replaceMatching } from "./local-store";

export function getMonthDays(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

/** Same scoring as the server: bonus routines only count when there is no normal routine. */
export function calculatePercentages(input: {
  routines: RoutineTemplate[];
  completions: RoutineCompletion[];
  days: string[];
}): Pick<RoutineMonthlySummary, "dailyPercentages" | "monthPercentage"> {
  const normalRoutines = input.routines.filter((routine) => routine.challenge !== "bonus");
  const scoredRoutines = normalRoutines.length > 0 ? normalRoutines : input.routines;
  const completionKeys = new Set(
    input.completions
      .filter((completion) => completion.isCompleted)
      .map((completion) => `${completion.routineId}:${completion.targetDate.substring(0, 10)}`)
  );
  const completedOn = (date: string) => scoredRoutines.filter((routine) => completionKeys.has(`${routine.id}:${date}`)).length;

  const dailyPercentages = input.days.map((date) => ({
    date,
    percentage: scoredRoutines.length === 0 ? 0 : Math.round((completedOn(date) / scoredRoutines.length) * 100),
  }));
  const totalSlots = scoredRoutines.length * input.days.length;
  const completedSlots = input.days.reduce((sum, date) => sum + completedOn(date), 0);
  return {
    dailyPercentages,
    monthPercentage: totalSlots === 0 ? 0 : Math.round((completedSlots / totalSlots) * 100),
  };
}

function sortRoutines(routines: RoutineTemplate[]): RoutineTemplate[] {
  return [...routines].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      (left.startTime ?? "").localeCompare(right.startTime ?? "") ||
      left.createdAt.localeCompare(right.createdAt)
  );
}

export async function buildLocalRoutineMonth(db: JotlyOfflineDb, month: string): Promise<RoutineMonthlySummary> {
  const days = getMonthDays(month);
  const routines = sortRoutines((await db.routines.toArray()).filter((routine) => routine.isActive));
  const completions = await db.routineCompletions.where("targetDate").between(days[0], days[days.length - 1], true, true).toArray();
  return { month, days, routines, completions, ...calculatePercentages({ routines, completions, days }) };
}

/** Download a month summary and store its routines and ticks (pending local changes are kept). */
export async function loadAndStoreRoutineMonth(
  db: JotlyOfflineDb,
  token: string,
  month: string,
  signal?: AbortSignal
): Promise<RoutineMonthlySummary> {
  const summary = await fetchRoutineMonth(month, token, signal);
  await replaceMatching(db, db.routines, () => true, summary.routines);
  const pending = await getPendingEntityIds(db);
  await db.transaction("rw", db.routineCompletions, async () => {
    const local = await db.routineCompletions.where("targetDate").between(summary.days[0], summary.days[summary.days.length - 1], true, true).toArray();
    const stale = local.filter((completion) => !pending.has(completion.routineId));
    await db.routineCompletions.bulkDelete(stale.map((completion) => [completion.routineId, completion.targetDate] as [string, string]));
    await db.routineCompletions.bulkPut(summary.completions.filter((completion) => !pending.has(completion.routineId)));
  });
  return summary;
}
