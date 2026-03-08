import { Prisma } from "@prisma/client";
import { formatDateOnly, parseDateOnly } from "../tasks/task-store";
import {
  GamingTrackAffirmationRecord,
  GamingTrackBilanRecord,
  GamingTrackStore,
  GamingTrackWindowData,
} from "./gaming-track-store";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type GamingTrackPeriod = "day" | "week" | "month" | "year";

export type GamingTrackBadgeId =
  | "first_task_done"
  | "task_finisher_50"
  | "execution_streak_7"
  | "reflection_streak_5"
  | "mission_week_4"
  | "carryover_recovery_10";

export type GamingTrackBadgeTier = "bronze" | "silver" | "gold";

export type GamingTrackLevelRank = "rookie" | "builder" | "operator" | "strategist" | "master";

export type GamingTrackSummaryInput = {
  userId: string;
  period: GamingTrackPeriod;
  anchorDate: Date;
};

export type GamingTrackClaimChallengeInput = {
  userId: string;
  anchorDate: Date;
};

export type GamingTrackUseStreakProtectionInput = {
  userId: string;
  anchorDate: Date;
};

export type GamingTrackDismissNudgeInput = {
  userId: string;
  anchorDate: Date;
  nudgeId: GamingTrackNudgeId;
};

export type GamingTrackMissionId = "done_tasks" | "affirmation_days" | "bilan_days" | "execution_streak";

export type GamingTrackMission = {
  id: GamingTrackMissionId;
  target: number;
  progress: number;
  completed: boolean;
};

export type GamingTrackBadge = {
  id: GamingTrackBadgeId;
  tier: GamingTrackBadgeTier;
  progress: number;
  target: number;
  unlocked: boolean;
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

export type GamingTrackChallengeId =
  | "finish_10_tasks"
  | "complete_reflection_4_days"
  | "hit_consistency_60"
  | "close_carryover_3";

export type GamingTrackRecapHeadlineId = "strong_uptrend" | "steady_progress" | "downtrend_alert";

export type GamingTrackRecapFocusId =
  | "protect_streak"
  | "reduce_carryover"
  | "increase_reflection"
  | "increase_throughput"
  | "increase_consistency";

export type GamingTrackNudgeId =
  | "streak_risk"
  | "carryover_pressure"
  | "momentum_positive"
  | "consistency_low"
  | "challenge_almost_done";

export type GamingTrackNudgeSeverity = "info" | "warning" | "success";

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
  level: {
    xp: number;
    level: number;
    rank: GamingTrackLevelRank;
    currentLevelXp: number;
    nextLevelXp: number;
    progressToNextLevel: number;
  };
  badges: GamingTrackBadge[];
  streakProtection: {
    availableCharges: number;
    maxCharges: number;
    earnedCharges: number;
    usedCharges: number;
    atRisk: boolean;
    recommended: boolean;
    projectedExecutionStreak: number;
    projectedReflectionStreak: number;
  };
  historicalTrends: {
    daily: GamingTrackHistoricalPoint[];
    weekly: GamingTrackHistoricalPoint[];
    monthly: GamingTrackHistoricalPoint[];
  };
  engagement: {
    challenge: {
      id: GamingTrackChallengeId;
      target: number;
      progress: number;
      completed: boolean;
      claimed: boolean;
      claimedAt: Date | null;
      rewardXp: number;
      expiresOn: Date;
    };
    leaderboard: {
      rank: number;
      total: number;
      percentile: number;
      currentScore: number;
      topScore: number;
      entries: Array<{
        label: string;
        rangeStart: Date;
        rangeEnd: Date;
        score: number;
        tasksDone: number;
        reflectionDays: number;
        isCurrent: boolean;
      }>;
    };
    recap: {
      periodStart: Date;
      periodEnd: Date;
      headline: GamingTrackRecapHeadlineId;
      highlights: Array<{
        id: "tasks_done" | "reflection_days" | "overall_score" | "execution_streak";
        value: number;
        delta: number | null;
      }>;
      focus: GamingTrackRecapFocusId[];
      generatedOn: Date;
    };
    nudges: Array<{
      id: GamingTrackNudgeId;
      severity: GamingTrackNudgeSeverity;
      metric: number;
    }>;
  };
};

