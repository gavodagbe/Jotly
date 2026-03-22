import { formatDateOnly, parseDateOnly } from "../tasks/task-store";
import {
  GamingTrackAffirmationRecord,
  GamingTrackBilanRecord,
  GamingTrackStore,
  GamingTrackWindowData,
} from "./gaming-track-store";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type GamingTrackPeriod = "day" | "week" | "month" | "year";

export type GamingTrackMissionId = "done_tasks" | "affirmation_days" | "bilan_days" | "execution_streak";

export type GamingTrackMission = {
  id: GamingTrackMissionId;
  target: number;
  progress: number;
  completed: boolean;
};

export type GamingTrackHistoricalPoint = {
  label: string;
  rangeStart: Date;
  rangeEnd: Date;
  trackedDays: number;
  tasksDone: number;
  taskCompletionRate: number;
  affirmationCompletionRate: number;
  bilanCompletionRate: number;
  overallScore: number;
};

export type GamingTrackSummaryInput = {
  userId: string;
  period: GamingTrackPeriod;
  anchorDate: Date;
};

export type GamingTrackSummary = {
  period: GamingTrackPeriod;
  anchorDate: Date;
  rangeStart: Date;
  rangeEnd: Date;
  trackedDays: number;
  tasks: {
    total: number;
    done: number;
    actionable: number;
    cancelled: number;
    carriedOver: number;
    completionRate: number;
  };
  affirmations: {
    completedDays: number;
    totalDays: number;
    completionRate: number;
  };
  bilans: {
    completedDays: number;
    totalDays: number;
    completionRate: number;
  };
  streaks: {
    executionBest: number;
    executionActive: number;
    reflectionBest: number;
    reflectionActive: number;
  };
  scores: {
    execution: number;
    reflection: number;
    consistency: number;
    momentum: number;
    overall: number;
  };
  trend: {
    executionDelta: number;
    reflectionDelta: number;
    consistencyDelta: number;
    overallDelta: number;
  };
  weeklyMissionWindow: {
    rangeStart: Date;
    rangeEnd: Date;
    trackedDays: number;
  };
  missions: GamingTrackMission[];
  personalBests: {
    dailyDoneTasks: number;
    dailyDoneTasksDate: Date | null;
    executionBestStreak: number;
    reflectionBestStreak: number;
  };
  historicalTrends: {
    daily: GamingTrackHistoricalPoint[];
    weekly: GamingTrackHistoricalPoint[];
    monthly: GamingTrackHistoricalPoint[];
  };
};

export type GamingTrackService = {
  getSummary(input: GamingTrackSummaryInput): Promise<GamingTrackSummary>;
};

type DateRange = {
  start: Date;
  endExclusive: Date;
  trackedDays: number;
};

type ComputedWindow = {
  tasks: GamingTrackSummary["tasks"];
  affirmations: GamingTrackSummary["affirmations"];
  bilans: GamingTrackSummary["bilans"];
  streaks: GamingTrackSummary["streaks"];
  scores: Omit<GamingTrackSummary["scores"], "momentum">;
};

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number): Date {
  const nextValue = new Date(value);
  nextValue.setUTCDate(nextValue.getUTCDate() + days);
  return nextValue;
}

function getTrackedDays(start: Date, endExclusive: Date): number {
  return Math.max(0, Math.round((endExclusive.getTime() - start.getTime()) / DAY_IN_MS));
}

function getWeekStart(anchorDate: Date): Date {
  const normalized = startOfUtcDay(anchorDate);
  const daysSinceMonday = (normalized.getUTCDay() + 6) % 7;
  return addDays(normalized, -daysSinceMonday);
}

function getDateRange(anchorDate: Date, period: GamingTrackPeriod): DateRange {
  const anchorDay = startOfUtcDay(anchorDate);
  const endExclusive = addDays(anchorDay, 1);

  if (period === "day") {
    return {
      start: anchorDay,
      endExclusive,
      trackedDays: 1,
    };
  }

  if (period === "week") {
    const start = getWeekStart(anchorDay);

    return {
      start,
      endExclusive,
      trackedDays: getTrackedDays(start, endExclusive),
    };
  }

  if (period === "month") {
    const start = new Date(Date.UTC(anchorDay.getUTCFullYear(), anchorDay.getUTCMonth(), 1));

    return {
      start,
      endExclusive,
      trackedDays: getTrackedDays(start, endExclusive),
    };
  }

  const start = new Date(Date.UTC(anchorDay.getUTCFullYear(), 0, 1));

  return {
    start,
    endExclusive,
    trackedDays: getTrackedDays(start, endExclusive),
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasNonEmptyText(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

function isBilanCompleted(record: GamingTrackBilanRecord): boolean {
  return (
    record.mood !== null ||
    hasNonEmptyText(record.wins) ||
    hasNonEmptyText(record.blockers) ||
    hasNonEmptyText(record.lessonsLearned) ||
    hasNonEmptyText(record.tomorrowTop3)
  );
}

function getDateKeysInRange(start: Date, endExclusive: Date): string[] {
  const keys: string[] = [];

  for (let cursor = new Date(start); cursor.getTime() < endExclusive.getTime(); cursor = addDays(cursor, 1)) {
    keys.push(formatDateOnly(cursor));
  }

  return keys;
}

function isDateInRange(value: Date, start: Date, endExclusive: Date): boolean {
  const timestamp = value.getTime();
  return timestamp >= start.getTime() && timestamp < endExclusive.getTime();
}

function getWindowSlice(window: GamingTrackWindowData, start: Date, endExclusive: Date): GamingTrackWindowData {
  return {
    tasks: window.tasks.filter((record) => isDateInRange(record.targetDate, start, endExclusive)),
    affirmations: window.affirmations.filter((record) => isDateInRange(record.targetDate, start, endExclusive)),
    bilans: window.bilans.filter((record) => isDateInRange(record.targetDate, start, endExclusive)),
  };
}

function getLongestTrueStreak(values: boolean[]): number {
  let longest = 0;
  let current = 0;

  for (const value of values) {
    if (value) {
      current += 1;
      if (current > longest) {
        longest = current;
      }
    } else {
      current = 0;
    }
  }

  return longest;
}

function getActiveTrueStreak(values: boolean[]): number {
  let streak = 0;

  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (!values[index]) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function getCompletedAffirmationDays(records: GamingTrackAffirmationRecord[]): Set<string> {
  const completedDays = new Set<string>();

  for (const record of records) {
    if (record.isCompleted) {
      completedDays.add(formatDateOnly(record.targetDate));
    }
  }

  return completedDays;
}

function getCompletedBilanDays(records: GamingTrackBilanRecord[]): Set<string> {
  const completedDays = new Set<string>();

  for (const record of records) {
    if (isBilanCompleted(record)) {
      completedDays.add(formatDateOnly(record.targetDate));
    }
  }

  return completedDays;
}

function computeWindowMetrics(window: GamingTrackWindowData, start: Date, endExclusive: Date): ComputedWindow {
  const trackedDays = getTrackedDays(start, endExclusive);
  const doneTasksByDate = new Map<string, number>();

  let doneCount = 0;
  let actionableCount = 0;
  let cancelledCount = 0;
  let carriedOverCount = 0;

  for (const task of window.tasks) {
    const targetDateKey = formatDateOnly(task.targetDate);

    if (task.status === "done") {
      doneCount += 1;
      doneTasksByDate.set(targetDateKey, (doneTasksByDate.get(targetDateKey) ?? 0) + 1);
    } else if (task.status === "cancelled") {
      cancelledCount += 1;
    } else {
      actionableCount += 1;
    }

    if (task.rolledFromTaskId !== null) {
      carriedOverCount += 1;
    }
  }

  const taskTotalCount = window.tasks.length;
  const taskCompletionRate = taskTotalCount === 0 ? 0 : clampScore((doneCount / taskTotalCount) * 100);

  const completedAffirmationDays = getCompletedAffirmationDays(window.affirmations);
  const affirmationCompletionRate =
    trackedDays === 0 ? 0 : clampScore((completedAffirmationDays.size / trackedDays) * 100);

  const completedBilanDays = getCompletedBilanDays(window.bilans);
  const bilanCompletionRate = trackedDays === 0 ? 0 : clampScore((completedBilanDays.size / trackedDays) * 100);

  const dateKeys = getDateKeysInRange(start, endExclusive);
  const executionFlags = dateKeys.map((dateKey) => (doneTasksByDate.get(dateKey) ?? 0) > 0);
  const reflectionFlags = dateKeys.map(
    (dateKey) => completedAffirmationDays.has(dateKey) && completedBilanDays.has(dateKey)
  );

  const executionBestStreak = getLongestTrueStreak(executionFlags);
  const executionActiveStreak = getActiveTrueStreak(executionFlags);
  const reflectionBestStreak = getLongestTrueStreak(reflectionFlags);
  const reflectionActiveStreak = getActiveTrueStreak(reflectionFlags);

  const executionScore = taskCompletionRate;
  const reflectionScore = clampScore((affirmationCompletionRate + bilanCompletionRate) / 2);
  const consistencyScore =
    trackedDays === 0 ? 0 : clampScore(((executionActiveStreak + reflectionActiveStreak) / (2 * trackedDays)) * 100);
  const overallScore = clampScore(executionScore * 0.5 + reflectionScore * 0.3 + consistencyScore * 0.2);

  return {
    tasks: {
      total: taskTotalCount,
      done: doneCount,
      actionable: actionableCount,
      cancelled: cancelledCount,
      carriedOver: carriedOverCount,
      completionRate: taskCompletionRate,
    },
    affirmations: {
      completedDays: completedAffirmationDays.size,
      totalDays: trackedDays,
      completionRate: affirmationCompletionRate,
    },
    bilans: {
      completedDays: completedBilanDays.size,
      totalDays: trackedDays,
      completionRate: bilanCompletionRate,
    },
    streaks: {
      executionBest: executionBestStreak,
      executionActive: executionActiveStreak,
      reflectionBest: reflectionBestStreak,
      reflectionActive: reflectionActiveStreak,
    },
    scores: {
      execution: executionScore,
      reflection: reflectionScore,
      consistency: consistencyScore,
      overall: overallScore,
    },
  };
}

function getDateBounds(window: GamingTrackWindowData): { start: Date; endExclusive: Date } | null {
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  const applyDate = (candidate: Date) => {
    const normalized = startOfUtcDay(candidate);

    if (!minDate || normalized.getTime() < minDate.getTime()) {
      minDate = normalized;
    }

    if (!maxDate || normalized.getTime() > maxDate.getTime()) {
      maxDate = normalized;
    }
  };

  for (const task of window.tasks) {
    applyDate(task.targetDate);
  }

  for (const affirmation of window.affirmations) {
    applyDate(affirmation.targetDate);
  }

  for (const bilan of window.bilans) {
    applyDate(bilan.targetDate);
  }

  if (!minDate || !maxDate) {
    return null;
  }

  return {
    start: minDate,
    endExclusive: addDays(maxDate, 1),
  };
}

function computePersonalBests(window: GamingTrackWindowData): GamingTrackSummary["personalBests"] {
  const doneTasksByDate = new Map<string, number>();

  for (const task of window.tasks) {
    if (task.status !== "done") {
      continue;
    }

    const dateKey = formatDateOnly(task.targetDate);
    doneTasksByDate.set(dateKey, (doneTasksByDate.get(dateKey) ?? 0) + 1);
  }

  let dailyDoneTasks = 0;
  let dailyDoneTasksDateKey: string | null = null;

  for (const [dateKey, doneCount] of doneTasksByDate.entries()) {
    if (doneCount > dailyDoneTasks || (doneCount === dailyDoneTasks && dateKey > (dailyDoneTasksDateKey ?? ""))) {
      dailyDoneTasks = doneCount;
      dailyDoneTasksDateKey = dateKey;
    }
  }

  const completedAffirmationDays = getCompletedAffirmationDays(window.affirmations);
  const completedBilanDays = getCompletedBilanDays(window.bilans);
  const lifetimeBounds = getDateBounds(window);

  if (!lifetimeBounds) {
    return {
      dailyDoneTasks,
      dailyDoneTasksDate: dailyDoneTasksDateKey ? parseDateOnly(dailyDoneTasksDateKey) : null,
      executionBestStreak: 0,
      reflectionBestStreak: 0,
    };
  }

  const dateKeys = getDateKeysInRange(lifetimeBounds.start, lifetimeBounds.endExclusive);
  const executionFlags = dateKeys.map((dateKey) => (doneTasksByDate.get(dateKey) ?? 0) > 0);
  const reflectionFlags = dateKeys.map(
    (dateKey) => completedAffirmationDays.has(dateKey) && completedBilanDays.has(dateKey)
  );

  return {
    dailyDoneTasks,
    dailyDoneTasksDate: dailyDoneTasksDateKey ? parseDateOnly(dailyDoneTasksDateKey) : null,
    executionBestStreak: getLongestTrueStreak(executionFlags),
    reflectionBestStreak: getLongestTrueStreak(reflectionFlags),
  };
}

function buildWeeklyMissions(weeklyMetrics: ComputedWindow): GamingTrackMission[] {
  return [
    {
      id: "done_tasks",
      target: 8,
      progress: weeklyMetrics.tasks.done,
      completed: weeklyMetrics.tasks.done >= 8,
    },
    {
      id: "affirmation_days",
      target: 5,
      progress: weeklyMetrics.affirmations.completedDays,
      completed: weeklyMetrics.affirmations.completedDays >= 5,
    },
    {
      id: "bilan_days",
      target: 5,
      progress: weeklyMetrics.bilans.completedDays,
      completed: weeklyMetrics.bilans.completedDays >= 5,
    },
    {
      id: "execution_streak",
      target: 4,
      progress: weeklyMetrics.streaks.executionActive,
      completed: weeklyMetrics.streaks.executionActive >= 4,
    },
  ];
}

function buildHistoricalPoint(
  label: string,
  start: Date,
  endExclusive: Date,
  metrics: ComputedWindow
): GamingTrackHistoricalPoint {
  return {
    label,
    rangeStart: start,
    rangeEnd: addDays(endExclusive, -1),
    trackedDays: getTrackedDays(start, endExclusive),
    tasksDone: metrics.tasks.done,
    taskCompletionRate: metrics.tasks.completionRate,
    affirmationCompletionRate: metrics.affirmations.completionRate,
    bilanCompletionRate: metrics.bilans.completionRate,
    overallScore: metrics.scores.overall,
  };
}

function buildDailyTrendPoints(window: GamingTrackWindowData, anchorDate: Date): GamingTrackHistoricalPoint[] {
  const normalizedAnchorDate = startOfUtcDay(anchorDate);
  const points: GamingTrackHistoricalPoint[] = [];

  for (let offset = 13; offset >= 0; offset -= 1) {
    const start = addDays(normalizedAnchorDate, -offset);
    const endExclusive = addDays(start, 1);
    const metrics = computeWindowMetrics(getWindowSlice(window, start, endExclusive), start, endExclusive);

    points.push(buildHistoricalPoint(formatDateOnly(start), start, endExclusive, metrics));
  }

  return points;
}

function buildWeeklyTrendPoints(window: GamingTrackWindowData, anchorDate: Date): GamingTrackHistoricalPoint[] {
  const normalizedAnchorDate = startOfUtcDay(anchorDate);
  const currentWeekStart = getWeekStart(normalizedAnchorDate);
  const daysIntoWeek = (normalizedAnchorDate.getUTCDay() + 6) % 7;
  const trackedDays = daysIntoWeek + 1;
  const points: GamingTrackHistoricalPoint[] = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const weekStart = addDays(currentWeekStart, -7 * offset);
    const endExclusive = addDays(weekStart, trackedDays);
    const metrics = computeWindowMetrics(getWindowSlice(window, weekStart, endExclusive), weekStart, endExclusive);

    points.push(buildHistoricalPoint(formatDateOnly(weekStart), weekStart, endExclusive, metrics));
  }

  return points;
}

function buildMonthlyTrendPoints(window: GamingTrackWindowData, anchorDate: Date): GamingTrackHistoricalPoint[] {
  const normalizedAnchorDate = startOfUtcDay(anchorDate);
  const anchorDayOfMonth = normalizedAnchorDate.getUTCDate();
  const points: GamingTrackHistoricalPoint[] = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const monthStart = new Date(Date.UTC(normalizedAnchorDate.getUTCFullYear(), normalizedAnchorDate.getUTCMonth() - offset, 1));
    const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
    const trackedDays = Math.min(anchorDayOfMonth, daysInMonth);
    const endExclusive = addDays(monthStart, trackedDays);
    const metrics = computeWindowMetrics(getWindowSlice(window, monthStart, endExclusive), monthStart, endExclusive);
    const label = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;

    points.push(buildHistoricalPoint(label, monthStart, endExclusive, metrics));
  }

  return points;
}

function buildHistoricalTrends(window: GamingTrackWindowData, anchorDate: Date): GamingTrackSummary["historicalTrends"] {
  return {
    daily: buildDailyTrendPoints(window, anchorDate),
    weekly: buildWeeklyTrendPoints(window, anchorDate),
    monthly: buildMonthlyTrendPoints(window, anchorDate),
  };
}

export function createGamingTrackService(store: GamingTrackStore): GamingTrackService {
  return {
    async getSummary(input) {
      const range = getDateRange(input.anchorDate, input.period);
      const previousStart = addDays(range.start, -range.trackedDays);
      const weeklyMissionRange = getDateRange(input.anchorDate, "week");

      const currentWindowPromise = store.getWindowData(input.userId, range.start, range.endExclusive);
      const weeklyWindowPromise =
        weeklyMissionRange.start.getTime() === range.start.getTime() &&
        weeklyMissionRange.endExclusive.getTime() === range.endExclusive.getTime()
          ? currentWindowPromise
          : store.getWindowData(input.userId, weeklyMissionRange.start, weeklyMissionRange.endExclusive);

      const [currentWindow, previousWindow, lifetimeWindow, weeklyWindow] = await Promise.all([
        currentWindowPromise,
        store.getWindowData(input.userId, previousStart, range.start),
        store.getLifetimeData(input.userId),
        weeklyWindowPromise,
      ]);

      const current = computeWindowMetrics(currentWindow, range.start, range.endExclusive);
      const previous = computeWindowMetrics(previousWindow, previousStart, range.start);
      const weekly = computeWindowMetrics(weeklyWindow, weeklyMissionRange.start, weeklyMissionRange.endExclusive);
      const personalBests = computePersonalBests(lifetimeWindow);

      const executionDelta = current.scores.execution - previous.scores.execution;
      const reflectionDelta = current.scores.reflection - previous.scores.reflection;
      const consistencyDelta = current.scores.consistency - previous.scores.consistency;
      const overallDelta = current.scores.overall - previous.scores.overall;
      const momentumScore = clampScore(50 + overallDelta);

      return {
        period: input.period,
        anchorDate: startOfUtcDay(input.anchorDate),
        rangeStart: range.start,
        rangeEnd: addDays(range.endExclusive, -1),
        trackedDays: range.trackedDays,
        tasks: current.tasks,
        affirmations: current.affirmations,
        bilans: current.bilans,
        streaks: current.streaks,
        scores: {
          ...current.scores,
          momentum: momentumScore,
        },
        trend: {
          executionDelta,
          reflectionDelta,
          consistencyDelta,
          overallDelta,
        },
        weeklyMissionWindow: {
          rangeStart: weeklyMissionRange.start,
          rangeEnd: addDays(weeklyMissionRange.endExclusive, -1),
          trackedDays: weeklyMissionRange.trackedDays,
        },
        missions: buildWeeklyMissions(weekly),
        personalBests,
        historicalTrends: buildHistoricalTrends(lifetimeWindow, input.anchorDate),
      };
    },
  };
}