export type GamingTrackService = {
  getSummary(input: GamingTrackSummaryInput): Promise<GamingTrackSummary>;
  claimChallengeReward(input: GamingTrackClaimChallengeInput): Promise<{
    challengeId: GamingTrackChallengeId;
    challengeWeekStart: Date;
    rewardXp: number;
    alreadyClaimed: boolean;
    claimedAt: Date;
  }>;
  useStreakProtection(input: GamingTrackUseStreakProtectionInput): Promise<{
    usedOn: Date;
    remainingCharges: number;
    alreadyUsed: boolean;
  }>;
  dismissNudge(input: GamingTrackDismissNudgeInput): Promise<{
    nudgeId: GamingTrackNudgeId;
    dismissedOn: Date;
    alreadyDismissed: boolean;
  }>;
};

export class GamingTrackActionError extends Error {
  readonly statusCode: number;
  readonly errorCode: "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND";

  constructor(
    statusCode: number,
    errorCode: "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND",
    message: string
  ) {
    super(message);
    this.name = "GamingTrackActionError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export function isGamingTrackActionError(error: unknown): error is GamingTrackActionError {
  return error instanceof GamingTrackActionError;
}

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

type BadgeComputationContext = {
  doneTasks: number;
  executionBestStreak: number;
  reflectionBestStreak: number;
  qualifiedMissionWeeks: number;
  carriedOverDoneTasks: number;
};

type BadgeDefinition = {
  id: GamingTrackBadgeId;
  tier: GamingTrackBadgeTier;
  target: number;
  getProgress: (context: BadgeComputationContext) => number;
};

type DailyActivityFlags = {
  execution: boolean;
  reflection: boolean;
};

const STREAK_PROTECTION_MAX_CHARGES = 3;

const BADGE_DEFINITIONS: ReadonlyArray<BadgeDefinition> = [
  {
    id: "first_task_done",
    tier: "bronze",
    target: 1,
    getProgress: (context) => context.doneTasks,
  },
  {
    id: "task_finisher_50",
    tier: "silver",
    target: 50,
    getProgress: (context) => context.doneTasks,
  },
  {
    id: "execution_streak_7",
    tier: "silver",
    target: 7,
    getProgress: (context) => context.executionBestStreak,
  },
  {
    id: "reflection_streak_5",
    tier: "silver",
    target: 5,
    getProgress: (context) => context.reflectionBestStreak,
  },
  {
    id: "mission_week_4",
    tier: "gold",
    target: 4,
    getProgress: (context) => context.qualifiedMissionWeeks,
  },
  {
    id: "carryover_recovery_10",
    tier: "gold",
    target: 10,
    getProgress: (context) => context.carriedOverDoneTasks,
  },
];

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

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
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

function getCompletedMissionCount(missions: GamingTrackMission[]): number {
  return missions.filter((mission) => mission.completed).length;
}

function countQualifiedMissionWeeks(window: GamingTrackWindowData): number {
  const bounds = getDateBounds(window);

  if (!bounds) {
    return 0;
  }

  let completedWeekCount = 0;
  let cursor = getWeekStart(bounds.start);

  while (cursor.getTime() < bounds.endExclusive.getTime()) {
    const weekEndExclusive = addDays(cursor, 7);
    const weeklyWindow = getWindowSlice(window, cursor, weekEndExclusive);
    const weeklyMetrics = computeWindowMetrics(weeklyWindow, cursor, weekEndExclusive);
    const missions = buildWeeklyMissions(weeklyMetrics);

    if (getCompletedMissionCount(missions) >= 3) {
      completedWeekCount += 1;
    }

    cursor = addDays(cursor, 7);
  }

  return completedWeekCount;
}

function getLevelRank(level: number): GamingTrackLevelRank {
  if (level >= 11) {
    return "master";
  }

  if (level >= 8) {
    return "strategist";
  }

  if (level >= 5) {
    return "operator";
  }

  if (level >= 3) {
    return "builder";
  }

  return "rookie";
}

function computeLevel(
  lifetimeMetrics: ComputedWindow,
  reflectionDayCount: number,
  qualifiedMissionWeeks: number
): GamingTrackSummary["level"] {
  const xp =
    lifetimeMetrics.tasks.done * 10 +
    lifetimeMetrics.affirmations.completedDays * 8 +
    lifetimeMetrics.bilans.completedDays * 8 +
    reflectionDayCount * 6 +
    qualifiedMissionWeeks * 20;

  let level = 1;
  let nextLevelXp = 120;
  let remainingXp = xp;

  while (remainingXp >= nextLevelXp) {
    remainingXp -= nextLevelXp;
    level += 1;
    nextLevelXp = Math.round(nextLevelXp * 1.18);
  }

  return {
    xp,
    level,
    rank: getLevelRank(level),
    currentLevelXp: remainingXp,
    nextLevelXp,
    progressToNextLevel: nextLevelXp === 0 ? 100 : clampScore((remainingXp / nextLevelXp) * 100),
  };
}

function buildBadges(context: BadgeComputationContext): GamingTrackBadge[] {
  return BADGE_DEFINITIONS.map((badge) => {
    const progress = badge.getProgress(context);

    return {
      id: badge.id,
      tier: badge.tier,
      progress,
      target: badge.target,
      unlocked: progress >= badge.target,
    };
  });
}

function buildDailyActivityMap(window: GamingTrackWindowData): Map<string, DailyActivityFlags> {
  const doneTasksByDate = new Map<string, number>();
  const completedAffirmationDays = getCompletedAffirmationDays(window.affirmations);
  const completedBilanDays = getCompletedBilanDays(window.bilans);

  for (const task of window.tasks) {
    if (task.status !== "done") {
      continue;
    }

    const dateKey = formatDateOnly(task.targetDate);
    doneTasksByDate.set(dateKey, (doneTasksByDate.get(dateKey) ?? 0) + 1);
  }

  const allDateKeys = new Set<string>([
    ...doneTasksByDate.keys(),
    ...completedAffirmationDays.values(),
    ...completedBilanDays.values(),
  ]);
  const activityMap = new Map<string, DailyActivityFlags>();

  for (const dateKey of allDateKeys) {
    const execution = (doneTasksByDate.get(dateKey) ?? 0) > 0;
    const reflection = completedAffirmationDays.has(dateKey) && completedBilanDays.has(dateKey);
    activityMap.set(dateKey, { execution, reflection });
  }

  return activityMap;
}

function countDailyActivity(activity: Map<string, DailyActivityFlags>, key: keyof DailyActivityFlags): number {
  let count = 0;

  for (const value of activity.values()) {
    if (value[key]) {
      count += 1;
    }
  }

  return count;
}

function getTrailingStreakBeforeDate(
  activity: Map<string, DailyActivityFlags>,
  startDate: Date,
  key: keyof DailyActivityFlags
): number {
  let streak = 0;
  let cursor = startOfUtcDay(startDate);

  while (true) {
    const cursorFlags = activity.get(formatDateOnly(cursor));

    if (!cursorFlags || !cursorFlags[key]) {
      break;
    }

    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function computeStreakProtection(
  activity: Map<string, DailyActivityFlags>,
  anchorDate: Date,
  qualifiedMissionWeeks: number,
  usedChargeCount: number
): GamingTrackSummary["streakProtection"] {
  const normalizedAnchorDate = startOfUtcDay(anchorDate);
  const yesterday = addDays(normalizedAnchorDate, -1);
  const todayFlags = activity.get(formatDateOnly(normalizedAnchorDate));
  const yesterdayFlags = activity.get(formatDateOnly(yesterday));

  const todayExecution = todayFlags?.execution ?? false;
  const yesterdayExecution = yesterdayFlags?.execution ?? false;
  const todayReflection = todayFlags?.reflection ?? false;
  const yesterdayReflection = yesterdayFlags?.reflection ?? false;

  const atRisk = (yesterdayExecution && !todayExecution) || (yesterdayReflection && !todayReflection);
  const executionStreakToYesterday = yesterdayExecution
    ? getTrailingStreakBeforeDate(activity, yesterday, "execution")
    : 0;
  const reflectionStreakToYesterday = yesterdayReflection
    ? getTrailingStreakBeforeDate(activity, yesterday, "reflection")
    : 0;

  const projectedExecutionStreak = yesterdayExecution && !todayExecution ? executionStreakToYesterday + 1 : 0;
  const projectedReflectionStreak = yesterdayReflection && !todayReflection ? reflectionStreakToYesterday + 1 : 0;

  const earnedCharges = qualifiedMissionWeeks;
  const cappedEarnedCharges = Math.min(STREAK_PROTECTION_MAX_CHARGES, earnedCharges);
  const usedCharges = Math.max(0, Math.min(cappedEarnedCharges, usedChargeCount));
  const availableCharges = Math.max(0, cappedEarnedCharges - usedCharges);

  return {
    availableCharges,
    maxCharges: STREAK_PROTECTION_MAX_CHARGES,
    earnedCharges,
    usedCharges,
    atRisk,
    recommended:
      atRisk && availableCharges > 0 && Math.max(executionStreakToYesterday, reflectionStreakToYesterday) >= 3,
    projectedExecutionStreak,
    projectedReflectionStreak,
  };
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

function getReflectionDayCountInRange(window: GamingTrackWindowData, start: Date, endExclusive: Date): number {
  const completedAffirmationDays = getCompletedAffirmationDays(window.affirmations);
  const completedBilanDays = getCompletedBilanDays(window.bilans);

  let reflectionDayCount = 0;
  const dateKeys = getDateKeysInRange(start, endExclusive);

  for (const dateKey of dateKeys) {
    if (completedAffirmationDays.has(dateKey) && completedBilanDays.has(dateKey)) {
      reflectionDayCount += 1;
    }
  }

  return reflectionDayCount;
}

function buildWeeklyChallenge(
  weeklyWindow: GamingTrackWindowData,
  weeklyMetrics: ComputedWindow,
  weeklyRange: { start: Date; endExclusive: Date }
): Omit<GamingTrackSummary["engagement"]["challenge"], "claimed" | "claimedAt"> {
  const weeklyReflectionDays = getReflectionDayCountInRange(weeklyWindow, weeklyRange.start, weeklyRange.endExclusive);
  const recoveredCarryOverCount = weeklyWindow.tasks.filter(
    (task) => task.rolledFromTaskId !== null && task.status === "done"
  ).length;

  const candidates: Array<{
    id: GamingTrackChallengeId;
    target: number;
    progress: number;
    rewardXp: number;
  }> = [
    {
      id: "finish_10_tasks",
      target: 10,
      progress: weeklyMetrics.tasks.done,
      rewardXp: 60,
    },
    {
      id: "complete_reflection_4_days",
      target: 4,
      progress: weeklyReflectionDays,
      rewardXp: 55,
    },
    {
      id: "hit_consistency_60",
      target: 60,
      progress: weeklyMetrics.scores.consistency,
      rewardXp: 50,
    },
    {
      id: "close_carryover_3",
      target: 3,
      progress: recoveredCarryOverCount,
      rewardXp: 45,
    },
  ];

  const incomplete = candidates
    .filter((candidate) => candidate.progress < candidate.target)
    .sort((left, right) => {
      const leftRatio = left.progress / left.target;
      const rightRatio = right.progress / right.target;

      if (rightRatio !== leftRatio) {
        return rightRatio - leftRatio;
      }

      return right.rewardXp - left.rewardXp;
    });

  const selected = incomplete[0] ?? candidates[0];

  return {
    id: selected.id,
    target: selected.target,
    progress: selected.progress,
    completed: selected.progress >= selected.target,
    rewardXp: selected.rewardXp,
    expiresOn: addDays(weeklyRange.endExclusive, -1),
  };
}

function sortLeaderboardEntries(
  left: GamingTrackSummary["engagement"]["leaderboard"]["entries"][number],
  right: GamingTrackSummary["engagement"]["leaderboard"]["entries"][number]
): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.tasksDone !== left.tasksDone) {
    return right.tasksDone - left.tasksDone;
  }

  if (right.reflectionDays !== left.reflectionDays) {
    return right.reflectionDays - left.reflectionDays;
  }

  return right.rangeStart.getTime() - left.rangeStart.getTime();
}

function buildWeeklyLeaderboard(
  lifetimeWindow: GamingTrackWindowData,
  anchorDate: Date
): GamingTrackSummary["engagement"]["leaderboard"] {
  const normalizedAnchorDate = startOfUtcDay(anchorDate);
  const currentWeekStart = getWeekStart(normalizedAnchorDate);
  const daysIntoWeek = (normalizedAnchorDate.getUTCDay() + 6) % 7;
  const trackedDays = daysIntoWeek + 1;

  const entries: GamingTrackSummary["engagement"]["leaderboard"]["entries"] = [];

  for (let offset = 0; offset < 8; offset += 1) {
    const weekStart = addDays(currentWeekStart, -7 * offset);
    const weekEndExclusive = addDays(weekStart, trackedDays);
    const weekWindow = getWindowSlice(lifetimeWindow, weekStart, weekEndExclusive);
    const weekMetrics = computeWindowMetrics(weekWindow, weekStart, weekEndExclusive);
    const reflectionDays = getReflectionDayCountInRange(weekWindow, weekStart, weekEndExclusive);

    entries.push({
      label: formatDateOnly(weekStart),
      rangeStart: weekStart,
      rangeEnd: addDays(weekEndExclusive, -1),
      score: weekMetrics.scores.overall,
      tasksDone: weekMetrics.tasks.done,
      reflectionDays,
      isCurrent: offset === 0,
    });
  }

  const sortedEntries = [...entries].sort(sortLeaderboardEntries);
  const currentIndex = sortedEntries.findIndex((entry) => entry.isCurrent);
  const rank = currentIndex === -1 ? sortedEntries.length : currentIndex + 1;
  const total = sortedEntries.length;
  const percentile = total <= 1 ? 100 : clampScore(((total - rank) / (total - 1)) * 100);

  const topEntries = sortedEntries.slice(0, 5);
  if (!topEntries.some((entry) => entry.isCurrent)) {
    const currentEntry = sortedEntries.find((entry) => entry.isCurrent);
    if (currentEntry && topEntries.length > 0) {
      topEntries[topEntries.length - 1] = currentEntry;
      topEntries.sort(sortLeaderboardEntries);
    }
  }

  return {
    rank,
    total,
    percentile,
    currentScore: sortedEntries.find((entry) => entry.isCurrent)?.score ?? 0,
    topScore: sortedEntries[0]?.score ?? 0,
    entries: topEntries,
  };
}

function buildWeeklyRecap(
  anchorDate: Date,
  currentWeeklyMetrics: ComputedWindow,
  previousWeeklyMetrics: ComputedWindow,
  currentWeeklyReflectionDays: number,
  previousWeeklyReflectionDays: number,
  weeklyRange: { start: Date; endExclusive: Date },
  streakProtection: GamingTrackSummary["streakProtection"]
): GamingTrackSummary["engagement"]["recap"] {
  const overallDelta = currentWeeklyMetrics.scores.overall - previousWeeklyMetrics.scores.overall;
  const executionStreakDelta =
    currentWeeklyMetrics.streaks.executionActive - previousWeeklyMetrics.streaks.executionActive;
  const weeklyTrackedDays = getTrackedDays(weeklyRange.start, weeklyRange.endExclusive);

  const focus: GamingTrackRecapFocusId[] = [];

  if (streakProtection.atRisk) {
    focus.push("protect_streak");
  }

  if (currentWeeklyMetrics.tasks.carriedOver >= 2) {
    focus.push("reduce_carryover");
  }

  if (currentWeeklyReflectionDays < Math.min(weeklyTrackedDays, 4)) {
    focus.push("increase_reflection");
  }

  if (currentWeeklyMetrics.tasks.done < 5) {
    focus.push("increase_throughput");
  }

  if (currentWeeklyMetrics.scores.consistency < 50) {
    focus.push("increase_consistency");
  }

  if (focus.length === 0) {
    focus.push("increase_throughput");
  }

  const headline: GamingTrackRecapHeadlineId =
    overallDelta >= 8 ? "strong_uptrend" : overallDelta <= -8 ? "downtrend_alert" : "steady_progress";

  return {
    periodStart: weeklyRange.start,
    periodEnd: addDays(weeklyRange.endExclusive, -1),
    headline,
    highlights: [
      {
        id: "tasks_done",
        value: currentWeeklyMetrics.tasks.done,
        delta: currentWeeklyMetrics.tasks.done - previousWeeklyMetrics.tasks.done,
      },
      {
        id: "reflection_days",
        value: currentWeeklyReflectionDays,
        delta: currentWeeklyReflectionDays - previousWeeklyReflectionDays,
      },
      {
        id: "overall_score",
        value: currentWeeklyMetrics.scores.overall,
        delta: overallDelta,
      },
      {
        id: "execution_streak",
        value: currentWeeklyMetrics.streaks.executionActive,
        delta: executionStreakDelta,
      },
    ],
    focus: focus.slice(0, 3),
    generatedOn: startOfUtcDay(anchorDate),
  };
}

function buildEngagementNudges(
  currentWeeklyMetrics: ComputedWindow,
  challenge: GamingTrackSummary["engagement"]["challenge"],
  streakProtection: GamingTrackSummary["streakProtection"],
  overallDelta: number
): GamingTrackSummary["engagement"]["nudges"] {
  const nudges: GamingTrackSummary["engagement"]["nudges"] = [];

  if (streakProtection.atRisk) {
    nudges.push({
      id: "streak_risk",
      severity: "warning",
      metric: Math.max(streakProtection.projectedExecutionStreak, streakProtection.projectedReflectionStreak),
    });
  }

  if (currentWeeklyMetrics.tasks.carriedOver >= 3) {
    nudges.push({
      id: "carryover_pressure",
      severity: "warning",
      metric: currentWeeklyMetrics.tasks.carriedOver,
    });
  }

  if (overallDelta >= 10) {
    nudges.push({
      id: "momentum_positive",
      severity: "success",
      metric: overallDelta,
    });
  }

  if (currentWeeklyMetrics.scores.consistency < 35) {
    nudges.push({
      id: "consistency_low",
      severity: "info",
      metric: currentWeeklyMetrics.scores.consistency,
    });
  }

  if (!challenge.completed && challenge.target > 0 && challenge.progress / challenge.target >= 0.75) {
    nudges.push({
      id: "challenge_almost_done",
      severity: "info",
      metric: challenge.target - challenge.progress,
    });
  }

  if (nudges.length === 0) {
    nudges.push({
      id: "momentum_positive",
      severity: "success",
      metric: Math.max(0, overallDelta),
    });
  }

  return nudges.slice(0, 3);
}

export function createGamingTrackService(store: GamingTrackStore): GamingTrackService {
  async function buildSummary(input: GamingTrackSummaryInput): Promise<GamingTrackSummary> {
    const range = getDateRange(input.anchorDate, input.period);
    const previousStart = addDays(range.start, -range.trackedDays);
    const weeklyMissionRange = getDateRange(input.anchorDate, "week");
    const anchorDay = startOfUtcDay(input.anchorDate);
    const anchorDayEndExclusive = addDays(anchorDay, 1);

    const currentWindowPromise = store.getWindowData(input.userId, range.start, range.endExclusive);
    const weeklyWindowPromise =
      weeklyMissionRange.start.getTime() === range.start.getTime() &&
      weeklyMissionRange.endExclusive.getTime() === range.endExclusive.getTime()
        ? currentWindowPromise
        : store.getWindowData(input.userId, weeklyMissionRange.start, weeklyMissionRange.endExclusive);

    const [currentWindow, previousWindow, lifetimeWindow, weeklyWindow, usedChargeCount, dismissedNudges] =
      await Promise.all([
        currentWindowPromise,
        store.getWindowData(input.userId, previousStart, range.start),
        store.getLifetimeData(input.userId),
        weeklyWindowPromise,
        store.countStreakProtectionUsages(input.userId, anchorDayEndExclusive),
        store.getDismissedNudges(input.userId, weeklyMissionRange.start, weeklyMissionRange.endExclusive),
      ]);

    const current = computeWindowMetrics(currentWindow, range.start, range.endExclusive);
    const previous = computeWindowMetrics(previousWindow, previousStart, range.start);
    const weekly = computeWindowMetrics(weeklyWindow, weeklyMissionRange.start, weeklyMissionRange.endExclusive);
    const lifetimeBounds = getDateBounds(lifetimeWindow);
    const lifetimeMetrics = lifetimeBounds
      ? computeWindowMetrics(lifetimeWindow, lifetimeBounds.start, lifetimeBounds.endExclusive)
      : computeWindowMetrics(lifetimeWindow, range.start, range.start);
    const missionQualifiedWeeks = countQualifiedMissionWeeks(lifetimeWindow);
    const personalBests = computePersonalBests(lifetimeWindow);
    const dailyActivity = buildDailyActivityMap(lifetimeWindow);
    const reflectionDayCount = countDailyActivity(dailyActivity, "reflection");
    const carriedOverDoneTasks = lifetimeWindow.tasks.filter(
      (task) => task.rolledFromTaskId !== null && task.status === "done"
    ).length;
    const previousWeeklyStart = addDays(weeklyMissionRange.start, -weeklyMissionRange.trackedDays);
    const previousWeeklyWindow = getWindowSlice(lifetimeWindow, previousWeeklyStart, weeklyMissionRange.start);
    const previousWeekly = computeWindowMetrics(previousWeeklyWindow, previousWeeklyStart, weeklyMissionRange.start);
    const weeklyReflectionDays = getReflectionDayCountInRange(
      weeklyWindow,
      weeklyMissionRange.start,
      weeklyMissionRange.endExclusive
    );
    const previousWeeklyReflectionDays = getReflectionDayCountInRange(
      previousWeeklyWindow,
      previousWeeklyStart,
      weeklyMissionRange.start
    );

    const executionDelta = current.scores.execution - previous.scores.execution;
    const reflectionDelta = current.scores.reflection - previous.scores.reflection;
    const consistencyDelta = current.scores.consistency - previous.scores.consistency;
    const overallDelta = current.scores.overall - previous.scores.overall;
    const momentumScore = clampScore(50 + overallDelta);
    const streakProtection = computeStreakProtection(dailyActivity, input.anchorDate, missionQualifiedWeeks, usedChargeCount);
    const challengeBase = buildWeeklyChallenge(weeklyWindow, weekly, {
      start: weeklyMissionRange.start,
      endExclusive: weeklyMissionRange.endExclusive,
    });
    const challengeClaim = await store.getChallengeClaim(input.userId, challengeBase.id, weeklyMissionRange.start);
    const challenge: GamingTrackSummary["engagement"]["challenge"] = {
      ...challengeBase,
      claimed: challengeClaim !== null,
      claimedAt: challengeClaim?.claimedAt ?? null,
    };
    const leaderboard = buildWeeklyLeaderboard(lifetimeWindow, input.anchorDate);
    const recap = buildWeeklyRecap(
      input.anchorDate,
      weekly,
      previousWeekly,
      weeklyReflectionDays,
      previousWeeklyReflectionDays,
      {
        start: weeklyMissionRange.start,
        endExclusive: weeklyMissionRange.endExclusive,
      },
      streakProtection
    );
    const weeklyOverallDelta = weekly.scores.overall - previousWeekly.scores.overall;
    const dismissedNudgeIds = new Set(dismissedNudges.map((dismissal) => dismissal.nudgeId));
    const nudges = buildEngagementNudges(weekly, challenge, streakProtection, weeklyOverallDelta).filter(
      (nudge) => !dismissedNudgeIds.has(nudge.id)
    );

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
      level: computeLevel(lifetimeMetrics, reflectionDayCount, missionQualifiedWeeks),
      badges: buildBadges({
        doneTasks: lifetimeMetrics.tasks.done,
        executionBestStreak: personalBests.executionBestStreak,
        reflectionBestStreak: personalBests.reflectionBestStreak,
        qualifiedMissionWeeks: missionQualifiedWeeks,
        carriedOverDoneTasks,
      }),
      streakProtection,
      historicalTrends: buildHistoricalTrends(lifetimeWindow, input.anchorDate),
      engagement: {
        challenge,
        leaderboard,
        recap,
        nudges,
      },
    };
  }

  return {
    getSummary: buildSummary,

    async claimChallengeReward(input) {
      const summary = await buildSummary({
        userId: input.userId,
        period: "week",
        anchorDate: input.anchorDate,
      });
      const challenge = summary.engagement.challenge;

      if (!challenge.completed) {
        throw new GamingTrackActionError(409, "CONFLICT", "Challenge is not completed yet");
      }

      const challengeWeekStart = summary.weeklyMissionWindow.rangeStart;

      if (challenge.claimed && challenge.claimedAt) {
        return {
          challengeId: challenge.id,
          challengeWeekStart,
          rewardXp: challenge.rewardXp,
          alreadyClaimed: true,
          claimedAt: challenge.claimedAt,
        };
      }

      try {
        const claim = await store.createChallengeClaim({
          userId: input.userId,
          challengeId: challenge.id,
          challengeWeekStart,
          rewardXp: challenge.rewardXp,
        });

        return {
          challengeId: challenge.id,
          challengeWeekStart,
          rewardXp: claim.rewardXp,
          alreadyClaimed: false,
          claimedAt: claim.claimedAt,
        };
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        const existing = await store.getChallengeClaim(input.userId, challenge.id, challengeWeekStart);
        if (!existing) {
          throw error;
        }

        return {
          challengeId: challenge.id,
          challengeWeekStart,
          rewardXp: existing.rewardXp,
          alreadyClaimed: true,
          claimedAt: existing.claimedAt,
        };
      }
    },

    async useStreakProtection(input) {
      const usedOn = startOfUtcDay(input.anchorDate);
      const existingUsage = await store.getStreakProtectionUsage(input.userId, usedOn);

      if (existingUsage) {
        const refreshed = await buildSummary({
          userId: input.userId,
          period: "week",
          anchorDate: input.anchorDate,
        });

        return {
          usedOn,
          remainingCharges: refreshed.streakProtection.availableCharges,
          alreadyUsed: true,
        };
      }

      const summary = await buildSummary({
        userId: input.userId,
        period: "week",
        anchorDate: input.anchorDate,
      });

      if (!summary.streakProtection.atRisk) {
        throw new GamingTrackActionError(409, "CONFLICT", "No streak is currently at risk");
      }

      if (summary.streakProtection.availableCharges <= 0) {
        throw new GamingTrackActionError(409, "CONFLICT", "No streak protection charges available");
      }

      let alreadyUsed = false;
      try {
        await store.createStreakProtectionUsage({
          userId: input.userId,
          usedOn,
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        alreadyUsed = true;
      }

      const refreshed = await buildSummary({
        userId: input.userId,
        period: "week",
        anchorDate: input.anchorDate,
      });

      return {
        usedOn,
        remainingCharges: refreshed.streakProtection.availableCharges,
        alreadyUsed,
      };
    },

    async dismissNudge(input) {
      const dismissedOn = startOfUtcDay(input.anchorDate);
      const dismissedDayEndExclusive = addDays(dismissedOn, 1);
      const existingDismissals = await store.getDismissedNudges(input.userId, dismissedOn, dismissedDayEndExclusive);
      const existingDismissal = existingDismissals.find((dismissal) => dismissal.nudgeId === input.nudgeId);

      if (existingDismissal) {
        return {
          nudgeId: input.nudgeId,
          dismissedOn,
          alreadyDismissed: true,
        };
      }

      const summary = await buildSummary({
        userId: input.userId,
        period: "week",
        anchorDate: input.anchorDate,
      });

      const isActive = summary.engagement.nudges.some((nudge) => nudge.id === input.nudgeId);
      if (!isActive) {
        throw new GamingTrackActionError(404, "NOT_FOUND", "Nudge is not active for this period");
      }

      try {
        await store.createNudgeDismissal({
          userId: input.userId,
          nudgeId: input.nudgeId,
          dismissedOn,
        });

        return {
          nudgeId: input.nudgeId,
          dismissedOn,
          alreadyDismissed: false,
        };
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        return {
          nudgeId: input.nudgeId,
          dismissedOn,
          alreadyDismissed: true,
        };
      }
    },
  };
}
