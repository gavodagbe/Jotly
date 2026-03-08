"use client";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-meta";

type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
type TaskPriority = "low" | "medium" | "high";
type RecurrenceFrequency = "daily" | "weekly" | "monthly";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: string;
  priority: TaskPriority;
  project: string | null;
  plannedTime: number | null;
  rolledFromTaskId: string | null;
  recurrenceSourceTaskId: string | null;
  recurrenceOccurrenceDate: string | null;
};

type TaskMutationInput = {
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: string;
  priority: TaskPriority;
  project: string | null;
  plannedTime: number | null;
};

type TaskComment = {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type TaskAttachment = {
  id: string;
  taskId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

type TaskRecurrenceRule = {
  id: string;
  taskId: string;
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: number[];
  endsOn: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaskRecurrenceMutationInput = {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: number[];
  endsOn: string | null;
};

type AssistantReplyPayload = {
  answer: string;
  source: "openai" | "heuristic";
  warning: string | null;
  generatedAt: string;
  usedTaskCount: number;
  usedCommentCount: number;
};

type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  source?: "openai" | "heuristic";
  usedTaskCount?: number;
  usedCommentCount?: number;
};

type TaskAttachmentMutationInput = {
  name: string;
  file: File;
};

type DayAffirmation = {
  id: string;
  targetDate: string;
  text: string;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DayBilan = {
  id: string;
  targetDate: string;
  mood: number | null;
  wins: string | null;
  blockers: string | null;
  lessonsLearned: string | null;
  tomorrowTop3: string | null;
  createdAt: string;
  updatedAt: string;
};

type DayBilanFormValues = {
  mood: string;
  wins: string;
  blockers: string;
  lessonsLearned: string;
  tomorrowTop3: string;
};

type DayBilanMutationInput = {
  date: string;
  mood: number | null;
  wins: string | null;
  blockers: string | null;
  lessonsLearned: string | null;
  tomorrowTop3: string | null;
};

type GamingTrackPeriod = "day" | "week" | "month" | "year";

type GamingTrackSummary = {
  period: GamingTrackPeriod;
  anchorDate: string;
  rangeStart: string;
  rangeEnd: string;
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
    rangeStart: string;
    rangeEnd: string;
    trackedDays: number;
  };
  missions: Array<{
    id: "done_tasks" | "affirmation_days" | "bilan_days" | "execution_streak";
    target: number;
    progress: number;
    completed: boolean;
  }>;
  personalBests: {
    dailyDoneTasks: number;
    dailyDoneTasksDate: string | null;
    executionBestStreak: number;
    reflectionBestStreak: number;
  };
  level: {
    xp: number;
    level: number;
    rank: "rookie" | "builder" | "operator" | "strategist" | "master";
    currentLevelXp: number;
    nextLevelXp: number;
    progressToNextLevel: number;
  };
  badges: Array<{
    id:
      | "first_task_done"
      | "task_finisher_50"
      | "execution_streak_7"
      | "reflection_streak_5"
      | "mission_week_4"
      | "carryover_recovery_10";
    tier: "bronze" | "silver" | "gold";
    progress: number;
    target: number;
    unlocked: boolean;
  }>;
  streakProtection: {
    availableCharges: number;
    maxCharges: number;
    earnedCharges: number;
    atRisk: boolean;
    recommended: boolean;
    projectedExecutionStreak: number;
    projectedReflectionStreak: number;
  };
  historicalTrends: {
    daily: Array<{
      label: string;
      rangeStart: string;
      rangeEnd: string;
      trackedDays: number;
      tasksDone: number;
      taskCompletionRate: number;
      affirmationCompletionRate: number;
      bilanCompletionRate: number;
      overallScore: number;
    }>;
    weekly: Array<{
      label: string;
      rangeStart: string;
      rangeEnd: string;
      trackedDays: number;
      tasksDone: number;
      taskCompletionRate: number;
      affirmationCompletionRate: number;
      bilanCompletionRate: number;
      overallScore: number;
    }>;
    monthly: Array<{
      label: string;
      rangeStart: string;
      rangeEnd: string;
      trackedDays: number;
      tasksDone: number;
      taskCompletionRate: number;
      affirmationCompletionRate: number;
      bilanCompletionRate: number;
      overallScore: number;
    }>;
  };
  engagement: {
    challenge: {
      id: "finish_10_tasks" | "complete_reflection_4_days" | "hit_consistency_60" | "close_carryover_3";
      target: number;
      progress: number;
      completed: boolean;
      rewardXp: number;
      expiresOn: string;
    };
    leaderboard: {
      rank: number;
      total: number;
      percentile: number;
      currentScore: number;
      topScore: number;
      entries: Array<{
        label: string;
        rangeStart: string;
        rangeEnd: string;
        score: number;
        tasksDone: number;
        reflectionDays: number;
        isCurrent: boolean;
      }>;
    };
    recap: {
      periodStart: string;
      periodEnd: string;
      headline: "strong_uptrend" | "steady_progress" | "downtrend_alert";
      highlights: Array<{
        id: "tasks_done" | "reflection_days" | "overall_score" | "execution_streak";
        value: number;
        delta: number | null;
      }>;
      focus: Array<
        "protect_streak" | "reduce_carryover" | "increase_reflection" | "increase_throughput" | "increase_consistency"
      >;
      generatedOn: string;
    };
    nudges: Array<{
      id: "streak_risk" | "carryover_pressure" | "momentum_positive" | "consistency_low" | "challenge_almost_done";
      severity: "info" | "warning" | "success";
      metric: number;
    }>;
  };
};

type CarryOverYesterdayPayload = {
  copiedCount: number;
  skippedCount: number;
  tasks: Task[];
};

type UserLocale = "en" | "fr";

type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  preferredLocale: UserLocale;
  preferredTimeZone: string | null;
  createdAt: string;
};

type AuthMode = "login" | "register";

type AuthFormValues = {
  email: string;
  password: string;
  displayName: string;
};

type ProfileFormValues = {
  displayName: string;
  preferredLocale: UserLocale;
  preferredTimeZone: string;
};

type ProfileMutationInput = {
  displayName: string | null;
  preferredLocale: UserLocale;
  preferredTimeZone: string | null;
};

type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  targetDate: string;
  priority: TaskPriority;
  project: string;
  plannedTime: string;
};

type RecurrenceFormValues = {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  interval: string;
  weekdays: number[];
  endsOn: string;
};

type TaskDialogMode = "create" | "edit";
type ApiErrorPayload = { error?: { message?: string } } | null;

class ApiRequestError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const AUTH_TOKEN_STORAGE_KEY = "jotly_auth_token";
const PROJECT_OPTIONS_STORAGE_KEY = "jotly_project_options";
const MAX_ATTACHMENT_UPLOAD_BYTES = 5 * 1024 * 1024;
const ASSISTANT_QUESTION_MAX_LENGTH = 3000;
const DAY_AFFIRMATION_MAX_LENGTH = 5000;
const DAY_BILAN_FIELD_MAX_LENGTH = 10000;
const USER_LOCALE_OPTIONS_BY_LOCALE: Record<UserLocale, ReadonlyArray<{ value: UserLocale; label: string }>> = {
  en: [
    { value: "en", label: "English" },
    { value: "fr", label: "French" },
  ],
  fr: [
    { value: "en", label: "Anglais" },
    { value: "fr", label: "Francais" },
  ],
};

const ASSISTANT_PROMPT_SUGGESTIONS_BY_LOCALE: Record<UserLocale, ReadonlyArray<string>> = {
  en: [
    "What should I prioritize across all my tasks?",
    "Create a realistic order for my open tasks this week.",
    "Which tasks look blocked and what should I unblock first?",
  ],
  fr: [
    "Quelles taches dois-je prioriser sur l'ensemble de mes jours ?",
    "Cree un ordre realiste pour mes taches ouvertes cette semaine.",
    "Quelles taches semblent bloquees et quoi debloquer en premier ?",
  ],
};

const DAILY_AFFIRMATION_SUGGESTIONS_BY_LOCALE: Record<UserLocale, ReadonlyArray<string>> = {
  en: [
    "I choose focus, discipline, and calm execution today.",
    "I finish what matters most before I move to new work.",
    "I am consistent, capable, and committed to meaningful progress.",
    "I protect deep work and handle distractions with intention.",
    "I act with clarity, energy, and confidence in every task.",
  ],
  fr: [
    "Je choisis la concentration, la discipline et une execution calme aujourd'hui.",
    "Je termine ce qui compte le plus avant de commencer autre chose.",
    "Je suis constant, capable et engage vers des progres utiles.",
    "Je protege mes sessions profondes et je gere les distractions avec intention.",
    "J'agis avec clarte, energie et confiance dans chaque tache.",
  ],
};

const BOARD_COLUMNS_BY_LOCALE: Record<
  UserLocale,
  ReadonlyArray<{
    status: TaskStatus;
    label: string;
    emptyLabel: string;
  }>
> = {
  en: [
    { status: "todo", label: "To Do", emptyLabel: "No tasks ready for this day." },
    { status: "in_progress", label: "In Progress", emptyLabel: "No tasks in progress." },
    { status: "done", label: "Done", emptyLabel: "Nothing completed yet." },
    { status: "cancelled", label: "Cancelled", emptyLabel: "No cancelled tasks." },
  ],
  fr: [
    { status: "todo", label: "A faire", emptyLabel: "Aucune tache prete pour ce jour." },
    { status: "in_progress", label: "En cours", emptyLabel: "Aucune tache en cours." },
    { status: "done", label: "Terminee", emptyLabel: "Rien de termine pour le moment." },
    { status: "cancelled", label: "Annulee", emptyLabel: "Aucune tache annulee." },
  ],
};

const PRIORITY_OPTIONS_BY_LOCALE: Record<UserLocale, ReadonlyArray<{ value: TaskPriority; label: string }>> = {
  en: [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ],
  fr: [
    { value: "low", label: "Basse" },
    { value: "medium", label: "Moyenne" },
    { value: "high", label: "Haute" },
  ],
};

const RECURRENCE_FREQUENCY_OPTIONS_BY_LOCALE: Record<
  UserLocale,
  ReadonlyArray<{ value: RecurrenceFrequency; label: string }>
> = {
  en: [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ],
  fr: [
    { value: "daily", label: "Quotidienne" },
    { value: "weekly", label: "Hebdomadaire" },
    { value: "monthly", label: "Mensuelle" },
  ],
};

const WEEKDAY_OPTIONS_BY_LOCALE: Record<UserLocale, ReadonlyArray<{ value: number; label: string }>> = {
  en: [
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ],
  fr: [
    { value: 0, label: "Dim" },
    { value: 1, label: "Lun" },
    { value: 2, label: "Mar" },
    { value: 3, label: "Mer" },
    { value: 4, label: "Jeu" },
    { value: 5, label: "Ven" },
    { value: 6, label: "Sam" },
  ],
};

const GAMING_TRACK_PERIOD_OPTIONS_BY_LOCALE: Record<
  UserLocale,
  ReadonlyArray<{ value: GamingTrackPeriod; label: string }>
> = {
  en: [
    { value: "day", label: "D" },
    { value: "week", label: "W" },
    { value: "month", label: "M" },
    { value: "year", label: "Y" },
  ],
  fr: [
    { value: "day", label: "J" },
    { value: "week", label: "S" },
    { value: "month", label: "M" },
    { value: "year", label: "A" },
  ],
};

const BOARD_COLUMN_STATUSES = new Set<TaskStatus>(["todo", "in_progress", "done", "cancelled"]);
const PRIORITY_VALUES = new Set<TaskPriority>(["low", "medium", "high"]);
const RECURRENCE_FREQUENCY_VALUES = new Set<RecurrenceFrequency>(["daily", "weekly", "monthly"]);

const statusChipClassByStatus: Record<TaskStatus, string> = {
  todo: "border-sky-200 bg-sky-50 text-sky-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-slate-300 bg-slate-100 text-slate-600",
};

const statusColumnClassByStatus: Record<TaskStatus, string> = {
  todo: "border-t-sky-300",
  in_progress: "border-t-amber-300",
  done: "border-t-emerald-300",
  cancelled: "border-t-slate-300",
};

const statusDropClassByStatus: Record<TaskStatus, string> = {
  todo: "bg-sky-100/70",
  in_progress: "bg-amber-100/70",
  done: "bg-emerald-100/70",
  cancelled: "bg-slate-200/70",
};

const priorityChipClassByPriority: Record<TaskPriority, string> = {
  low: "border border-slate-300 bg-slate-100 text-slate-700",
  medium: "border border-indigo-200 bg-indigo-50 text-indigo-700",
  high: "border border-rose-200 bg-rose-50 text-rose-700",
};

const controlButtonClass =
  "inline-flex items-center justify-center rounded-xl border border-line bg-surface-soft px-3.5 py-2 text-sm font-semibold text-foreground/85 transition hover:border-accent/45 hover:bg-accent-soft/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-55";
const primaryButtonClass =
  "inline-flex items-center justify-center rounded-xl border border-accent/70 bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:border-accent-strong hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-55";
const dangerButtonClass =
  "inline-flex items-center justify-center rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-55";
const textFieldClass =
  "mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-55";
const iconButtonClass =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-line bg-surface px-2 text-xs font-semibold text-foreground/85 transition hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-55";

const markdownToolbarActions: ReadonlyArray<{ id: string; label: string; title: string }> = [
  { id: "bold", label: "B", title: "Bold" },
  { id: "italic", label: "I", title: "Italic" },
  { id: "code", label: "</>", title: "Inline code" },
  { id: "bullet", label: "- List", title: "Bulleted list" },
  { id: "numbered", label: "1. List", title: "Numbered list" },
  { id: "quote", label: "Quote", title: "Quote" },
  { id: "link", label: "Link", title: "Insert link" },
];

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function shiftDate(value: string, offsetDays: number): string {
  const shifted = parseDateInput(value);
  shifted.setDate(shifted.getDate() + offsetDays);
  return toDateInputValue(shifted);
}

function getPreferredLocale(value: string | null | undefined): UserLocale {
  if (typeof value !== "string") {
    return "en";
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "fr" || normalized.startsWith("fr-") ? "fr" : "en";
}

function getLocaleForFormatting(locale: UserLocale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

function getUserLocaleOptions(locale: UserLocale): ReadonlyArray<{ value: UserLocale; label: string }> {
  return USER_LOCALE_OPTIONS_BY_LOCALE[locale];
}

function getAssistantPromptSuggestions(locale: UserLocale): ReadonlyArray<string> {
  return ASSISTANT_PROMPT_SUGGESTIONS_BY_LOCALE[locale];
}

function getBoardColumns(locale: UserLocale): ReadonlyArray<{
  status: TaskStatus;
  label: string;
  emptyLabel: string;
}> {
  return BOARD_COLUMNS_BY_LOCALE[locale];
}

function getPriorityOptions(locale: UserLocale): ReadonlyArray<{ value: TaskPriority; label: string }> {
  return PRIORITY_OPTIONS_BY_LOCALE[locale];
}

function getRecurrenceFrequencyOptions(
  locale: UserLocale
): ReadonlyArray<{ value: RecurrenceFrequency; label: string }> {
  return RECURRENCE_FREQUENCY_OPTIONS_BY_LOCALE[locale];
}

function getWeekdayOptions(locale: UserLocale): ReadonlyArray<{ value: number; label: string }> {
  return WEEKDAY_OPTIONS_BY_LOCALE[locale];
}

function getGamingTrackPeriodOptions(
  locale: UserLocale
): ReadonlyArray<{ value: GamingTrackPeriod; label: string }> {
  return GAMING_TRACK_PERIOD_OPTIONS_BY_LOCALE[locale];
}

function isValidIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
}

function getDateHeading(value: string, locale: UserLocale): string {
  return new Intl.DateTimeFormat(getLocaleForFormatting(locale), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parseDateInput(value));
}

function getDefaultAffirmationText(targetDate: string, locale: UserLocale): string {
  const suggestions = DAILY_AFFIRMATION_SUGGESTIONS_BY_LOCALE[locale];
  const segments = targetDate.split("-").map((segment) => Number(segment));
  const seed = segments.reduce((total, current) => total + (Number.isNaN(current) ? 0 : current), 0);
  const index = seed % suggestions.length;
  return suggestions[index];
}

function formatDateTime(value: string, locale: UserLocale, timeZone: string | null): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(getLocaleForFormatting(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(parsed);
}

function formatDateOnlyForLocale(value: string, locale: UserLocale): string {
  return new Intl.DateTimeFormat(getLocaleForFormatting(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseDateInput(value));
}

function formatSignedDelta(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `${value}`;
  }

  return "0";
}

function formatGamingTrackPeriod(period: GamingTrackPeriod, locale: UserLocale): string {
  if (locale === "fr") {
    if (period === "day") {
      return "Jour";
    }
    if (period === "week") {
      return "Semaine";
    }
    if (period === "month") {
      return "Mois";
    }
    return "Annee";
  }

  if (period === "day") {
    return "Day";
  }
  if (period === "week") {
    return "Week";
  }
  if (period === "month") {
    return "Month";
  }
  return "Year";
}

function formatGamingTrackMissionLabel(
  missionId: GamingTrackSummary["missions"][number]["id"],
  locale: UserLocale
): string {
  if (locale === "fr") {
    if (missionId === "done_tasks") {
      return "Taches terminees";
    }
    if (missionId === "affirmation_days") {
      return "Jours avec affirmation";
    }
    if (missionId === "bilan_days") {
      return "Jours avec bilan";
    }
    return "Serie d'execution";
  }

  if (missionId === "done_tasks") {
    return "Tasks done";
  }
  if (missionId === "affirmation_days") {
    return "Affirmation days";
  }
  if (missionId === "bilan_days") {
    return "Bilan days";
  }
  return "Execution streak";
}

function formatGamingTrackBadgeLabel(
  badgeId: GamingTrackSummary["badges"][number]["id"],
  locale: UserLocale
): string {
  if (locale === "fr") {
    if (badgeId === "first_task_done") {
      return "Premier succes";
    }
    if (badgeId === "task_finisher_50") {
      return "50 taches terminees";
    }
    if (badgeId === "execution_streak_7") {
      return "Serie execution 7";
    }
    if (badgeId === "reflection_streak_5") {
      return "Serie reflection 5";
    }
    if (badgeId === "mission_week_4") {
      return "4 semaines mission";
    }
    return "Recuperation reprise x10";
  }

  if (badgeId === "first_task_done") {
    return "First win";
  }
  if (badgeId === "task_finisher_50") {
    return "50 tasks done";
  }
  if (badgeId === "execution_streak_7") {
    return "7-day execution streak";
  }
  if (badgeId === "reflection_streak_5") {
    return "5-day reflection streak";
  }
  if (badgeId === "mission_week_4") {
    return "4 mission weeks";
  }
  return "Carry-over recovery x10";
}

function formatGamingTrackRank(
  rank: GamingTrackSummary["level"]["rank"],
  locale: UserLocale
): string {
  if (locale === "fr") {
    if (rank === "rookie") {
      return "Debutant";
    }
    if (rank === "builder") {
      return "Constructeur";
    }
    if (rank === "operator") {
      return "Operateur";
    }
    if (rank === "strategist") {
      return "Strategiste";
    }
    return "Maitre";
  }

  if (rank === "rookie") {
    return "Rookie";
  }
  if (rank === "builder") {
    return "Builder";
  }
  if (rank === "operator") {
    return "Operator";
  }
  if (rank === "strategist") {
    return "Strategist";
  }
  return "Master";
}

function getBadgeTierClass(tier: GamingTrackSummary["badges"][number]["tier"], unlocked: boolean): string {
  if (!unlocked) {
    return "border-line bg-surface text-muted";
  }

  if (tier === "gold") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  if (tier === "silver") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  return "border-orange-300 bg-orange-50 text-orange-800";
}

function getHistoricalTrendPointsForPeriod(summary: GamingTrackSummary, period: GamingTrackPeriod) {
  if (period === "day") {
    return summary.historicalTrends.daily;
  }

  if (period === "week") {
    return summary.historicalTrends.weekly;
  }

  return summary.historicalTrends.monthly;
}

function formatHistoricalTrendLabel(
  point: GamingTrackSummary["historicalTrends"]["daily"][number],
  period: GamingTrackPeriod,
  locale: UserLocale
): string {
  if (period === "day") {
    return formatDateOnlyForLocale(point.rangeStart, locale);
  }

  if (period === "week") {
    return formatDateOnlyForLocale(point.rangeStart, locale);
  }

  return new Intl.DateTimeFormat(getLocaleForFormatting(locale), {
    month: "short",
    year: "2-digit",
  }).format(parseDateInput(point.rangeStart));
}

function formatGamingTrackChallengeLabel(
  challengeId: GamingTrackSummary["engagement"]["challenge"]["id"],
  locale: UserLocale
): string {
  if (locale === "fr") {
    if (challengeId === "finish_10_tasks") {
      return "Terminer 10 taches";
    }
    if (challengeId === "complete_reflection_4_days") {
      return "Reflection 4 jours";
    }
    if (challengeId === "hit_consistency_60") {
      return "Consistance 60";
    }
    return "Clore 3 reprises";
  }

  if (challengeId === "finish_10_tasks") {
    return "Finish 10 tasks";
  }
  if (challengeId === "complete_reflection_4_days") {
    return "4 reflection days";
  }
  if (challengeId === "hit_consistency_60") {
    return "Reach consistency 60";
  }
  return "Close 3 carry-overs";
}

function formatGamingTrackRecapHeadline(
  headline: GamingTrackSummary["engagement"]["recap"]["headline"],
  locale: UserLocale
): string {
  if (locale === "fr") {
    if (headline === "strong_uptrend") {
      return "Progression forte cette semaine";
    }
    if (headline === "downtrend_alert") {
      return "Ralentissement a corriger";
    }
    return "Progression stable";
  }

  if (headline === "strong_uptrend") {
    return "Strong upward trend this week";
  }
  if (headline === "downtrend_alert") {
    return "Downtrend to recover quickly";
  }
  return "Stable progress";
}

function formatGamingTrackRecapFocus(
  focusId: GamingTrackSummary["engagement"]["recap"]["focus"][number],
  locale: UserLocale
): string {
  if (locale === "fr") {
    if (focusId === "protect_streak") {
      return "Proteger la serie";
    }
    if (focusId === "reduce_carryover") {
      return "Reduire les reprises";
    }
    if (focusId === "increase_reflection") {
      return "Renforcer la reflection";
    }
    if (focusId === "increase_consistency") {
      return "Ameliorer la consistance";
    }
    return "Augmenter le volume execute";
  }

  if (focusId === "protect_streak") {
    return "Protect your streak";
  }
  if (focusId === "reduce_carryover") {
    return "Reduce carry-over";
  }
  if (focusId === "increase_reflection") {
    return "Increase reflection days";
  }
  if (focusId === "increase_consistency") {
    return "Increase consistency";
  }
  return "Increase throughput";
}

function formatGamingTrackRecapHighlightLabel(
  highlightId: GamingTrackSummary["engagement"]["recap"]["highlights"][number]["id"],
  locale: UserLocale
): string {
  if (locale === "fr") {
    if (highlightId === "tasks_done") {
      return "Taches terminees";
    }
    if (highlightId === "reflection_days") {
      return "Jours reflection";
    }
    if (highlightId === "overall_score") {
      return "Score global";
    }
    return "Serie execution";
  }

  if (highlightId === "tasks_done") {
    return "Tasks done";
  }
  if (highlightId === "reflection_days") {
    return "Reflection days";
  }
  if (highlightId === "overall_score") {
    return "Overall score";
  }
  return "Execution streak";
}

function formatGamingTrackNudgeLabel(
  nudgeId: GamingTrackSummary["engagement"]["nudges"][number]["id"],
  locale: UserLocale
): string {
  if (locale === "fr") {
    if (nudgeId === "streak_risk") {
      return "Serie en risque";
    }
    if (nudgeId === "carryover_pressure") {
      return "Pression de reprises";
    }
    if (nudgeId === "consistency_low") {
      return "Consistance faible";
    }
    if (nudgeId === "challenge_almost_done") {
      return "Challenge presque fini";
    }
    return "Momentum positif";
  }

  if (nudgeId === "streak_risk") {
    return "Streak at risk";
  }
  if (nudgeId === "carryover_pressure") {
    return "Carry-over pressure";
  }
  if (nudgeId === "consistency_low") {
    return "Consistency is low";
  }
  if (nudgeId === "challenge_almost_done") {
    return "Challenge almost done";
  }
  return "Positive momentum";
}

function getGamingTrackNudgeClass(
  severity: GamingTrackSummary["engagement"]["nudges"][number]["severity"]
): string {
  if (severity === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  if (severity === "success") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  return "border-line bg-surface text-muted";
}

function formatPriority(priority: TaskPriority, locale: UserLocale): string {
  return getPriorityOptions(locale).find((option) => option.value === priority)?.label ?? priority;
}

function formatTaskStatus(status: TaskStatus, locale: UserLocale): string {
  return getBoardColumns(locale).find((column) => column.status === status)?.label ?? status;
}

function formatPlannedTime(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const kb = sizeBytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

function isDataUrl(value: string): boolean {
  return value.startsWith("data:");
}

function isTaskStatus(value: string): value is TaskStatus {
  return BOARD_COLUMN_STATUSES.has(value as TaskStatus);
}

function isTaskPriority(value: string): value is TaskPriority {
  return PRIORITY_VALUES.has(value as TaskPriority);
}

function isRecurrenceFrequency(value: string): value is RecurrenceFrequency {
  return RECURRENCE_FREQUENCY_VALUES.has(value as RecurrenceFrequency);
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeOptionalTextInput(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function getUniqueSortedProjectNames(values: string[]): string[] {
  const seen = new Set<string>();
  const uniqueNames: string[] = [];

  for (const value of values) {
    const normalized = normalizeProjectName(value);

    if (!normalized) {
      continue;
    }

    const key = normalized.toLocaleLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueNames.push(normalized);
  }

  return uniqueNames.sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}

function parseStoredProjectOptions(rawValue: string | null): string[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    const textValues = parsed.filter((value): value is string => typeof value === "string");
    return getUniqueSortedProjectNames(textValues);
  } catch {
    return [];
  }
}

function areStringListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInlineMarkdown(value: string): string {
  let formatted = escapeHtml(value);

  formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, text: string, url: string) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return formatted;
}

function renderDescriptionHtml(markdown: string): string {
  const trimmed = markdown.trim();

  if (!trimmed) {
    return "";
  }

  const lines = trimmed.split(/\r?\n/);
  const htmlParts: string[] = [];
  let inList: "ul" | "ol" | null = null;

  function closeList() {
    if (inList) {
      htmlParts.push(`</${inList}>`);
      inList = null;
    }
  }

  for (const line of lines) {
    const cleanLine = line.trim();

    if (!cleanLine) {
      closeList();
      continue;
    }

    if (/^[-*]\s+/.test(cleanLine)) {
      if (inList !== "ul") {
        closeList();
        htmlParts.push("<ul>");
        inList = "ul";
      }

      htmlParts.push(`<li>${formatInlineMarkdown(cleanLine.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(cleanLine)) {
      if (inList !== "ol") {
        closeList();
        htmlParts.push("<ol>");
        inList = "ol";
      }

      htmlParts.push(`<li>${formatInlineMarkdown(cleanLine.replace(/^\d+\.\s+/, ""))}</li>`);
      continue;
    }

    closeList();

    if (/^>\s+/.test(cleanLine)) {
      htmlParts.push(`<blockquote>${formatInlineMarkdown(cleanLine.replace(/^>\s+/, ""))}</blockquote>`);
      continue;
    }

    htmlParts.push(`<p>${formatInlineMarkdown(cleanLine)}</p>`);
  }

  closeList();

  return htmlParts.join("");
}

function getApiErrorMessage(statusCode: number, payload: ApiErrorPayload, fallback: string): string {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  return `${fallback} (HTTP ${statusCode}).`;
}

function getDefaultTaskFormValues(targetDate: string): TaskFormValues {
  return {
    title: "",
    description: "",
    status: "todo",
    targetDate,
    priority: "medium",
    project: "",
    plannedTime: "",
  };
}

function getDefaultRecurrenceFormValues(): RecurrenceFormValues {
  return {
    enabled: false,
    frequency: "daily",
    interval: "1",
    weekdays: [],
    endsOn: "",
  };
}

function getDefaultDayBilanFormValues(): DayBilanFormValues {
  return {
    mood: "",
    wins: "",
    blockers: "",
    lessonsLearned: "",
    tomorrowTop3: "",
  };
}

function getDayBilanFormValues(bilan: DayBilan | null): DayBilanFormValues {
  if (!bilan) {
    return getDefaultDayBilanFormValues();
  }

  return {
    mood: typeof bilan.mood === "number" ? String(bilan.mood) : "",
    wins: bilan.wins ?? "",
    blockers: bilan.blockers ?? "",
    lessonsLearned: bilan.lessonsLearned ?? "",
    tomorrowTop3: bilan.tomorrowTop3 ?? "",
  };
}

function normalizeOptionalLongTextInput(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildDayBilanMutationInput(
  values: DayBilanFormValues,
  date: string,
  locale: UserLocale = "en"
): { data?: DayBilanMutationInput; error?: string } {
  const isFrench = locale === "fr";

  if (!isDateOnly(date)) {
    return {
      error: isFrench
        ? "La date doit respecter le format AAAA-MM-JJ."
        : "Date must be in YYYY-MM-DD format.",
    };
  }

  let mood: number | null = null;
  const moodValue = values.mood.trim();

  if (moodValue.length > 0) {
    const parsedMood = Number(moodValue);

    if (!Number.isInteger(parsedMood) || parsedMood < 1 || parsedMood > 5) {
      return {
        error: isFrench ? "L'humeur doit etre une valeur entre 1 et 5." : "Mood must be a value between 1 and 5.",
      };
    }

    mood = parsedMood;
  }

  return {
    data: {
      date,
      mood,
      wins: normalizeOptionalLongTextInput(values.wins),
      blockers: normalizeOptionalLongTextInput(values.blockers),
      lessonsLearned: normalizeOptionalLongTextInput(values.lessonsLearned),
      tomorrowTop3: normalizeOptionalLongTextInput(values.tomorrowTop3),
    },
  };
}

function getRecurrenceFormValues(rule: TaskRecurrenceRule | null): RecurrenceFormValues {
  if (!rule) {
    return getDefaultRecurrenceFormValues();
  }

  return {
    enabled: true,
    frequency: rule.frequency,
    interval: String(rule.interval),
    weekdays: [...rule.weekdays].sort((left, right) => left - right),
    endsOn: rule.endsOn ?? "",
  };
}

function getTaskFormValues(task: Task): TaskFormValues {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    targetDate: task.targetDate,
    priority: task.priority,
    project: task.project ?? "",
    plannedTime: typeof task.plannedTime === "number" ? String(task.plannedTime) : "",
  };
}

function buildTaskMutationInput(
  values: TaskFormValues,
  locale: UserLocale = "en"
): { data?: TaskMutationInput; error?: string } {
  const isFrench = locale === "fr";
  const title = values.title.trim();
  if (!title) {
    return { error: isFrench ? "Le titre est requis." : "Title is required." };
  }

  if (!isDateOnly(values.targetDate)) {
    return {
      error: isFrench
        ? "La date cible doit respecter le format AAAA-MM-JJ."
        : "Target date must be in YYYY-MM-DD format.",
    };
  }

  if (!isTaskStatus(values.status)) {
    return { error: isFrench ? "Le statut est invalide." : "Status is invalid." };
  }

  if (!isTaskPriority(values.priority)) {
    return { error: isFrench ? "La priorite est invalide." : "Priority is invalid." };
  }

  const plannedTimeValue = values.plannedTime.trim();
  let plannedTime: number | null = null;

  if (plannedTimeValue) {
    const parsed = Number(plannedTimeValue);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return {
        error: isFrench
          ? "Le temps planifie doit etre un entier positif ou nul."
          : "Planned time must be a non-negative integer.",
      };
    }

    plannedTime = parsed;
  }

  return {
    data: {
      title,
      description: normalizeOptionalTextInput(values.description),
      status: values.status,
      targetDate: values.targetDate,
      priority: values.priority,
      project: normalizeOptionalTextInput(values.project),
      plannedTime,
    },
  };
}

function buildRecurrenceMutationInput(
  values: RecurrenceFormValues,
  locale: UserLocale = "en"
): { data?: TaskRecurrenceMutationInput; error?: string } {
  const isFrench = locale === "fr";

  if (!values.enabled) {
    return {};
  }

  if (!isRecurrenceFrequency(values.frequency)) {
    return { error: isFrench ? "La frequence de recurrence est invalide." : "Recurrence frequency is invalid." };
  }

  const intervalValue = values.interval.trim();
  const interval = Number(intervalValue);

  if (!intervalValue || !Number.isInteger(interval) || interval < 1) {
    return {
      error: isFrench
        ? "L'intervalle de recurrence doit etre un entier superieur ou egal a 1."
        : "Recurrence interval must be an integer greater than or equal to 1.",
    };
  }

  const normalizedWeekdays = [...values.weekdays].sort((left, right) => left - right);

  if (values.frequency === "weekly" && normalizedWeekdays.length === 0) {
    return {
      error: isFrench
        ? "Selectionnez au moins un jour pour une recurrence hebdomadaire."
        : "Select at least one weekday for weekly recurrence.",
    };
  }

  if (!values.endsOn.trim()) {
    return {
      data: {
        frequency: values.frequency,
        interval,
        weekdays: values.frequency === "weekly" ? normalizedWeekdays : [],
        endsOn: null,
      },
    };
  }

  if (!isDateOnly(values.endsOn.trim())) {
    return {
      error: isFrench
        ? "La date de fin de recurrence doit respecter le format AAAA-MM-JJ."
        : "Recurrence end date must be in YYYY-MM-DD format.",
    };
  }

  return {
    data: {
      frequency: values.frequency,
      interval,
      weekdays: values.frequency === "weekly" ? normalizedWeekdays : [],
      endsOn: values.endsOn.trim(),
    },
  };
}

function normalizeAuthUser(user: AuthUser): AuthUser {
  const preferredTimeZone =
    typeof user.preferredTimeZone === "string" && user.preferredTimeZone.trim() !== ""
      ? user.preferredTimeZone.trim()
      : null;

  return {
    ...user,
    preferredLocale: getPreferredLocale(user.preferredLocale),
    preferredTimeZone,
  };
}

function getDefaultProfileFormValues(): ProfileFormValues {
  return {
    displayName: "",
    preferredLocale: "en",
    preferredTimeZone: getBrowserTimeZone(),
  };
}

function getProfileFormValues(user: AuthUser | null): ProfileFormValues {
  if (!user) {
    return getDefaultProfileFormValues();
  }

  return {
    displayName: user.displayName ?? "",
    preferredLocale: getPreferredLocale(user.preferredLocale),
    preferredTimeZone: user.preferredTimeZone ?? getBrowserTimeZone(),
  };
}

function createAuthHeaders(token: string, includesJsonBody: boolean): HeadersInit {
  return {
    ...(includesJsonBody ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Unable to read selected file."));
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read selected file."));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

async function registerUser(values: AuthFormValues): Promise<{ user: AuthUser; token: string }> {
  const response = await fetch("/backend-api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: values.email.trim(),
      password: values.password,
      displayName: values.displayName.trim() || null,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { user: AuthUser; token: string }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to register"));
  }

  if (!payload?.data) {
    throw new Error("Unable to register.");
  }

  return {
    ...payload.data,
    user: normalizeAuthUser(payload.data.user),
  };
}

async function loginUser(values: AuthFormValues): Promise<{ user: AuthUser; token: string }> {
  const response = await fetch("/backend-api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: values.email.trim(),
      password: values.password,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { user: AuthUser; token: string }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to login"));
  }

  if (!payload?.data) {
    throw new Error("Unable to login.");
  }

  return {
    ...payload.data,
    user: normalizeAuthUser(payload.data.user),
  };
}

async function loadCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch("/backend-api/auth/me", {
    method: "GET",
    headers: createAuthHeaders(token, false),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { user?: AuthUser }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      getApiErrorMessage(response.status, payload, "Unable to validate session")
    );
  }

  if (!payload?.data?.user) {
    throw new Error("Unable to validate session.");
  }

  return normalizeAuthUser(payload.data.user);
}

async function updateProfile(input: ProfileMutationInput, token: string): Promise<AuthUser> {
  const response = await fetch("/backend-api/profile", {
    method: "PATCH",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: AuthUser; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to update profile"));
  }

  if (!payload?.data) {
    throw new Error("Unable to update profile.");
  }

  return normalizeAuthUser(payload.data);
}

async function logoutUser(token: string): Promise<void> {
  const response = await fetch("/backend-api/auth/logout", {
    method: "POST",
    headers: createAuthHeaders(token, false),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload;
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to logout"));
  }
}

async function loadTasksByDate(date: string, token: string, signal?: AbortSignal): Promise<Task[]> {
  const response = await fetch(`/backend-api/tasks?date=${encodeURIComponent(date)}`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    signal,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Task[]; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load tasks for this date"));
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

async function createTask(input: TaskMutationInput, token: string): Promise<Task> {
  const response = await fetch("/backend-api/tasks", {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Task; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to create task"));
  }

  if (!payload?.data) {
    throw new Error("Unable to create task.");
  }

  return payload.data;
}

async function updateTask(taskId: string, input: TaskMutationInput, token: string): Promise<Task> {
  const response = await fetch(`/backend-api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Task; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to update task"));
  }

  if (!payload?.data) {
    throw new Error("Unable to update task.");
  }

  return payload.data;
}

async function deleteTaskById(taskId: string, token: string): Promise<void> {
  const response = await fetch(`/backend-api/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
    headers: createAuthHeaders(token, false),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Task; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to delete task"));
  }
}

async function updateTaskStatus(taskId: string, status: TaskStatus, token: string): Promise<Task> {
  const response = await fetch(`/backend-api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({ status }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Task; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to move task"));
  }

  if (!payload?.data) {
    throw new Error("Unable to move task.");
  }

  return payload.data;
}

async function loadTaskComments(taskId: string, token: string): Promise<TaskComment[]> {
  const response = await fetch(`/backend-api/tasks/${encodeURIComponent(taskId)}/comments`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: TaskComment[]; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load comments"));
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

async function createTaskComment(taskId: string, body: string, token: string): Promise<TaskComment> {
  const response = await fetch(`/backend-api/tasks/${encodeURIComponent(taskId)}/comments`, {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({ body }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: TaskComment; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to create comment"));
  }

  if (!payload?.data) {
    throw new Error("Unable to create comment.");
  }

  return payload.data;
}

async function deleteTaskComment(taskId: string, commentId: string, token: string): Promise<void> {
  const response = await fetch(
    `/backend-api/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: "DELETE",
      headers: createAuthHeaders(token, false),
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | { data?: TaskComment; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to delete comment"));
  }
}

async function loadTaskAttachments(taskId: string, token: string): Promise<TaskAttachment[]> {
  const response = await fetch(`/backend-api/tasks/${encodeURIComponent(taskId)}/attachments`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: TaskAttachment[]; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load attachments"));
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

async function createTaskAttachment(
  taskId: string,
  input: TaskAttachmentMutationInput,
  token: string
): Promise<TaskAttachment> {
  const fileDataUrl = await readFileAsDataUrl(input.file);

  const response = await fetch(`/backend-api/tasks/${encodeURIComponent(taskId)}/attachments`, {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({
      name: input.name,
      url: fileDataUrl,
      contentType: input.file.type || null,
      sizeBytes: input.file.size,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: TaskAttachment; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to create attachment"));
  }

  if (!payload?.data) {
    throw new Error("Unable to create attachment.");
  }

  return payload.data;
}

async function deleteTaskAttachment(taskId: string, attachmentId: string, token: string): Promise<void> {
  const response = await fetch(
    `/backend-api/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`,
    {
      method: "DELETE",
      headers: createAuthHeaders(token, false),
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | { data?: TaskAttachment; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to delete attachment"));
  }
}

async function loadTaskRecurrence(taskId: string, token: string): Promise<TaskRecurrenceRule | null> {
  const response = await fetch(`/backend-api/tasks/${encodeURIComponent(taskId)}/recurrence`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: TaskRecurrenceRule | null; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load recurrence settings"));
  }

  return payload?.data ?? null;
}

async function upsertTaskRecurrence(
  taskId: string,
  input: TaskRecurrenceMutationInput,
  token: string
): Promise<TaskRecurrenceRule> {
  const response = await fetch(`/backend-api/tasks/${encodeURIComponent(taskId)}/recurrence`, {
    method: "PUT",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: TaskRecurrenceRule; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to save recurrence settings"));
  }

  if (!payload?.data) {
    throw new Error("Unable to save recurrence settings.");
  }

  return payload.data;
}

async function deleteTaskRecurrence(taskId: string, token: string): Promise<void> {
  const response = await fetch(`/backend-api/tasks/${encodeURIComponent(taskId)}/recurrence`, {
    method: "DELETE",
    headers: createAuthHeaders(token, false),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: TaskRecurrenceRule | null; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to remove recurrence settings"));
  }
}

async function requestAssistantReply(
  question: string,
  token: string,
  locale: UserLocale
): Promise<AssistantReplyPayload> {
  const response = await fetch("/backend-api/assistant/reply", {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({
      question,
      locale,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: AssistantReplyPayload; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to generate assistant reply"));
  }

  if (!payload?.data) {
    throw new Error("Unable to generate assistant reply.");
  }

  return payload.data;
}

async function loadDayAffirmation(
  date: string,
  token: string,
  signal?: AbortSignal
): Promise<DayAffirmation | null> {
  const response = await fetch(`/backend-api/day-affirmation?date=${encodeURIComponent(date)}`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    signal,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: DayAffirmation | null; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load day affirmation"));
  }

  return payload?.data ?? null;
}

async function upsertDayAffirmation(
  input: { date: string; text: string; isCompleted: boolean },
  token: string
): Promise<DayAffirmation> {
  const response = await fetch("/backend-api/day-affirmation", {
    method: "PUT",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: DayAffirmation; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to save day affirmation"));
  }

  if (!payload?.data) {
    throw new Error("Unable to save day affirmation.");
  }

  return payload.data;
}

async function carryOverYesterdayTasks(targetDate: string, token: string): Promise<CarryOverYesterdayPayload> {
  const response = await fetch("/backend-api/tasks/carry-over-yesterday", {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({
      targetDate,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: CarryOverYesterdayPayload; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to carry over yesterday tasks"));
  }

  if (!payload?.data) {
    throw new Error("Unable to carry over yesterday tasks.");
  }

  return payload.data;
}

async function loadDayBilan(
  date: string,
  token: string,
  signal?: AbortSignal
): Promise<DayBilan | null> {
  const response = await fetch(`/backend-api/day-bilan?date=${encodeURIComponent(date)}`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    signal,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: DayBilan | null; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load day bilan"));
  }

  return payload?.data ?? null;
}

async function upsertDayBilan(input: DayBilanMutationInput, token: string): Promise<DayBilan> {
  const response = await fetch("/backend-api/day-bilan", {
    method: "PUT",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: DayBilan; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to save day bilan"));
  }

  if (!payload?.data) {
    throw new Error("Unable to save day bilan.");
  }

  return payload.data;
}

async function loadGamingTrackSummary(
  date: string,
  period: GamingTrackPeriod,
  token: string,
  signal?: AbortSignal
): Promise<GamingTrackSummary> {
  const response = await fetch(
    `/backend-api/gaming-track/summary?date=${encodeURIComponent(date)}&period=${encodeURIComponent(period)}`,
    {
      method: "GET",
      headers: createAuthHeaders(token, false),
      signal,
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | { data?: GamingTrackSummary; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load gaming track summary"));
  }

  if (!payload?.data) {
    throw new Error("Unable to load gaming track summary.");
  }

  return payload.data;
}

type AppNavbarProps = {
  locale: UserLocale;
  user: AuthUser | null;
  onLogout?: () => void;
  onOpenProfile?: () => void;
  onLogin?: () => void;
  isBusy?: boolean;
};

function ProfileGlyph({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (isLoggedIn) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 19c1.2-3.1 3.8-4.7 7-4.7s5.8 1.6 7 4.7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M11 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
      <path d="M13 8l4 4-4 4" />
      <path d="M7 12h10" />
    </svg>
  );
}

function AppNavbar({ locale, user, onLogout, onOpenProfile, onLogin, isBusy = false }: AppNavbarProps) {
  const isLoggedIn = user !== null;
  const isFrench = locale === "fr";
  const profileLabel = user?.displayName ?? user?.email ?? (isFrench ? "Invite" : "Guest");

  return (
    <nav className="mb-4 flex items-center justify-between rounded-2xl border border-line bg-surface/92 px-4 py-3 shadow-[0_18px_45px_-34px_rgba(16,34,48,0.7)] backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-sm font-bold text-white shadow-sm">J</div>
        <div>
          <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
          <p className="text-xs text-muted">
            {isLoggedIn
              ? isFrench
                ? "Espace de planification"
                : "Planner workspace"
              : isFrench
              ? "Connectez-vous pour continuer"
              : "Sign in to continue"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-soft px-2 py-1">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-surface text-muted">
            <ProfileGlyph isLoggedIn={isLoggedIn} />
          </span>
          <span className="max-w-[180px] truncate pr-1 text-xs font-semibold text-foreground">{profileLabel}</span>
        </div>

        {isLoggedIn ? (
          <>
            <button
              type="button"
              className={controlButtonClass}
              onClick={onOpenProfile}
              disabled={isBusy || !onOpenProfile}
            >
              {isFrench ? "Profil" : "Profile"}
            </button>
            <button type="button" className={controlButtonClass} onClick={onLogout} disabled={isBusy || !onLogout}>
              {isFrench ? "Deconnexion" : "Logout"}
            </button>
          </>
        ) : (
          <button type="button" className={controlButtonClass} onClick={onLogin} disabled={isBusy || !onLogin}>
            {isFrench ? "Connexion" : "Login"}
          </button>
        )}
      </div>
    </nav>
  );
}

type RichTextEditorProps = {
  locale: UserLocale;
  value: string;
  disabled: boolean;
  onChange: (nextValue: string) => void;
};

function RichTextEditor({ locale, value, disabled, onChange }: RichTextEditorProps) {
  const isFrench = locale === "fr";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function updateValueAndSelection(nextValue: string, selectionStart: number, selectionEnd: number) {
    onChange(nextValue);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function applyInlineDecoration(prefix: string, suffix = prefix) {
    if (disabled) {
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || (isFrench ? "texte" : "text");
    const replacement = `${prefix}${selected}${suffix}`;
    const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;

    updateValueAndSelection(nextValue, start + prefix.length, start + prefix.length + selected.length);
  }

  function applyLinePrefix(prefixForLine: (lineIndex: number) => string) {
    if (disabled) {
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const rawStart = textarea.selectionStart;
    const rawEnd = textarea.selectionEnd;
    const blockStart = value.lastIndexOf("\n", Math.max(0, rawStart - 1)) + 1;
    const lineEndIndex = value.indexOf("\n", rawEnd);
    const blockEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const block = value.slice(blockStart, blockEnd);
    const lines = block.split("\n");
    const updatedBlock = lines.map((line, index) => `${prefixForLine(index)}${line}`).join("\n");
    const nextValue = `${value.slice(0, blockStart)}${updatedBlock}${value.slice(blockEnd)}`;

    updateValueAndSelection(nextValue, blockStart, blockStart + updatedBlock.length);
  }

  function handleToolbarAction(actionId: string) {
    switch (actionId) {
      case "bold":
        applyInlineDecoration("**");
        break;
      case "italic":
        applyInlineDecoration("*");
        break;
      case "code":
        applyInlineDecoration("`");
        break;
      case "bullet":
        applyLinePrefix(() => "- ");
        break;
      case "numbered":
        applyLinePrefix((index) => `${index + 1}. `);
        break;
      case "quote":
        applyLinePrefix(() => "> ");
        break;
      case "link": {
        if (disabled) {
          return;
        }

        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = value.slice(start, end) || (isFrench ? "texte du lien" : "link text");
        const prompted = window.prompt(isFrench ? "Entrez une URL" : "Enter a URL", "https://");

        if (!prompted) {
          return;
        }

        const trimmed = prompted.trim();
        if (!trimmed) {
          return;
        }

        const normalizedUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        const replacement = `[${selected}](${normalizedUrl})`;
        const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;

        updateValueAndSelection(nextValue, start + 1, start + 1 + selected.length);
        break;
      }
      default:
        break;
    }
  }

  return (
    <div className="mt-1 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface-soft p-2">
        {markdownToolbarActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`${iconButtonClass} h-7 px-2.5 text-[11px]`}
            title={action.title}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleToolbarAction(action.id)}
            disabled={disabled}
          >
            {action.label}
          </button>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[130px] w-full resize-y border-0 bg-transparent px-3 py-2.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted/65 disabled:cursor-not-allowed disabled:opacity-55"
        placeholder={
          isFrench
            ? "Decrivez la tache. Utilisez la barre pour gras, listes, citations, code et liens."
            : "Describe the task. Use the toolbar for bold, lists, quotes, code, and links."
        }
        disabled={disabled}
      />

      <div className="border-t border-line bg-surface-soft/60 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          {isFrench ? "Apercu" : "Preview"}
        </p>
        {value.trim() ? (
          <div
            className="rich-text-render mt-2 text-sm leading-6 text-muted"
            dangerouslySetInnerHTML={{ __html: renderDescriptionHtml(value) }}
          />
        ) : (
          <p className="mt-1 text-xs text-muted">
            {isFrench
              ? "Ajoutez une description pour afficher le rendu."
              : "Add description text to preview formatting."}
          </p>
        )}
      </div>
    </div>
  );
}

type TaskCardProps = {
  locale: UserLocale;
  task: Task;
  isDragging: boolean;
  isSaving: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

function TaskCard({ locale, task, isDragging, isSaving, onEdit, onDelete }: TaskCardProps) {
  const isFrench = locale === "fr";
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    disabled: isSaving,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-[0_12px_30px_-24px_rgba(16,34,48,0.6)] transition ${
        isDragging ? "scale-[0.985] opacity-75 shadow-lg" : "hover:-translate-y-0.5 hover:border-accent/35"
      } ${isSaving ? "cursor-wait opacity-80" : "cursor-grab active:cursor-grabbing"}`}
      aria-busy={isSaving}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.11em] text-muted">
            {isFrench ? "Glisser" : "Drag"}
          </div>
          <h3 className="text-sm font-semibold text-foreground">{task.title}</h3>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-line bg-surface-soft px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-accent/45 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onEdit(task)}
            disabled={isSaving}
          >
            {isFrench ? "Modifier" : "Edit"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-rose-200 bg-rose-50/80 px-2.5 py-1 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onDelete(task)}
            disabled={isSaving}
          >
            {isFrench ? "Supprimer" : "Delete"}
          </button>
        </div>
      </div>

      {task.description ? (
        <div
          className="rich-text-render mt-2 text-sm leading-6 text-muted"
          dangerouslySetInnerHTML={{ __html: renderDescriptionHtml(task.description) }}
        />
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${priorityChipClassByPriority[task.priority]}`}
        >
          {formatPriority(task.priority, locale)}
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusChipClassByStatus[task.status]}`}
        >
          {formatTaskStatus(task.status, locale)}
        </span>
        {task.project ? (
          <span className="rounded-full border border-line bg-surface-soft px-2.5 py-1 text-[11px] text-muted">
            {isFrench ? "Projet" : "Project"}: {task.project}
          </span>
        ) : null}
        {typeof task.plannedTime === "number" ? (
          <span className="rounded-full border border-line bg-surface-soft px-2.5 py-1 text-[11px] text-muted">
            {isFrench ? "Temps" : "Time"}: {formatPlannedTime(task.plannedTime)}
          </span>
        ) : null}
        {task.recurrenceSourceTaskId ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">
            {isFrench ? "Recurrente" : "Recurring"}
          </span>
        ) : null}
      </div>
    </article>
  );
}

type TaskColumnProps = {
  status: TaskStatus;
  children: React.ReactNode;
};

function TaskColumn({ status, children }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 flex-1 space-y-3 rounded-2xl p-1 transition ${
        isOver ? statusDropClassByStatus[status] : "bg-transparent"
      }`}
    >
      {children}
    </div>
  );
}

type AuthPanelProps = {
  locale: UserLocale;
  mode: AuthMode;
  values: AuthFormValues;
  isSubmitting: boolean;
  errorMessage: string | null;
  onModeChange: (mode: AuthMode) => void;
  onValueChange: (field: keyof AuthFormValues, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function AuthPanel({
  locale,
  mode,
  values,
  isSubmitting,
  errorMessage,
  onModeChange,
  onValueChange,
  onSubmit,
}: AuthPanelProps) {
  const isFrench = locale === "fr";
  const submitLabel =
    mode === "login"
      ? isSubmitting
        ? isFrench
          ? "Connexion..."
          : "Signing in..."
        : isFrench
        ? "Se connecter"
        : "Sign in"
      : isSubmitting
      ? isFrench
        ? "Creation..."
        : "Creating..."
      : isFrench
      ? "Creer un compte"
      : "Create account";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1080px] flex-col justify-center px-4 py-8 sm:px-8">
      <AppNavbar locale={locale} user={null} onLogin={() => onModeChange("login")} isBusy={isSubmitting} />

      <section className="grid w-full overflow-hidden rounded-[2rem] border border-line bg-surface/95 shadow-[0_36px_80px_-52px_rgba(16,34,48,0.8)] backdrop-blur lg:grid-cols-[1.12fr_1fr]">
        <div className="border-b border-line bg-gradient-to-br from-accent-soft via-[#e8f6f4] to-surface-soft p-8 lg:border-b-0 lg:border-r lg:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
            {isFrench ? "Espace de planification quotidienne" : "Daily Planning Workspace"}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{APP_NAME}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted sm:text-base">{APP_TAGLINE}</p>

          <div className="mt-7 space-y-3 text-sm text-foreground/90">
            <p className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
              {isFrench
                ? "Planifiez le travail par jour et gardez les priorites visibles."
                : "Plan work by day and keep priorities visible."}
            </p>
            <p className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
              {isFrench
                ? "Deplacez les taches entre les statuts au fil de la progression."
                : "Drag tasks across statuses as work progresses."}
            </p>
            <p className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
              {isFrench
                ? "Gardez une vue fiable de ce qui demande de l'attention maintenant."
                : "Keep a reliable view of what needs attention now."}
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="inline-flex rounded-xl border border-line bg-surface-soft p-1">
            <button
              type="button"
              className={`min-w-[110px] rounded-lg px-4 py-2 text-sm font-semibold transition ${
                mode === "login" ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-foreground"
              }`}
              onClick={() => onModeChange("login")}
              disabled={isSubmitting}
            >
              {isFrench ? "Connexion" : "Sign in"}
            </button>
            <button
              type="button"
              className={`min-w-[110px] rounded-lg px-4 py-2 text-sm font-semibold transition ${
                mode === "register" ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-foreground"
              }`}
              onClick={() => onModeChange("register")}
              disabled={isSubmitting}
            >
              {isFrench ? "Inscription" : "Register"}
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm font-semibold text-foreground">
              {isFrench ? "Email" : "Email"}
              <input
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={(event) => onValueChange("email", event.target.value)}
                className={textFieldClass}
                disabled={isSubmitting}
                placeholder="you@company.com"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-foreground">
              {isFrench ? "Mot de passe" : "Password"}
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={values.password}
                onChange={(event) => onValueChange("password", event.target.value)}
                className={textFieldClass}
                disabled={isSubmitting}
                minLength={8}
                required
              />
            </label>

            {mode === "register" ? (
              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Nom affiche (optionnel)" : "Display Name (optional)"}
                <input
                  type="text"
                  autoComplete="name"
                  value={values.displayName}
                  onChange={(event) => onValueChange("displayName", event.target.value)}
                  className={textFieldClass}
                  disabled={isSubmitting}
                  placeholder={isFrench ? "Comment devons-nous vous appeler ?" : "How should we address you?"}
                />
              </label>
            ) : null}

            {errorMessage ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {errorMessage}
              </p>
            ) : null}

            <button type="submit" className={`w-full ${primaryButtonClass}`} disabled={isSubmitting}>
              {submitLabel}
            </button>
            <p className="text-xs leading-5 text-muted">
              {mode === "login"
                ? isFrench
                  ? "Utilisez votre compte pour continuer vers votre tableau quotidien."
                  : "Use your account to continue to your daily board."
                : isFrench
                ? "Creez un compte pour commencer a suivre vos taches quotidiennes immediatement."
                : "Create an account to start tracking daily tasks immediately."}
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}

export function AppShell() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [guestLocale, setGuestLocale] = useState<UserLocale>(() =>
    getPreferredLocale(
      typeof window === "undefined"
        ? "en"
        : window.navigator?.language ?? window.navigator?.languages?.[0] ?? "en"
    )
  );
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authFormValues, setAuthFormValues] = useState<AuthFormValues>({
    email: "",
    password: "",
    displayName: "",
  });
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [profileFormValues, setProfileFormValues] = useState<ProfileFormValues>(
    getDefaultProfileFormValues
  );
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragErrorMessage, setDragErrorMessage] = useState<string | null>(null);
  const [isCarryingOverYesterday, setIsCarryingOverYesterday] = useState(false);
  const [carryOverMessage, setCarryOverMessage] = useState<string | null>(null);
  const [carryOverErrorMessage, setCarryOverErrorMessage] = useState<string | null>(null);
  const [dayAffirmation, setDayAffirmation] = useState<DayAffirmation | null>(null);
  const [dayAffirmationDraft, setDayAffirmationDraft] = useState(() =>
    getDefaultAffirmationText(
      toDateInputValue(new Date()),
      getPreferredLocale(
        typeof window === "undefined"
          ? "en"
          : window.navigator?.language ?? window.navigator?.languages?.[0] ?? "en"
      )
    )
  );
  const [isDayAffirmationLoading, setIsDayAffirmationLoading] = useState(false);
  const [isDayAffirmationSaving, setIsDayAffirmationSaving] = useState(false);
  const [dayAffirmationErrorMessage, setDayAffirmationErrorMessage] = useState<string | null>(null);
  const [dayBilan, setDayBilan] = useState<DayBilan | null>(null);
  const [dayBilanFormValues, setDayBilanFormValues] = useState<DayBilanFormValues>(
    getDefaultDayBilanFormValues
  );
  const [isDayBilanLoading, setIsDayBilanLoading] = useState(false);
  const [isDayBilanSaving, setIsDayBilanSaving] = useState(false);
  const [dayBilanErrorMessage, setDayBilanErrorMessage] = useState<string | null>(null);
  const [dayBilanSuccessMessage, setDayBilanSuccessMessage] = useState<string | null>(null);
  const [gamingTrackPeriod, setGamingTrackPeriod] = useState<GamingTrackPeriod>("week");
  const [gamingTrackSummary, setGamingTrackSummary] = useState<GamingTrackSummary | null>(null);
  const [isGamingTrackLoading, setIsGamingTrackLoading] = useState(false);
  const [gamingTrackErrorMessage, setGamingTrackErrorMessage] = useState<string | null>(null);
  const [isAssistantPanelOpen, setIsAssistantPanelOpen] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<AssistantChatMessage[]>([]);
  const [assistantErrorMessage, setAssistantErrorMessage] = useState<string | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const assistantMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([]);

  const [taskDialogMode, setTaskDialogMode] = useState<TaskDialogMode | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskFormValues, setTaskFormValues] = useState<TaskFormValues>(() =>
    getDefaultTaskFormValues(toDateInputValue(new Date()))
  );
  const [recurrenceFormValues, setRecurrenceFormValues] = useState<RecurrenceFormValues>(
    getDefaultRecurrenceFormValues
  );
  const [taskRecurrenceRule, setTaskRecurrenceRule] = useState<TaskRecurrenceRule | null>(null);
  const [isTaskDetailsLoading, setIsTaskDetailsLoading] = useState(false);
  const [taskDetailsErrorMessage, setTaskDetailsErrorMessage] = useState<string | null>(null);
  const taskDetailsRequestVersionRef = useRef(0);

  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskCommentDraft, setTaskCommentDraft] = useState("");
  const [taskCommentErrorMessage, setTaskCommentErrorMessage] = useState<string | null>(null);
  const [isCreatingTaskComment, setIsCreatingTaskComment] = useState(false);
  const [pendingCommentIds, setPendingCommentIds] = useState<string[]>([]);

  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [taskAttachmentNameDraft, setTaskAttachmentNameDraft] = useState("");
  const [taskAttachmentFileDraft, setTaskAttachmentFileDraft] = useState<File | null>(null);
  const taskAttachmentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [taskAttachmentErrorMessage, setTaskAttachmentErrorMessage] = useState<string | null>(null);
  const [isCreatingTaskAttachment, setIsCreatingTaskAttachment] = useState(false);
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);

  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [newProjectDraft, setNewProjectDraft] = useState("");
  const [projectFormErrorMessage, setProjectFormErrorMessage] = useState<string | null>(null);

  const [taskFormErrorMessage, setTaskFormErrorMessage] = useState<string | null>(null);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const editingTask = useMemo(() => {
    if (!editingTaskId) {
      return null;
    }

    return tasks.find((task) => task.id === editingTaskId) ?? null;
  }, [editingTaskId, tasks]);

  const isTaskDialogOpen = taskDialogMode !== null;
  const isMutationPending = isSubmittingTask || isDeletingTask || isCarryingOverYesterday;
  const activeLocale = getPreferredLocale(authUser?.preferredLocale ?? guestLocale);
  const isFrench = activeLocale === "fr";
  const boardColumns = getBoardColumns(activeLocale);
  const priorityOptions = getPriorityOptions(activeLocale);
  const recurrenceFrequencyOptions = getRecurrenceFrequencyOptions(activeLocale);
  const weekdayOptions = getWeekdayOptions(activeLocale);
  const gamingTrackPeriodOptions = getGamingTrackPeriodOptions(activeLocale);
  const assistantPromptSuggestions = getAssistantPromptSuggestions(activeLocale);
  const userLocaleOptions = getUserLocaleOptions(activeLocale);
  const activeTimeZone = authUser?.preferredTimeZone ?? null;
  const isEditingGeneratedTask =
    taskDialogMode === "edit" && (editingTask?.recurrenceSourceTaskId ?? null) !== null;
  const normalizedSelectedProject = normalizeProjectName(taskFormValues.project);

  const selectedProjectIsUsed = useMemo(() => {
    if (!normalizedSelectedProject) {
      return false;
    }

    const selectedProjectKey = normalizedSelectedProject.toLocaleLowerCase();

    return tasks.some(
      (task) =>
        normalizeProjectName(task.project ?? "").toLocaleLowerCase() === selectedProjectKey
    );
  }, [normalizedSelectedProject, tasks]);

  const projectSelectOptions = useMemo(
    () => getUniqueSortedProjectNames([...projectOptions, normalizedSelectedProject]),
    [normalizedSelectedProject, projectOptions]
  );

  const taskDialogHeightClass = taskDialogMode === "edit" ? "max-h-[76vh]" : "max-h-[82vh]";

  const saveProjectOptions = useCallback((values: string[]) => {
    const nextOptions = getUniqueSortedProjectNames(values);
    setProjectOptions(nextOptions);
    window.localStorage.setItem(PROJECT_OPTIONS_STORAGE_KEY, JSON.stringify(nextOptions));
    return nextOptions;
  }, []);

  function applyAuthSession(token: string, user: AuthUser) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    setAuthToken(token);
    setAuthUser(user);
    setProfileFormValues(getProfileFormValues(user));
    setProfileErrorMessage(null);
    setProfileSuccessMessage(null);
    setAuthErrorMessage(null);
    setErrorMessage(null);
  }

  const clearAuthSession = useCallback(() => {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setIsProfileDialogOpen(false);
    setProfileFormValues(getDefaultProfileFormValues());
    setProfileErrorMessage(null);
    setProfileSuccessMessage(null);
    setIsProfileSaving(false);
    setTasks([]);
    setErrorMessage(null);
    setDragErrorMessage(null);
    setIsCarryingOverYesterday(false);
    setCarryOverMessage(null);
    setCarryOverErrorMessage(null);
    setDayAffirmation(null);
    setDayAffirmationDraft(
      getDefaultAffirmationText(
        toDateInputValue(new Date()),
        getPreferredLocale(window.navigator?.language ?? window.navigator?.languages?.[0] ?? "en")
      )
    );
    setIsDayAffirmationLoading(false);
    setIsDayAffirmationSaving(false);
    setDayAffirmationErrorMessage(null);
    setDayBilan(null);
    setDayBilanFormValues(getDefaultDayBilanFormValues());
    setIsDayBilanLoading(false);
    setIsDayBilanSaving(false);
    setDayBilanErrorMessage(null);
    setDayBilanSuccessMessage(null);
    setGamingTrackPeriod("week");
    setGamingTrackSummary(null);
    setIsGamingTrackLoading(false);
    setGamingTrackErrorMessage(null);
    setIsAssistantPanelOpen(false);
    setAssistantQuestion("");
    setAssistantMessages([]);
    setAssistantErrorMessage(null);
    setIsAssistantLoading(false);
    setIsLoading(false);
    setTaskDialogMode(null);
    setEditingTaskId(null);
    setTaskToDelete(null);
    setAuthFormValues((current) => ({ ...current, password: "" }));
    setTaskRecurrenceRule(null);
    setRecurrenceFormValues(getDefaultRecurrenceFormValues());
    setTaskDetailsErrorMessage(null);
    setIsTaskDetailsLoading(false);
    setTaskComments([]);
    setTaskCommentDraft("");
    setTaskCommentErrorMessage(null);
    setIsCreatingTaskComment(false);
    setPendingCommentIds([]);
    setTaskAttachments([]);
    setTaskAttachmentNameDraft("");
    setTaskAttachmentFileDraft(null);
    if (taskAttachmentFileInputRef.current) {
      taskAttachmentFileInputRef.current.value = "";
    }
    setTaskAttachmentErrorMessage(null);
    setIsCreatingTaskAttachment(false);
    setPendingAttachmentIds([]);
    setNewProjectDraft("");
    setProjectFormErrorMessage(null);
  }, []);

  function handleAuthFormFieldChange(field: keyof AuthFormValues, value: string) {
    setAuthFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAuthSubmitting) {
      return;
    }

    setAuthErrorMessage(null);
    setIsAuthSubmitting(true);

    try {
      const result =
        authMode === "login" ? await loginUser(authFormValues) : await registerUser(authFormValues);

      applyAuthSession(result.token, result.user);
      setAuthFormValues({
        email: result.user.email,
        password: "",
        displayName: result.user.displayName ?? "",
      });
    } catch (error) {
      setAuthErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de vous authentifier."
          : "Unable to authenticate."
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    const token = authToken;

    try {
      if (token) {
        await logoutUser(token);
      }
    } catch {
      // Keep logout UX predictable even if backend session cleanup fails.
    } finally {
      clearAuthSession();
    }
  }

  function openProfileDialog() {
    setProfileFormValues(getProfileFormValues(authUser));
    setProfileErrorMessage(null);
    setProfileSuccessMessage(null);
    setIsProfileDialogOpen(true);
  }

  function closeProfileDialog() {
    setIsProfileDialogOpen(false);
  }

  function handleProfileFieldChange<K extends keyof ProfileFormValues>(
    field: K,
    value: ProfileFormValues[K]
  ) {
    setProfileFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authToken || !authUser || isProfileSaving) {
      return;
    }

    const preferredTimeZone = profileFormValues.preferredTimeZone.trim();

    if (preferredTimeZone !== "" && !isValidIanaTimeZone(preferredTimeZone)) {
      setProfileErrorMessage(
        isFrench
          ? "Le fuseau horaire doit etre une valeur IANA valide, par exemple Europe/Paris."
          : "Time zone must be a valid IANA value, for example Europe/Paris."
      );
      setProfileSuccessMessage(null);
      return;
    }

    setIsProfileSaving(true);
    setProfileErrorMessage(null);
    setProfileSuccessMessage(null);

    try {
      const updatedUser = await updateProfile(
        {
          displayName: profileFormValues.displayName.trim() || null,
          preferredLocale: getPreferredLocale(profileFormValues.preferredLocale),
          preferredTimeZone: preferredTimeZone || null,
        },
        authToken
      );

      setAuthUser(updatedUser);
      setProfileFormValues(getProfileFormValues(updatedUser));
      setAuthFormValues((current) => ({
        ...current,
        displayName: updatedUser.displayName ?? "",
      }));
      setProfileSuccessMessage(isFrench ? "Profil mis a jour." : "Profile updated.");
    } catch (error) {
      setProfileErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de mettre a jour le profil."
          : "Unable to update profile."
      );
    } finally {
      setIsProfileSaving(false);
    }
  }

  function markTaskAsPending(taskId: string, isPending: boolean) {
    setPendingTaskIds((previousIds) => {
      if (isPending) {
        return previousIds.includes(taskId) ? previousIds : [...previousIds, taskId];
      }

      return previousIds.filter((id) => id !== taskId);
    });
  }

  function markCommentAsPending(commentId: string, isPending: boolean) {
    setPendingCommentIds((previousIds) => {
      if (isPending) {
        return previousIds.includes(commentId) ? previousIds : [...previousIds, commentId];
      }

      return previousIds.filter((id) => id !== commentId);
    });
  }

  function markAttachmentAsPending(attachmentId: string, isPending: boolean) {
    setPendingAttachmentIds((previousIds) => {
      if (isPending) {
        return previousIds.includes(attachmentId) ? previousIds : [...previousIds, attachmentId];
      }

      return previousIds.filter((id) => id !== attachmentId);
    });
  }

  function resetTaskDetailsState() {
    taskDetailsRequestVersionRef.current += 1;
    setTaskRecurrenceRule(null);
    setRecurrenceFormValues(getDefaultRecurrenceFormValues());
    setTaskDetailsErrorMessage(null);
    setIsTaskDetailsLoading(false);

    setTaskComments([]);
    setTaskCommentDraft("");
    setTaskCommentErrorMessage(null);
    setIsCreatingTaskComment(false);
    setPendingCommentIds([]);

    setTaskAttachments([]);
    setTaskAttachmentNameDraft("");
    setTaskAttachmentFileDraft(null);
    if (taskAttachmentFileInputRef.current) {
      taskAttachmentFileInputRef.current.value = "";
    }
    setTaskAttachmentErrorMessage(null);
    setIsCreatingTaskAttachment(false);
    setPendingAttachmentIds([]);
  }

  function openCreateTaskDialog(initialStatus: TaskStatus = "todo") {
    setTaskDialogMode("create");
    setEditingTaskId(null);
    setTaskFormValues({
      ...getDefaultTaskFormValues(selectedDate),
      status: initialStatus,
    });
    setRecurrenceFormValues(getDefaultRecurrenceFormValues());
    setTaskFormErrorMessage(null);
    setProjectFormErrorMessage(null);
    setNewProjectDraft("");
    setDeleteErrorMessage(null);
    resetTaskDetailsState();
  }

  function openEditTaskDialog(task: Task) {
    setTaskDialogMode("edit");
    setEditingTaskId(task.id);
    setTaskFormValues(getTaskFormValues(task));
    setRecurrenceFormValues(getDefaultRecurrenceFormValues());
    setTaskFormErrorMessage(null);
    setProjectFormErrorMessage(null);
    setNewProjectDraft("");
    setDeleteErrorMessage(null);
    resetTaskDetailsState();
  }

  function closeTaskDialog() {
    if (isSubmittingTask) {
      return;
    }

    setTaskDialogMode(null);
    setEditingTaskId(null);
    setTaskFormErrorMessage(null);
    setProjectFormErrorMessage(null);
    setNewProjectDraft("");
    resetTaskDetailsState();
  }

  function openDeleteDialog(task: Task) {
    setTaskToDelete(task);
    setDeleteErrorMessage(null);
  }

  function closeDeleteDialog() {
    if (isDeletingTask) {
      return;
    }

    setTaskToDelete(null);
    setDeleteErrorMessage(null);
  }

  function handleDateChange(nextDate: string) {
    if (nextDate === selectedDate) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setDragErrorMessage(null);
    setCarryOverMessage(null);
    setCarryOverErrorMessage(null);
    setDayAffirmation(null);
    setDayAffirmationDraft(getDefaultAffirmationText(nextDate, activeLocale));
    setDayAffirmationErrorMessage(null);
    setDayBilan(null);
    setDayBilanFormValues(getDefaultDayBilanFormValues());
    setDayBilanErrorMessage(null);
    setDayBilanSuccessMessage(null);
    setGamingTrackErrorMessage(null);
    setAssistantErrorMessage(null);
    setActiveTaskId(null);
    setPendingTaskIds([]);

    setTaskDialogMode(null);
    setEditingTaskId(null);
    setTaskFormErrorMessage(null);
    setProjectFormErrorMessage(null);
    setNewProjectDraft("");
    setTaskToDelete(null);
    setDeleteErrorMessage(null);
    resetTaskDetailsState();

    setSelectedDate(nextDate);
  }

  async function handleAssistantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAssistantLoading) {
      return;
    }

    const normalizedQuestion = assistantQuestion.trim();

    if (!normalizedQuestion) {
      setAssistantErrorMessage(
        isFrench ? "Entrez une question pour l'assistant." : "Enter a question for the assistant."
      );
      return;
    }

    if (normalizedQuestion.length > ASSISTANT_QUESTION_MAX_LENGTH) {
      setAssistantErrorMessage(
        isFrench
          ? `La question est trop longue. Longueur maximale : ${ASSISTANT_QUESTION_MAX_LENGTH} caracteres.`
          : `Question is too long. Maximum length is ${ASSISTANT_QUESTION_MAX_LENGTH} characters.`
      );
      return;
    }

    if (!authToken) {
      setAssistantErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    const userMessage: AssistantChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: normalizedQuestion,
      timestamp: new Date().toISOString(),
    };

    setIsAssistantPanelOpen(true);
    setAssistantMessages((currentMessages) => [...currentMessages, userMessage]);
    setAssistantQuestion("");
    setAssistantErrorMessage(null);
    setIsAssistantLoading(true);

    try {
      const reply = await requestAssistantReply(normalizedQuestion, authToken, activeLocale);
      const assistantMessage: AssistantChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: reply.answer,
        timestamp: reply.generatedAt,
        source: reply.source,
        usedTaskCount: reply.usedTaskCount,
        usedCommentCount: reply.usedCommentCount,
      };

      setAssistantMessages((currentMessages) => [...currentMessages, assistantMessage]);

      if (reply.warning) {
        setAssistantErrorMessage(reply.warning);
      }
    } catch (error) {
      setAssistantErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de generer une reponse de l'assistant."
          : "Unable to generate assistant reply."
      );
    } finally {
      setIsAssistantLoading(false);
    }
  }

  async function handleCarryOverYesterday() {
    if (isCarryingOverYesterday) {
      return;
    }

    if (!authToken) {
      setCarryOverErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    setCarryOverMessage(null);
    setCarryOverErrorMessage(null);
    setIsCarryingOverYesterday(true);

    try {
      const result = await carryOverYesterdayTasks(selectedDate, authToken);

      setTasks((currentTasks) => {
        const mergedById = new Map(currentTasks.map((task) => [task.id, task]));
        for (const task of result.tasks) {
          mergedById.set(task.id, task);
        }

        return [...mergedById.values()];
      });

      if (result.copiedCount === 0 && result.skippedCount === 0) {
        setCarryOverMessage(
          isFrench
            ? "Aucune tache actionnable trouvee hier."
            : "No actionable tasks found yesterday."
        );
      } else {
        setCarryOverMessage(
          isFrench
            ? `Copie terminee : ${result.copiedCount} copies, ${result.skippedCount} ignorees.`
            : `Carry-over complete: ${result.copiedCount} copied, ${result.skippedCount} skipped.`
        );
      }
    } catch (error) {
      setCarryOverErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de copier les taches d'hier."
          : "Unable to carry over yesterday tasks."
      );
    } finally {
      setIsCarryingOverYesterday(false);
    }
  }

  async function saveDayAffirmation(options?: { text?: string; isCompleted?: boolean }) {
    if (isDayAffirmationSaving || isDayAffirmationLoading) {
      return;
    }

    if (!authToken) {
      setDayAffirmationErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    const fallbackText = getDefaultAffirmationText(selectedDate, activeLocale);
    const nextTextCandidate = options?.text ?? dayAffirmationDraft;
    const normalizedText = nextTextCandidate.trim().length > 0 ? nextTextCandidate.trim() : fallbackText;
    const nextCompletion = options?.isCompleted ?? dayAffirmation?.isCompleted ?? false;

    if (normalizedText.length > DAY_AFFIRMATION_MAX_LENGTH) {
      setDayAffirmationErrorMessage(
        isFrench
          ? `L'affirmation est trop longue. Longueur maximale : ${DAY_AFFIRMATION_MAX_LENGTH} caracteres.`
          : `Affirmation is too long. Maximum length is ${DAY_AFFIRMATION_MAX_LENGTH} characters.`
      );
      return;
    }

    setDayAffirmationErrorMessage(null);
    setIsDayAffirmationSaving(true);

    try {
      const savedAffirmation = await upsertDayAffirmation(
        {
          date: selectedDate,
          text: normalizedText,
          isCompleted: nextCompletion,
        },
        authToken
      );

      setDayAffirmation(savedAffirmation);
      setDayAffirmationDraft(savedAffirmation.text);
    } catch (error) {
      setDayAffirmationErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible d'enregistrer l'affirmation du jour."
          : "Unable to save day affirmation."
      );
    } finally {
      setIsDayAffirmationSaving(false);
    }
  }

  function updateDayBilanField(field: keyof DayBilanFormValues, value: string) {
    setDayBilanFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setDayBilanErrorMessage(null);
    setDayBilanSuccessMessage(null);
  }

  async function handleSaveDayBilan() {
    if (isDayBilanSaving || isDayBilanLoading) {
      return;
    }

    if (!authToken) {
      setDayBilanErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    const inputResult = buildDayBilanMutationInput(dayBilanFormValues, selectedDate, activeLocale);
    if (!inputResult.data) {
      setDayBilanErrorMessage(inputResult.error ?? (isFrench ? "Bilan du jour invalide." : "Invalid day bilan."));
      return;
    }

    setDayBilanErrorMessage(null);
    setDayBilanSuccessMessage(null);
    setIsDayBilanSaving(true);

    try {
      const savedBilan = await upsertDayBilan(inputResult.data, authToken);
      setDayBilan(savedBilan);
      setDayBilanFormValues(getDayBilanFormValues(savedBilan));
      setDayBilanSuccessMessage(isFrench ? "Bilan du jour enregistre." : "Day bilan saved.");
    } catch (error) {
      setDayBilanErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible d'enregistrer le bilan du jour."
          : "Unable to save day bilan."
      );
    } finally {
      setIsDayBilanSaving(false);
    }
  }

  function updateTaskFormField(field: keyof TaskFormValues, value: string) {
    setTaskFormValues((current) => ({
      ...current,
      [field]: value,
    }));

    if (field === "project") {
      setProjectFormErrorMessage(null);
    }
  }

  function updateRecurrenceFormField(
    field: "enabled" | "frequency" | "interval" | "endsOn",
    value: boolean | string
  ) {
    setRecurrenceFormValues((current) => {
      if (field === "enabled") {
        return {
          ...current,
          enabled: Boolean(value),
        };
      }

      if (field === "frequency" && typeof value === "string" && isRecurrenceFrequency(value)) {
        return {
          ...current,
          frequency: value,
          weekdays: value === "weekly" ? current.weekdays : [],
        };
      }

      if (field === "interval" && typeof value === "string") {
        return {
          ...current,
          interval: value,
        };
      }

      if (field === "endsOn" && typeof value === "string") {
        return {
          ...current,
          endsOn: value,
        };
      }

      return current;
    });
  }

  function toggleRecurrenceWeekday(weekday: number) {
    setRecurrenceFormValues((current) => {
      const isSelected = current.weekdays.includes(weekday);
      const weekdays = isSelected
        ? current.weekdays.filter((item) => item !== weekday)
        : [...current.weekdays, weekday].sort((left, right) => left - right);

      return {
        ...current,
        weekdays,
      };
    });
  }

  function handleCreateProjectOption() {
    const normalizedName = normalizeProjectName(newProjectDraft);

    if (!normalizedName) {
      setProjectFormErrorMessage(
        isFrench ? "Le nom du projet est requis." : "Project name is required."
      );
      return;
    }

    const existingProject = projectOptions.find(
      (projectName) =>
        projectName.toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
    );

    if (existingProject) {
      updateTaskFormField("project", existingProject);
      setNewProjectDraft("");
      setProjectFormErrorMessage(null);
      return;
    }

    saveProjectOptions([...projectOptions, normalizedName]);
    updateTaskFormField("project", normalizedName);
    setNewProjectDraft("");
    setProjectFormErrorMessage(null);
  }

  function handleDeleteSelectedProjectOption() {
    const selectedProject = normalizeProjectName(taskFormValues.project);

    if (!selectedProject) {
      setProjectFormErrorMessage(
        isFrench ? "Selectionnez un projet a supprimer." : "Select a project to delete."
      );
      return;
    }

    if (selectedProjectIsUsed) {
      setProjectFormErrorMessage(
        isFrench
          ? "Ce projet est utilise sur le tableau actuel et ne peut pas etre supprime."
          : "This project is in use on the current board and cannot be deleted."
      );
      return;
    }

    const nextOptions = projectOptions.filter(
      (projectName) =>
        projectName.toLocaleLowerCase() !== selectedProject.toLocaleLowerCase()
    );

    saveProjectOptions(nextOptions);
    updateTaskFormField("project", "");
    setProjectFormErrorMessage(null);
  }

  async function handleCreateComment() {
    if (!editingTaskId || isCreatingTaskComment || isTaskDetailsLoading) {
      return;
    }

    const body = taskCommentDraft.trim();

    if (!body) {
      setTaskCommentErrorMessage(
        isFrench ? "Le texte du commentaire est requis." : "Comment text is required."
      );
      return;
    }

    if (!authToken) {
      setTaskCommentErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    setTaskCommentErrorMessage(null);
    setIsCreatingTaskComment(true);

    try {
      const comment = await createTaskComment(editingTaskId, body, authToken);
      setTaskComments((currentComments) => [...currentComments, comment]);
      setTaskCommentDraft("");
    } catch (error) {
      setTaskCommentErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de creer le commentaire."
          : "Unable to create comment."
      );
    } finally {
      setIsCreatingTaskComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!editingTaskId || isTaskDetailsLoading) {
      return;
    }

    if (!authToken) {
      setTaskCommentErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    setTaskCommentErrorMessage(null);
    markCommentAsPending(commentId, true);

    try {
      await deleteTaskComment(editingTaskId, commentId, authToken);
      setTaskComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== commentId)
      );
    } catch (error) {
      setTaskCommentErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de supprimer le commentaire."
          : "Unable to delete comment."
      );
    } finally {
      markCommentAsPending(commentId, false);
    }
  }

  async function handleCreateAttachment() {
    if (!editingTaskId || isCreatingTaskAttachment || isTaskDetailsLoading) {
      return;
    }

    const file = taskAttachmentFileDraft;
    const name = taskAttachmentNameDraft.trim() || file?.name?.trim() || "";

    if (!name) {
      setTaskAttachmentErrorMessage(
        isFrench ? "Le nom de la piece jointe est requis." : "Attachment name is required."
      );
      return;
    }

    if (!file) {
      setTaskAttachmentErrorMessage(
        isFrench ? "Selectionnez un fichier a televerser." : "Select a file to upload."
      );
      return;
    }

    if (file.size > MAX_ATTACHMENT_UPLOAD_BYTES) {
      setTaskAttachmentErrorMessage(
        isFrench
          ? `La piece jointe depasse la limite de ${formatFileSize(MAX_ATTACHMENT_UPLOAD_BYTES)}.`
          : `Attachment exceeds ${formatFileSize(MAX_ATTACHMENT_UPLOAD_BYTES)} limit.`
      );
      return;
    }

    if (!authToken) {
      setTaskAttachmentErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    setTaskAttachmentErrorMessage(null);
    setIsCreatingTaskAttachment(true);

    try {
      const attachment = await createTaskAttachment(
        editingTaskId,
        {
          name,
          file,
        },
        authToken
      );
      setTaskAttachments((currentAttachments) => [...currentAttachments, attachment]);
      setTaskAttachmentNameDraft("");
      setTaskAttachmentFileDraft(null);
      if (taskAttachmentFileInputRef.current) {
        taskAttachmentFileInputRef.current.value = "";
      }
    } catch (error) {
      setTaskAttachmentErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de creer la piece jointe."
          : "Unable to create attachment."
      );
    } finally {
      setIsCreatingTaskAttachment(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!editingTaskId || isTaskDetailsLoading) {
      return;
    }

    if (!authToken) {
      setTaskAttachmentErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    setTaskAttachmentErrorMessage(null);
    markAttachmentAsPending(attachmentId, true);

    try {
      await deleteTaskAttachment(editingTaskId, attachmentId, authToken);
      setTaskAttachments((currentAttachments) =>
        currentAttachments.filter((attachment) => attachment.id !== attachmentId)
      );
    } catch (error) {
      setTaskAttachmentErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de supprimer la piece jointe."
          : "Unable to delete attachment."
      );
    } finally {
      markAttachmentAsPending(attachmentId, false);
    }
  }

  async function handleTaskFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!taskDialogMode || isSubmittingTask) {
      return;
    }

    const inputResult = buildTaskMutationInput(taskFormValues, activeLocale);
    if (!inputResult.data) {
      setTaskFormErrorMessage(inputResult.error ?? (isFrench ? "Details de tache invalides." : "Invalid task details."));
      return;
    }

    const recurrenceResult = buildRecurrenceMutationInput(recurrenceFormValues, activeLocale);
    if (recurrenceFormValues.enabled && !recurrenceResult.data) {
      setTaskFormErrorMessage(
        recurrenceResult.error ?? (isFrench ? "Parametres de recurrence invalides." : "Invalid recurrence settings.")
      );
      return;
    }

    setTaskFormErrorMessage(null);
    setDeleteErrorMessage(null);
    setIsSubmittingTask(true);

    try {
      if (!authToken) {
        throw new Error(isFrench ? "Authentification requise." : "Authentication is required.");
      }

      const selectedProjectName = normalizeProjectName(taskFormValues.project);

      if (selectedProjectName) {
        saveProjectOptions([...projectOptions, selectedProjectName]);
      }

      let savedTask: Task;

      if (taskDialogMode === "create") {
        const createdTask = await createTask(inputResult.data, authToken);

        setTasks((currentTasks) =>
          createdTask.targetDate === selectedDate ? [...currentTasks, createdTask] : currentTasks
        );
        savedTask = createdTask;
      } else {
        if (!editingTaskId) {
          throw new Error("Task not found.");
        }

        const updatedTask = await updateTask(editingTaskId, inputResult.data, authToken);

        setTasks((currentTasks) => {
          const hasTask = currentTasks.some((task) => task.id === editingTaskId);

          if (updatedTask.targetDate !== selectedDate) {
            return currentTasks.filter((task) => task.id !== editingTaskId);
          }

          if (hasTask) {
            return currentTasks.map((task) =>
              task.id === editingTaskId ? { ...task, ...updatedTask } : task
            );
          }

          return [...currentTasks, updatedTask];
        });

        savedTask = updatedTask;
      }

      if (!savedTask.recurrenceSourceTaskId) {
        if (recurrenceResult.data) {
          try {
            const savedRule = await upsertTaskRecurrence(savedTask.id, recurrenceResult.data, authToken);
            setTaskRecurrenceRule(savedRule);
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? isFrench
                  ? `Tache enregistree, mais recurrence non mise a jour : ${error.message}`
                  : `Task saved, but recurrence could not be updated: ${error.message}`
                : isFrench
                ? "Tache enregistree, mais recurrence non mise a jour."
                : "Task saved, but recurrence could not be updated."
            );
          }
        } else if (taskDialogMode === "edit" && taskRecurrenceRule) {
          try {
            await deleteTaskRecurrence(savedTask.id, authToken);
            setTaskRecurrenceRule(null);
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? isFrench
                  ? `Tache enregistree, mais recurrence non supprimee : ${error.message}`
                  : `Task saved, but recurrence could not be removed: ${error.message}`
                : isFrench
                ? "Tache enregistree, mais recurrence non supprimee."
                : "Task saved, but recurrence could not be removed."
            );
          }
        }
      }

      setTaskDialogMode(null);
      setEditingTaskId(null);
      setTaskFormErrorMessage(null);
      resetTaskDetailsState();
    } catch (error) {
      setTaskFormErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible d'enregistrer la tache."
          : "Unable to save task."
      );
    } finally {
      setIsSubmittingTask(false);
    }
  }

  async function handleDeleteTask() {
    if (!taskToDelete || isDeletingTask) {
      return;
    }

    setDeleteErrorMessage(null);
    setIsDeletingTask(true);

    try {
      if (!authToken) {
        throw new Error(isFrench ? "Authentification requise." : "Authentication is required.");
      }

      await deleteTaskById(taskToDelete.id, authToken);
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskToDelete.id));

      if (editingTaskId === taskToDelete.id) {
        setTaskDialogMode(null);
        setEditingTaskId(null);
        resetTaskDetailsState();
      }

      setTaskToDelete(null);
    } catch (error) {
      setDeleteErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de supprimer la tache."
          : "Unable to delete task."
      );
    } finally {
      setIsDeletingTask(false);
    }
  }

  useEffect(() => {
    if (taskDialogMode !== "edit" || !editingTaskId) {
      return;
    }

    if (!authToken) {
      setTaskDetailsErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    let cancelled = false;
    const isGeneratedTask = (editingTask?.recurrenceSourceTaskId ?? null) !== null;
    const requestVersion = taskDetailsRequestVersionRef.current + 1;
    taskDetailsRequestVersionRef.current = requestVersion;

    setIsTaskDetailsLoading(true);
    setTaskDetailsErrorMessage(null);
    setTaskCommentErrorMessage(null);
    setTaskAttachmentErrorMessage(null);

    Promise.all([
      loadTaskComments(editingTaskId, authToken),
      loadTaskAttachments(editingTaskId, authToken),
      isGeneratedTask ? Promise.resolve(null) : loadTaskRecurrence(editingTaskId, authToken),
    ])
      .then(([comments, attachments, recurrenceRule]) => {
        if (cancelled || requestVersion !== taskDetailsRequestVersionRef.current) {
          return;
        }

        setTaskComments(comments);
        setTaskAttachments(attachments);
        setTaskRecurrenceRule(recurrenceRule);
        setRecurrenceFormValues(getRecurrenceFormValues(recurrenceRule));
      })
      .catch((error: unknown) => {
        if (cancelled || requestVersion !== taskDetailsRequestVersionRef.current) {
          return;
        }

        setTaskDetailsErrorMessage(
          error instanceof Error
            ? error.message
            : isFrench
            ? "Impossible de charger les details de la tache."
            : "Unable to load task details."
        );
      })
      .finally(() => {
        if (!cancelled && requestVersion === taskDetailsRequestVersionRef.current) {
          setIsTaskDetailsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, editingTask?.recurrenceSourceTaskId, editingTaskId, isFrench, taskDialogMode]);

  useEffect(() => {
    setGuestLocale(
      getPreferredLocale(window.navigator?.language ?? window.navigator?.languages?.[0] ?? "en")
    );
  }, []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const storedProjectOptions = parseStoredProjectOptions(
      window.localStorage.getItem(PROJECT_OPTIONS_STORAGE_KEY)
    );

    setAuthToken(storedToken);
    setProjectOptions(storedProjectOptions);
    setIsAuthReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!authToken) {
      setAuthUser(null);
      return;
    }

    let cancelled = false;

    loadCurrentUser(authToken)
      .then((user) => {
        if (!cancelled) {
          setAuthUser(user);
          setProfileFormValues(getProfileFormValues(user));
          setAuthErrorMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          if (error instanceof ApiRequestError && error.statusCode === 401) {
            clearAuthSession();
            setAuthErrorMessage(
              isFrench
                ? "Votre session a expire. Veuillez vous reconnecter."
                : "Your session expired. Please sign in again."
            );
            return;
          }

          setAuthErrorMessage(
            error instanceof Error
              ? error.message
              : isFrench
              ? "Impossible de valider votre session pour le moment."
              : "Unable to validate your session right now."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, clearAuthSession, isAuthReady, isFrench]);

  useEffect(() => {
    document.documentElement.lang = activeLocale;
  }, [activeLocale]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!authToken || !authUser) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const controller = new AbortController();

    loadTasksByDate(selectedDate, authToken, controller.signal)
      .then((nextTasks) => {
        setTasks(nextTasks);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setTasks([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : isFrench
            ? "Impossible de charger les taches pour cette date."
            : "Unable to load tasks for this date."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, authUser, isAuthReady, isFrench, selectedDate]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!authToken || !authUser) {
      setGamingTrackSummary(null);
      setGamingTrackErrorMessage(null);
      setIsGamingTrackLoading(false);
      return;
    }

    setIsGamingTrackLoading(true);
    setGamingTrackErrorMessage(null);
    const controller = new AbortController();

    loadGamingTrackSummary(selectedDate, gamingTrackPeriod, authToken, controller.signal)
      .then((summary) => {
        if (controller.signal.aborted) {
          return;
        }

        setGamingTrackSummary(summary);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setGamingTrackSummary(null);
        setGamingTrackErrorMessage(
          error instanceof Error
            ? error.message
            : isFrench
            ? "Impossible de charger le gaming track."
            : "Unable to load gaming track."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsGamingTrackLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, authUser, dayAffirmation, dayBilan, gamingTrackPeriod, isAuthReady, isFrench, selectedDate, tasks]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!authToken || !authUser) {
      setDayAffirmation(null);
      setDayAffirmationDraft(getDefaultAffirmationText(selectedDate, activeLocale));
      setIsDayAffirmationLoading(false);
      return;
    }

    setIsDayAffirmationLoading(true);
    setDayAffirmationErrorMessage(null);
    const controller = new AbortController();

    loadDayAffirmation(selectedDate, authToken, controller.signal)
      .then((nextAffirmation) => {
        if (controller.signal.aborted) {
          return;
        }

        setDayAffirmation(nextAffirmation);
        setDayAffirmationDraft(
          nextAffirmation?.text ?? getDefaultAffirmationText(selectedDate, activeLocale)
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setDayAffirmation(null);
        setDayAffirmationDraft(getDefaultAffirmationText(selectedDate, activeLocale));
        setDayAffirmationErrorMessage(
          error instanceof Error
            ? error.message
            : isFrench
            ? "Impossible de charger l'affirmation du jour."
            : "Unable to load day affirmation."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsDayAffirmationLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeLocale, authToken, authUser, isAuthReady, isFrench, selectedDate]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!authToken || !authUser) {
      setDayBilan(null);
      setDayBilanFormValues(getDefaultDayBilanFormValues());
      setIsDayBilanLoading(false);
      return;
    }

    setIsDayBilanLoading(true);
    setDayBilanErrorMessage(null);
    setDayBilanSuccessMessage(null);
    const controller = new AbortController();

    loadDayBilan(selectedDate, authToken, controller.signal)
      .then((nextBilan) => {
        if (controller.signal.aborted) {
          return;
        }

        setDayBilan(nextBilan);
        setDayBilanFormValues(getDayBilanFormValues(nextBilan));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setDayBilan(null);
        setDayBilanFormValues(getDefaultDayBilanFormValues());
        setDayBilanErrorMessage(
          error instanceof Error
            ? error.message
            : isFrench
            ? "Impossible de charger le bilan du jour."
            : "Unable to load day bilan."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsDayBilanLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, authUser, isAuthReady, isFrench, selectedDate]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    const projectsFromTasks = getUniqueSortedProjectNames(
      tasks.map((task) => task.project ?? "")
    );

    if (projectsFromTasks.length === 0) {
      return;
    }

    setProjectOptions((currentOptions) => {
      const mergedOptions = getUniqueSortedProjectNames([
        ...currentOptions,
        ...projectsFromTasks,
      ]);

      if (areStringListsEqual(currentOptions, mergedOptions)) {
        return currentOptions;
      }

      window.localStorage.setItem(
        PROJECT_OPTIONS_STORAGE_KEY,
        JSON.stringify(mergedOptions)
      );
      return mergedOptions;
    });
  }, [isAuthReady, tasks]);

  useEffect(() => {
    if (!isAssistantPanelOpen) {
      return;
    }

    assistantMessagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [assistantMessages, isAssistantPanelOpen]);

  const tasksByStatus = useMemo(() => {
    return {
      todo: tasks.filter((task) => task.status === "todo"),
      in_progress: tasks.filter((task) => task.status === "in_progress"),
      done: tasks.filter((task) => task.status === "done"),
      cancelled: tasks.filter((task) => task.status === "cancelled"),
    };
  }, [tasks]);

  const isEmptyBoard = !isLoading && !errorMessage && tasks.length === 0;
  const taskDialogTitle = taskDialogMode === "create"
    ? isFrench
      ? "Creer une tache"
      : "Create Task"
    : isFrench
    ? "Modifier la tache"
    : "Edit Task";
  const taskDialogSubmitLabel =
    taskDialogMode === "create"
      ? isSubmittingTask
        ? isFrench
          ? "Creation..."
          : "Creating..."
        : isFrench
        ? "Creer la tache"
        : "Create task"
      : isSubmittingTask
      ? isFrench
        ? "Enregistrement..."
        : "Saving..."
      : isFrench
      ? "Enregistrer les modifications"
      : "Save changes";
  const totalPlannedMinutes = tasks.reduce((total, task) => total + (task.plannedTime ?? 0), 0);
  const actionableTaskCount = tasksByStatus.todo.length + tasksByStatus.in_progress.length;
  const isAffirmationCompleted = dayAffirmation?.isCompleted ?? false;
  const completionItemCount = tasks.length + 1;
  const completedItemCount = tasksByStatus.done.length + (isAffirmationCompleted ? 1 : 0);
  const completionRate =
    completionItemCount === 0 ? 0 : Math.round((completedItemCount / completionItemCount) * 100);
  const gamingTrackPeriodLabel = formatGamingTrackPeriod(gamingTrackPeriod, activeLocale);
  const gamingTrackRangeLabel = gamingTrackSummary
    ? gamingTrackSummary.rangeStart === gamingTrackSummary.rangeEnd
      ? formatDateOnlyForLocale(gamingTrackSummary.rangeStart, activeLocale)
      : `${formatDateOnlyForLocale(gamingTrackSummary.rangeStart, activeLocale)} - ${formatDateOnlyForLocale(
          gamingTrackSummary.rangeEnd,
          activeLocale
        )}`
    : null;
  const gamingMissionWindowLabel = gamingTrackSummary
    ? gamingTrackSummary.weeklyMissionWindow.rangeStart === gamingTrackSummary.weeklyMissionWindow.rangeEnd
      ? formatDateOnlyForLocale(gamingTrackSummary.weeklyMissionWindow.rangeStart, activeLocale)
      : `${formatDateOnlyForLocale(
          gamingTrackSummary.weeklyMissionWindow.rangeStart,
          activeLocale
        )} - ${formatDateOnlyForLocale(gamingTrackSummary.weeklyMissionWindow.rangeEnd, activeLocale)}`
    : null;
  const gamingTrackOverallDelta = gamingTrackSummary?.trend.overallDelta ?? 0;
  const gamingTrackHistoryPoints = gamingTrackSummary
    ? getHistoricalTrendPointsForPeriod(gamingTrackSummary, gamingTrackPeriod)
    : [];
  const gamingTrackHistoryMaxOverall = gamingTrackHistoryPoints.reduce(
    (maxValue, point) => Math.max(maxValue, point.overallScore),
    0
  );

  function handleDragStart(event: DragStartEvent) {
    if (isLoading || pendingTaskIds.length > 0 || isTaskDialogOpen || isMutationPending) {
      return;
    }

    setDragErrorMessage(null);
    setActiveTaskId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);

    if (isLoading || pendingTaskIds.length > 0 || isTaskDialogOpen || isMutationPending) {
      return;
    }

    if (!authToken) {
      setDragErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    const taskId = String(event.active.id);
    const nextStatusId = event.over ? String(event.over.id) : null;

    if (!nextStatusId || !isTaskStatus(nextStatusId)) {
      return;
    }

    const movingTask = tasks.find((task) => task.id === taskId);

    if (!movingTask || movingTask.status === nextStatusId) {
      return;
    }

    setDragErrorMessage(null);
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: nextStatusId,
            }
          : task
      )
    );
    markTaskAsPending(taskId, true);

    try {
      const updatedTask = await updateTaskStatus(taskId, nextStatusId, authToken);
      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === taskId ? { ...task, ...updatedTask } : task))
      );
    } catch (error) {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: movingTask.status,
              }
            : task
        )
      );
      setDragErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de deplacer la tache."
          : "Unable to move task."
      );
    } finally {
      markTaskAsPending(taskId, false);
    }
  }

  if (!isAuthReady) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[720px] items-center justify-center px-4 py-10 sm:px-8">
        <div className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm font-medium text-muted shadow-sm">
          {isFrench ? "Initialisation de la session securisee..." : "Initializing secure session..."}
        </div>
      </div>
    );
  }

  if (!authToken || !authUser) {
    return (
      <AuthPanel
        locale={activeLocale}
        mode={authMode}
        values={authFormValues}
        isSubmitting={isAuthSubmitting}
        errorMessage={authErrorMessage}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthErrorMessage(null);
        }}
        onValueChange={handleAuthFormFieldChange}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <AppNavbar
        locale={activeLocale}
        user={authUser}
        onLogout={handleLogout}
        onOpenProfile={openProfileDialog}
        isBusy={isMutationPending || isLoading}
      />

      <header className="rounded-[1.8rem] border border-line bg-surface/95 px-6 py-6 shadow-[0_34px_80px_-60px_rgba(16,34,48,0.95)] backdrop-blur sm:px-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
            {isFrench ? "Operations quotidiennes des taches" : "Daily Task Operations"}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{APP_NAME}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">{APP_TAGLINE}</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface-soft px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
              {isFrench ? "Total taches" : "Total Tasks"}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{tasks.length}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface-soft px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
              {isFrench ? "Actionnables" : "Actionable"}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{actionableTaskCount}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface-soft px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
              {isFrench ? "Temps planifie" : "Planned Time"}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatPlannedTime(totalPlannedMinutes)}</p>
          </div>
        </div>
      </header>

      <section className="rounded-[1.5rem] border border-line bg-surface px-5 py-5 shadow-[0_18px_45px_-35px_rgba(16,34,48,0.9)] sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted">Gaming Track</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {isFrench ? "Progression et regularite" : "Progress and consistency"}
            </h2>
            <p className="text-sm text-muted">
              {gamingTrackRangeLabel
                ? `${gamingTrackPeriodLabel} · ${gamingTrackRangeLabel}`
                : isFrench
                ? "Suivi periodique de vos resultats."
                : "Periodized tracking of your results."}
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface-soft p-1.5">
            {gamingTrackPeriodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${controlButtonClass} ${
                  gamingTrackPeriod === option.value ? "border-accent bg-accent-soft/60 text-accent" : ""
                }`}
                onClick={() => {
                  setGamingTrackPeriod(option.value);
                }}
                disabled={isGamingTrackLoading}
                aria-pressed={gamingTrackPeriod === option.value}
                title={formatGamingTrackPeriod(option.value, activeLocale)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isGamingTrackLoading ? (
          <p className="mt-4 rounded-xl border border-line bg-surface-soft px-3 py-2 text-sm text-muted">
            {isFrench ? "Chargement du gaming track..." : "Loading gaming track..."}
          </p>
        ) : null}

        {gamingTrackSummary ? (
          <>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-accent/25 bg-accent-soft/30 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                  {isFrench ? "Score global" : "Overall score"}
                </p>
                <p className="mt-1 text-3xl font-semibold text-foreground">
                  {gamingTrackSummary.scores.overall}
                  <span className="ml-1 text-sm text-muted">/100</span>
                </p>
                <p className="mt-1 text-xs font-medium text-muted">
                  {isFrench ? "Tendance" : "Trend"} {formatSignedDelta(gamingTrackOverallDelta)}
                  {isFrench ? " pts" : " pts"}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-surface-soft px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                    {isFrench ? "Execution" : "Execution"}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{gamingTrackSummary.scores.execution}</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-soft px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                    {isFrench ? "Reflection" : "Reflection"}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{gamingTrackSummary.scores.reflection}</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-soft px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                    {isFrench ? "Consistance" : "Consistency"}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{gamingTrackSummary.scores.consistency}</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-soft px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                    {isFrench ? "Momentum" : "Momentum"}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{gamingTrackSummary.scores.momentum}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-surface-soft px-3 py-3 text-sm">
                <p className="font-semibold text-foreground">
                  {isFrench ? "Taches terminees" : "Tasks completed"}{" "}
                  {gamingTrackSummary.tasks.done}/{gamingTrackSummary.tasks.total}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {isFrench ? "Completion" : "Completion"} {gamingTrackSummary.tasks.completionRate}%
                  {" · "}
                  {isFrench ? "Reprises" : "Carry over"} {gamingTrackSummary.tasks.carriedOver}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-surface-soft px-3 py-3 text-sm">
                <p className="font-semibold text-foreground">
                  {isFrench ? "Affirmations" : "Affirmations"}{" "}
                  {gamingTrackSummary.affirmations.completedDays}/{gamingTrackSummary.affirmations.totalDays}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {isFrench ? "Taux de completion" : "Completion rate"}{" "}
                  {gamingTrackSummary.affirmations.completionRate}%
                </p>
              </div>
              <div className="rounded-xl border border-line bg-surface-soft px-3 py-3 text-sm">
                <p className="font-semibold text-foreground">
                  {isFrench ? "Bilans" : "Bilans"} {gamingTrackSummary.bilans.completedDays}/
                  {gamingTrackSummary.bilans.totalDays}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {isFrench ? "Taux de completion" : "Completion rate"} {gamingTrackSummary.bilans.completionRate}%
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-soft px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                  {isFrench ? "Missions hebdo" : "Weekly missions"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {gamingMissionWindowLabel
                    ? `${isFrench ? "Fenetre" : "Window"}: ${gamingMissionWindowLabel}`
                    : null}
                </p>
                <div className="mt-2 grid gap-2">
                  {gamingTrackSummary.missions.map((mission) => (
                    <div key={mission.id} className="rounded-lg border border-line bg-surface px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">
                          {formatGamingTrackMissionLabel(mission.id, activeLocale)}
                        </p>
                        <p className="text-xs font-semibold text-muted">
                          {mission.progress}/{mission.target}
                        </p>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface-soft">
                        <div
                          className={`h-full rounded-full ${mission.completed ? "bg-emerald-500" : "bg-accent"}`}
                          style={{ width: `${Math.min(100, Math.round((mission.progress / mission.target) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-soft px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                  {isFrench ? "Records personnels" : "Personal bests"}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-line bg-surface px-2.5 py-2">
                    <p className="text-[11px] text-muted">{isFrench ? "Max taches/jour" : "Best day throughput"}</p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {gamingTrackSummary.personalBests.dailyDoneTasks}
                    </p>
                    {gamingTrackSummary.personalBests.dailyDoneTasksDate ? (
                      <p className="text-[11px] text-muted">
                        {formatDateOnlyForLocale(gamingTrackSummary.personalBests.dailyDoneTasksDate, activeLocale)}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-lg border border-line bg-surface px-2.5 py-2">
                    <p className="text-[11px] text-muted">{isFrench ? "Serie execution" : "Execution streak"}</p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {gamingTrackSummary.personalBests.executionBestStreak}
                    </p>
                  </div>
                  <div className="rounded-lg border border-line bg-surface px-2.5 py-2">
                    <p className="text-[11px] text-muted">{isFrench ? "Serie reflection" : "Reflection streak"}</p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {gamingTrackSummary.personalBests.reflectionBestStreak}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-soft px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                  {isFrench ? "Niveau et badges" : "Level and badges"}
                </p>
                <div className="mt-2 rounded-lg border border-line bg-surface px-2.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {isFrench ? "Niveau" : "Level"} {gamingTrackSummary.level.level}
                    </p>
                    <p className="text-xs font-semibold text-muted">
                      {formatGamingTrackRank(gamingTrackSummary.level.rank, activeLocale)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    XP {gamingTrackSummary.level.currentLevelXp}/{gamingTrackSummary.level.nextLevelXp}
                    {" · "}
                    {gamingTrackSummary.level.xp} XP total
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-surface-soft">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${gamingTrackSummary.level.progressToNextLevel}%` }}
                    />
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {gamingTrackSummary.badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`rounded-lg border px-2.5 py-2 ${getBadgeTierClass(badge.tier, badge.unlocked)}`}
                    >
                      <p className="text-xs font-semibold">{formatGamingTrackBadgeLabel(badge.id, activeLocale)}</p>
                      <p className="mt-1 text-[11px]">
                        {badge.progress}/{badge.target}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-soft px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                  {isFrench ? "Protection de serie" : "Streak protection"}
                </p>
                <div className="mt-2 rounded-lg border border-line bg-surface px-2.5 py-2.5 text-sm">
                  <p className="font-semibold text-foreground">
                    {isFrench ? "Charges disponibles" : "Charges available"}{" "}
                    {gamingTrackSummary.streakProtection.availableCharges}/{gamingTrackSummary.streakProtection.maxCharges}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {isFrench ? "Total gagnees" : "Earned total"}: {gamingTrackSummary.streakProtection.earnedCharges}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {gamingTrackSummary.streakProtection.atRisk
                      ? isFrench
                        ? "Serie en risque aujourd'hui."
                        : "A streak is at risk today."
                      : isFrench
                      ? "Aucune serie en risque."
                      : "No streak currently at risk."}
                  </p>
                  {gamingTrackSummary.streakProtection.recommended ? (
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      {isFrench
                        ? "Utiliser une protection est recommande pour conserver la serie."
                        : "Using protection is recommended to preserve the streak."}
                    </p>
                  ) : null}
                  {(gamingTrackSummary.streakProtection.projectedExecutionStreak > 0 ||
                    gamingTrackSummary.streakProtection.projectedReflectionStreak > 0) ? (
                    <p className="mt-1 text-xs text-muted">
                      {isFrench ? "Serie projetee" : "Projected streak"}:{" "}
                      {isFrench ? "Execution" : "Execution"} {gamingTrackSummary.streakProtection.projectedExecutionStreak}
                      {" · "}
                      {isFrench ? "Reflection" : "Reflection"} {gamingTrackSummary.streakProtection.projectedReflectionStreak}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-line bg-surface-soft px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                {isFrench ? "Tendances historiques" : "Historical trends"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {isFrench ? "Vue" : "View"}: {gamingTrackPeriodLabel}
              </p>
              <div className="mt-2 grid gap-2">
                {gamingTrackHistoryPoints.slice(-8).map((point) => {
                  const normalizedWidth =
                    gamingTrackHistoryMaxOverall === 0
                      ? 0
                      : Math.round((point.overallScore / gamingTrackHistoryMaxOverall) * 100);

                  return (
                    <div key={`${point.label}-${point.rangeStart}`} className="rounded-lg border border-line bg-surface px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">
                          {formatHistoricalTrendLabel(point, gamingTrackPeriod, activeLocale)}
                        </p>
                        <p className="text-xs font-semibold text-muted">
                          {isFrench ? "Score" : "Score"} {point.overallScore}
                        </p>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface-soft">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${normalizedWidth}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {isFrench ? "Taches" : "Tasks"} {point.tasksDone}
                        {" · "}
                        {isFrench ? "Completion" : "Completion"} {point.taskCompletionRate}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-soft px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                  {isFrench ? "Challenge hebdo et classement" : "Weekly challenge and leaderboard"}
                </p>
                <div className="mt-2 rounded-lg border border-line bg-surface px-2.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {formatGamingTrackChallengeLabel(gamingTrackSummary.engagement.challenge.id, activeLocale)}
                    </p>
                    <p className="text-xs font-semibold text-muted">+{gamingTrackSummary.engagement.challenge.rewardXp} XP</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {gamingTrackSummary.engagement.challenge.progress}/{gamingTrackSummary.engagement.challenge.target}
                    {" · "}
                    {isFrench ? "Expire le" : "Expires"}{" "}
                    {formatDateOnlyForLocale(gamingTrackSummary.engagement.challenge.expiresOn, activeLocale)}
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-surface-soft">
                    <div
                      className={`h-full rounded-full ${
                        gamingTrackSummary.engagement.challenge.completed ? "bg-emerald-500" : "bg-accent"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (gamingTrackSummary.engagement.challenge.progress /
                              Math.max(1, gamingTrackSummary.engagement.challenge.target)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-2 rounded-lg border border-line bg-surface px-2.5 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">
                      {isFrench ? "Rang personnel" : "Personal rank"} {gamingTrackSummary.engagement.leaderboard.rank}/
                      {gamingTrackSummary.engagement.leaderboard.total}
                    </p>
                    <p className="text-xs font-semibold text-muted">
                      {isFrench ? "Percentile" : "Percentile"} {gamingTrackSummary.engagement.leaderboard.percentile}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    {isFrench ? "Score courant" : "Current score"} {gamingTrackSummary.engagement.leaderboard.currentScore}
                    {" · "}
                    {isFrench ? "Top" : "Top"} {gamingTrackSummary.engagement.leaderboard.topScore}
                  </p>

                  <div className="mt-2 grid gap-1.5">
                    {gamingTrackSummary.engagement.leaderboard.entries.map((entry) => (
                      <div
                        key={`${entry.label}-${entry.rangeStart}`}
                        className={`rounded-md border px-2 py-1.5 ${
                          entry.isCurrent ? "border-accent/45 bg-accent-soft/30" : "border-line bg-surface-soft"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold text-foreground">
                            {formatDateOnlyForLocale(entry.rangeStart, activeLocale)}
                          </p>
                          <p className="text-[11px] font-semibold text-muted">
                            {isFrench ? "Score" : "Score"} {entry.score}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-soft px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                  {isFrench ? "Recap et nudges" : "Recap and nudges"}
                </p>
                <div className="mt-2 rounded-lg border border-line bg-surface px-2.5 py-2.5">
                  <p className="text-sm font-semibold text-foreground">
                    {formatGamingTrackRecapHeadline(gamingTrackSummary.engagement.recap.headline, activeLocale)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {formatDateOnlyForLocale(gamingTrackSummary.engagement.recap.periodStart, activeLocale)}
                    {" - "}
                    {formatDateOnlyForLocale(gamingTrackSummary.engagement.recap.periodEnd, activeLocale)}
                  </p>

                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {gamingTrackSummary.engagement.recap.highlights.map((highlight) => (
                      <div key={highlight.id} className="rounded-md border border-line bg-surface-soft px-2 py-1.5">
                        <p className="text-[11px] text-muted">
                          {formatGamingTrackRecapHighlightLabel(highlight.id, activeLocale)}
                        </p>
                        <p className="text-xs font-semibold text-foreground">
                          {highlight.value}
                          {highlight.delta !== null ? ` (${formatSignedDelta(highlight.delta)})` : ""}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {gamingTrackSummary.engagement.recap.focus.map((focusId) => (
                      <span
                        key={focusId}
                        className="inline-flex items-center rounded-full border border-line bg-surface-soft px-2.5 py-1 text-[11px] text-foreground/85"
                      >
                        {formatGamingTrackRecapFocus(focusId, activeLocale)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-2 rounded-lg border border-line bg-surface px-2.5 py-2.5">
                  <p className="text-xs font-semibold text-foreground">{isFrench ? "Nudges actifs" : "Active nudges"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {gamingTrackSummary.engagement.nudges.map((nudge, index) => (
                      <span
                        key={`${nudge.id}-${index}`}
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getGamingTrackNudgeClass(
                          nudge.severity
                        )}`}
                      >
                        {formatGamingTrackNudgeLabel(nudge.id, activeLocale)}: {nudge.metric}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {gamingTrackErrorMessage ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {gamingTrackErrorMessage}
          </p>
        ) : null}
      </section>

      <section className="rounded-[1.5rem] border border-line bg-surface px-5 py-5 shadow-[0_18px_45px_-35px_rgba(16,34,48,0.9)] sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-soft p-1.5">
            <button
              type="button"
              className={controlButtonClass}
              onClick={() => handleDateChange(shiftDate(selectedDate, -1))}
              disabled={isMutationPending}
            >
              {isFrench ? "Jour precedent" : "Previous Day"}
            </button>
            <button
              type="button"
              className={controlButtonClass}
              onClick={() => handleDateChange(toDateInputValue(new Date()))}
              disabled={isMutationPending}
            >
              {isFrench ? "Aujourd'hui" : "Today"}
            </button>
            <button
              type="button"
              className={controlButtonClass}
              onClick={() => handleDateChange(shiftDate(selectedDate, 1))}
              disabled={isMutationPending}
            >
              {isFrench ? "Jour suivant" : "Next Day"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={controlButtonClass}
              onClick={handleCarryOverYesterday}
              disabled={isMutationPending || isLoading || isDayAffirmationSaving}
            >
              {isCarryingOverYesterday
                ? isFrench
                  ? "Copie..."
                  : "Carrying..."
                : isFrench
                ? "Copier les taches d'hier"
                : "Carry Over Yesterday"}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => openCreateTaskDialog()}
              disabled={isMutationPending}
            >
              {isFrench ? "Nouvelle tache" : "New Task"}
            </button>
          </div>

          <label className="flex min-w-[210px] flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            {isFrench ? "Date selectionnee" : "Selected Date"}
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                if (event.target.value) {
                  handleDateChange(event.target.value);
                }
              }}
              disabled={isMutationPending}
              className={textFieldClass}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-soft px-3 py-2 text-sm text-muted">
          <p className="font-semibold text-foreground">{getDateHeading(selectedDate, activeLocale)}</p>
          <p className="font-medium">
            {isLoading
              ? isFrench
                ? "Chargement des taches..."
                : "Loading tasks..."
              : isFrench
              ? `${tasks.length} tache${tasks.length === 1 ? "" : "s"} pour la date selectionnee`
              : `${tasks.length} task${tasks.length === 1 ? "" : "s"} for the selected date`}
          </p>
          <p className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
            {isFrench ? "Completion" : "Completion"} {completionRate}%
          </p>
        </div>
      </section>

      {carryOverMessage ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {carryOverMessage}
        </section>
      ) : null}

      {carryOverErrorMessage ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {carryOverErrorMessage}
        </section>
      ) : null}

      <section className="rounded-[1.5rem] border border-line bg-surface px-5 py-5 shadow-[0_18px_45px_-35px_rgba(16,34,48,0.9)] sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted">Miracle Morning</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {isFrench ? "Affirmation du jour" : "Day Affirmation"}
            </h2>
            <p className="text-sm text-muted">
              {isFrench
                ? "Une phrase intentionnelle pour la journee. Cochez-la pour l'inclure dans la completion."
                : "One intentional statement for the day. Mark it done to include it in completion."}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-soft px-3 py-2 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              checked={isAffirmationCompleted}
              onChange={(event) => {
                void saveDayAffirmation({ isCompleted: event.target.checked });
              }}
              disabled={isDayAffirmationLoading || isDayAffirmationSaving}
            />
            {isFrench ? "Affirmation terminee" : "Affirmation completed"}
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block text-sm font-semibold text-foreground">
            {isFrench ? "Phrase du jour" : "Today statement"}
            <textarea
              value={dayAffirmationDraft}
              onChange={(event) => {
                setDayAffirmationDraft(event.target.value);
                setDayAffirmationErrorMessage(null);
              }}
              className={`${textFieldClass} mt-1 min-h-[94px] resize-y`}
              maxLength={DAY_AFFIRMATION_MAX_LENGTH}
              disabled={isDayAffirmationLoading || isDayAffirmationSaving}
            />
          </label>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => {
              void saveDayAffirmation({ text: dayAffirmationDraft });
            }}
            disabled={isDayAffirmationLoading || isDayAffirmationSaving}
          >
            {isDayAffirmationSaving
              ? isFrench
                ? "Enregistrement..."
                : "Saving..."
              : isFrench
              ? "Enregistrer l'affirmation"
              : "Save affirmation"}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <p>
            {dayAffirmationDraft.trim().length}/{DAY_AFFIRMATION_MAX_LENGTH}
          </p>
          {dayAffirmation?.updatedAt ? (
            <p>
              {isFrench ? "Derniere mise a jour" : "Last update"}:{" "}
              {formatDateTime(dayAffirmation.updatedAt, activeLocale, activeTimeZone)}
            </p>
          ) : null}
        </div>

        {dayAffirmationErrorMessage ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {dayAffirmationErrorMessage}
          </p>
        ) : null}
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {errorMessage}
        </section>
      ) : null}

      {dragErrorMessage ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {dragErrorMessage}
        </section>
      ) : null}

      {isEmptyBoard ? (
        <section className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted shadow-sm">
          <p className="font-semibold text-foreground">
            {isFrench
              ? "Aucune tache n'est planifiee pour cette date."
              : "No tasks are scheduled for this date yet."}
          </p>
          <p className="mt-1">
            {isFrench
              ? "Creez votre premiere tache pour remplir ce tableau."
              : "Create your first task to populate this board."}
          </p>
        </section>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTaskId(null)}
      >
        <main className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {boardColumns.map((column) => {
            const columnTasks = tasksByStatus[column.status];

            return (
              <section
                key={column.status}
                className={`flex min-h-[340px] flex-col rounded-3xl border border-line border-t-4 bg-surface px-4 py-4 shadow-[0_16px_35px_-30px_rgba(16,34,48,0.9)] ${statusColumnClassByStatus[column.status]}`}
              >
                <header className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">
                    {column.label}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusChipClassByStatus[column.status]}`}
                    >
                      {columnTasks.length}
                    </span>
                    <button
                      type="button"
                      className={`${iconButtonClass} h-7 px-2.5 text-[11px]`}
                      onClick={() => openCreateTaskDialog(column.status)}
                      disabled={isMutationPending}
                    >
                      + {isFrench ? "Tache" : "Task"}
                    </button>
                  </div>
                </header>

                <TaskColumn status={column.status}>
                  {isLoading ? (
                    <>
                      <div className="h-20 animate-pulse rounded-2xl bg-surface-soft" />
                      <div className="h-16 animate-pulse rounded-2xl bg-surface-soft" />
                    </>
                  ) : columnTasks.length > 0 ? (
                    columnTasks.map((task) => {
                      const isSavingTask =
                        pendingTaskIds.includes(task.id) ||
                        (isDeletingTask && taskToDelete?.id === task.id) ||
                        (isSubmittingTask && editingTaskId === task.id);

                      return (
                        <TaskCard
                          key={task.id}
                          locale={activeLocale}
                          task={task}
                          isDragging={activeTaskId === task.id}
                          isSaving={isSavingTask}
                          onEdit={openEditTaskDialog}
                          onDelete={openDeleteDialog}
                        />
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-line bg-surface-soft px-3 py-4 text-sm text-muted">
                      {column.emptyLabel}
                    </div>
                  )}
                </TaskColumn>
              </section>
            );
          })}
        </main>
      </DndContext>

      <section className="rounded-[1.5rem] border border-line bg-surface px-5 py-5 shadow-[0_18px_45px_-35px_rgba(16,34,48,0.9)] sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted">
              {isFrench ? "Fin de journee" : "End Of Day"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {isFrench ? "Bilan du jour" : "Day Bilan"}
            </h2>
            <p className="text-sm text-muted">
              {isFrench
                ? "Capturez vos victoires, blocages et top 3 pour demain."
                : "Capture wins, blockers, and your top 3 for tomorrow."}
            </p>
          </div>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={handleSaveDayBilan}
            disabled={isDayBilanLoading || isDayBilanSaving}
          >
            {isDayBilanSaving
              ? isFrench
                ? "Enregistrement..."
                : "Saving..."
              : isFrench
              ? "Enregistrer le bilan"
              : "Save bilan"}
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface-soft px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              {isFrench ? "Taches terminees" : "Done Tasks"}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">{tasksByStatus.done.length}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-soft px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              {isFrench ? "Actionnables" : "Actionable"}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">{actionableTaskCount}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-soft px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              {isFrench ? "Annulees" : "Cancelled"}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">{tasksByStatus.cancelled.length}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-soft px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              {isFrench ? "Affirmation" : "Affirmation"}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {isAffirmationCompleted
                ? isFrench
                  ? "Terminee"
                  : "Done"
                : isFrench
                ? "En attente"
                : "Pending"}
            </p>
          </div>
        </div>

        {isDayBilanLoading ? (
          <p className="mt-4 text-sm text-muted">
            {isFrench ? "Chargement du bilan du jour..." : "Loading day bilan..."}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              {isFrench ? "Humeur (1-5)" : "Mood (1-5)"}
              <select
                value={dayBilanFormValues.mood}
                onChange={(event) => updateDayBilanField("mood", event.target.value)}
                className={textFieldClass}
                disabled={isDayBilanSaving}
              >
                <option value="">{isFrench ? "Non defini" : "Not set"}</option>
                <option value="1">{isFrench ? "1 - Journee tres difficile" : "1 - Very hard day"}</option>
                <option value="2">{isFrench ? "2 - Journee difficile" : "2 - Hard day"}</option>
                <option value="3">{isFrench ? "3 - Journee neutre" : "3 - Neutral day"}</option>
                <option value="4">{isFrench ? "4 - Bonne journee" : "4 - Good day"}</option>
                <option value="5">{isFrench ? "5 - Excellente journee" : "5 - Excellent day"}</option>
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Victoires" : "Wins"}
                <textarea
                  value={dayBilanFormValues.wins}
                  onChange={(event) => updateDayBilanField("wins", event.target.value)}
                  className={`${textFieldClass} mt-1 min-h-[110px] resize-y`}
                  maxLength={DAY_BILAN_FIELD_MAX_LENGTH}
                  disabled={isDayBilanSaving}
                />
              </label>
              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Blocages" : "Blockers"}
                <textarea
                  value={dayBilanFormValues.blockers}
                  onChange={(event) => updateDayBilanField("blockers", event.target.value)}
                  className={`${textFieldClass} mt-1 min-h-[110px] resize-y`}
                  maxLength={DAY_BILAN_FIELD_MAX_LENGTH}
                  disabled={isDayBilanSaving}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Lecons apprises" : "Lessons learned"}
                <textarea
                  value={dayBilanFormValues.lessonsLearned}
                  onChange={(event) => updateDayBilanField("lessonsLearned", event.target.value)}
                  className={`${textFieldClass} mt-1 min-h-[110px] resize-y`}
                  maxLength={DAY_BILAN_FIELD_MAX_LENGTH}
                  disabled={isDayBilanSaving}
                />
              </label>
              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Top 3 de demain" : "Tomorrow top 3"}
                <textarea
                  value={dayBilanFormValues.tomorrowTop3}
                  onChange={(event) => updateDayBilanField("tomorrowTop3", event.target.value)}
                  className={`${textFieldClass} mt-1 min-h-[110px] resize-y`}
                  maxLength={DAY_BILAN_FIELD_MAX_LENGTH}
                  disabled={isDayBilanSaving}
                />
              </label>
            </div>
          </div>
        )}

        {dayBilan?.updatedAt ? (
          <p className="mt-3 text-xs text-muted">
            {isFrench ? "Derniere mise a jour" : "Last update"}:{" "}
            {formatDateTime(dayBilan.updatedAt, activeLocale, activeTimeZone)}
          </p>
        ) : null}

        {dayBilanErrorMessage ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {dayBilanErrorMessage}
          </p>
        ) : null}

        {dayBilanSuccessMessage ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {dayBilanSuccessMessage}
          </p>
        ) : null}
      </section>

      {isTaskDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#09131f]/55 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTaskDialog();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={taskDialogTitle}
            className={`flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-surface p-4 shadow-[0_40px_80px_-50px_rgba(0,0,0,0.95)] sm:p-5 ${taskDialogHeightClass}`}
          >
            <header className="mb-3 flex shrink-0 items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{taskDialogTitle}</h2>
                <p className="mt-1 text-sm text-muted">
                  {isFrench
                    ? "Precisez bien les details pour faciliter l'execution."
                    : "Set details clearly so this task is easy to complete."}
                </p>
              </div>
              <button
                type="button"
                className={controlButtonClass}
                onClick={closeTaskDialog}
                disabled={isSubmittingTask}
              >
                {isFrench ? "Fermer" : "Close"}
              </button>
            </header>

            <form className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" onSubmit={handleTaskFormSubmit}>
              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Titre" : "Title"}
                <input
                  type="text"
                  value={taskFormValues.title}
                  onChange={(event) => updateTaskFormField("title", event.target.value)}
                  className={textFieldClass}
                  maxLength={200}
                  placeholder={isFrench ? "Ecrivez une action concise" : "Write a concise action item"}
                  required
                  disabled={isSubmittingTask}
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Description" : "Description"}
                <RichTextEditor
                  locale={activeLocale}
                  value={taskFormValues.description}
                  onChange={(nextValue) => updateTaskFormField("description", nextValue)}
                  disabled={isSubmittingTask}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-foreground">
                  {isFrench ? "Statut" : "Status"}
                  <select
                    value={taskFormValues.status}
                    onChange={(event) => {
                      if (isTaskStatus(event.target.value)) {
                        updateTaskFormField("status", event.target.value);
                      }
                    }}
                    className={textFieldClass}
                    disabled={isSubmittingTask}
                  >
                    {boardColumns.map((column) => (
                      <option key={column.status} value={column.status}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-semibold text-foreground">
                  {isFrench ? "Priorite" : "Priority"}
                  <select
                    value={taskFormValues.priority}
                    onChange={(event) => {
                      if (isTaskPriority(event.target.value)) {
                        updateTaskFormField("priority", event.target.value);
                      }
                    }}
                    className={textFieldClass}
                    disabled={isSubmittingTask}
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-foreground">
                  {isFrench ? "Date cible" : "Target Date"}
                  <input
                    type="date"
                    value={taskFormValues.targetDate}
                    onChange={(event) => updateTaskFormField("targetDate", event.target.value)}
                    className={textFieldClass}
                    required
                    disabled={isSubmittingTask}
                  />
                </label>

                <label className="block text-sm font-semibold text-foreground">
                  {isFrench ? "Temps planifie (minutes)" : "Planned Time (minutes)"}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={taskFormValues.plannedTime}
                    onChange={(event) => updateTaskFormField("plannedTime", event.target.value)}
                    className={textFieldClass}
                    disabled={isSubmittingTask}
                  />
                </label>
              </div>

              <section className="rounded-2xl border border-line bg-surface-soft/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{isFrench ? "Projet" : "Project"}</h3>
                    <p className="text-xs text-muted">
                      {isFrench
                        ? "Selectionnez un projet existant ou creez-en un nouveau."
                        : "Select an existing project or create a new one."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={dangerButtonClass}
                    onClick={handleDeleteSelectedProjectOption}
                    disabled={
                      isSubmittingTask ||
                      !normalizedSelectedProject ||
                      selectedProjectIsUsed
                    }
                  >
                    {isFrench ? "Supprimer le projet" : "Delete Project"}
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <label className="block text-sm font-semibold text-foreground">
                    {isFrench ? "Projet" : "Project"}
                    <select
                      value={taskFormValues.project}
                      onChange={(event) => updateTaskFormField("project", event.target.value)}
                      className={textFieldClass}
                      disabled={isSubmittingTask}
                    >
                      <option value="">{isFrench ? "Aucun projet" : "No project"}</option>
                      {projectSelectOptions.map((projectName) => (
                        <option key={projectName} value={projectName}>
                          {projectName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="text-xs text-muted">
                    {selectedProjectIsUsed
                      ? isFrench
                        ? "Utilise sur le tableau actuel"
                        : "Used on current board"
                      : isFrench
                      ? "Peut etre supprime s'il est inutilise"
                      : "Can be deleted if unused"}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <label className="block text-sm font-semibold text-foreground">
                    {isFrench ? "Nouveau projet" : "New Project"}
                    <input
                      type="text"
                      value={newProjectDraft}
                      onChange={(event) => setNewProjectDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleCreateProjectOption();
                        }
                      }}
                      className={textFieldClass}
                      placeholder={isFrench ? "Saisissez un nom de projet" : "Type a project name"}
                      disabled={isSubmittingTask}
                    />
                  </label>
                  <button
                    type="button"
                    className={controlButtonClass}
                    onClick={handleCreateProjectOption}
                    disabled={isSubmittingTask}
                  >
                    {isFrench ? "Ajouter le projet" : "Add Project"}
                  </button>
                </div>

                {projectFormErrorMessage ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {projectFormErrorMessage}
                  </p>
                ) : null}
              </section>

              <section className="rounded-2xl border border-line bg-surface-soft/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {isFrench ? "Recurrence" : "Recurrence"}
                    </h3>
                    <p className="text-xs text-muted">
                      {isFrench
                        ? "Cree automatiquement les futures occurrences de tache."
                        : "Automatically create future task instances."}
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={recurrenceFormValues.enabled}
                      onChange={(event) =>
                        updateRecurrenceFormField("enabled", event.target.checked)
                      }
                      disabled={isSubmittingTask || isEditingGeneratedTask}
                    />
                    {isFrench ? "Repeter la tache" : "Repeat task"}
                  </label>
                </div>

                {isEditingGeneratedTask ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {isFrench
                      ? "Ceci est une occurrence generee. Modifiez la tache source pour changer la recurrence."
                      : "This is a generated recurrence instance. Edit the source task to change recurrence."}
                  </p>
                ) : null}

                {recurrenceFormValues.enabled && !isEditingGeneratedTask ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-semibold text-foreground">
                        {isFrench ? "Frequence" : "Frequency"}
                        <select
                          value={recurrenceFormValues.frequency}
                          onChange={(event) =>
                            updateRecurrenceFormField("frequency", event.target.value)
                          }
                          className={textFieldClass}
                          disabled={isSubmittingTask}
                        >
                          {recurrenceFrequencyOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-sm font-semibold text-foreground">
                        {isFrench ? "Chaque" : "Every"}
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={recurrenceFormValues.interval}
                          onChange={(event) =>
                            updateRecurrenceFormField("interval", event.target.value)
                          }
                          className={textFieldClass}
                          disabled={isSubmittingTask}
                        />
                      </label>
                    </div>

                    {recurrenceFormValues.frequency === "weekly" ? (
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {isFrench ? "Jours de semaine" : "Weekdays"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {weekdayOptions.map((option) => {
                            const isSelected = recurrenceFormValues.weekdays.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                  isSelected
                                    ? "border-accent bg-accent text-white"
                                    : "border-line bg-surface text-foreground/85 hover:border-accent/45 hover:text-accent"
                                }`}
                                onClick={() => toggleRecurrenceWeekday(option.value)}
                                disabled={isSubmittingTask}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <label className="block text-sm font-semibold text-foreground">
                      {isFrench ? "Se termine le (optionnel)" : "Ends On (optional)"}
                      <input
                        type="date"
                        value={recurrenceFormValues.endsOn}
                        onChange={(event) => updateRecurrenceFormField("endsOn", event.target.value)}
                        className={textFieldClass}
                        disabled={isSubmittingTask}
                      />
                    </label>
                  </div>
                ) : null}
              </section>

              {taskDialogMode === "edit" ? (
                <section className="max-h-[42vh] space-y-4 overflow-y-auto rounded-2xl border border-line bg-surface-soft/50 p-4">
                  <header>
                    <h3 className="text-sm font-semibold text-foreground">
                      {isFrench ? "Details de la tache" : "Task Details"}
                    </h3>
                    <p className="text-xs text-muted">
                      {isFrench ? "Commentaires et pieces jointes pour cette tache." : "Comments and attachments for this task."}
                    </p>
                  </header>

                  {isTaskDetailsLoading ? (
                    <p className="text-sm text-muted">
                      {isFrench ? "Chargement des details de la tache..." : "Loading task details..."}
                    </p>
                  ) : null}

                  {taskDetailsErrorMessage ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {taskDetailsErrorMessage}
                    </p>
                  ) : null}

                  <section>
                    <h4 className="text-sm font-semibold text-foreground">
                      {isFrench ? "Commentaires" : "Comments"} ({taskComments.length})
                    </h4>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                      {taskComments.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-line bg-surface px-3 py-2 text-sm text-muted">
                          {isFrench ? "Aucun commentaire pour le moment." : "No comments yet."}
                        </p>
                      ) : (
                        taskComments.map((comment) => (
                          <article
                            key={comment.id}
                            className="rounded-xl border border-line bg-surface px-3 py-2.5"
                          >
                            <p className="text-sm text-foreground">{comment.body}</p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <p className="text-xs text-muted">
                                {formatDateTime(comment.createdAt, activeLocale, activeTimeZone)}
                              </p>
                              <button
                                type="button"
                                className={`${iconButtonClass} h-7 px-2.5 text-[11px]`}
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={
                                  isSubmittingTask ||
                                  isTaskDetailsLoading ||
                                  pendingCommentIds.includes(comment.id)
                                }
                              >
                                {pendingCommentIds.includes(comment.id)
                                  ? isFrench
                                    ? "Suppression..."
                                    : "Removing..."
                                  : isFrench
                                  ? "Retirer"
                                  : "Remove"}
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      <textarea
                        value={taskCommentDraft}
                        onChange={(event) => setTaskCommentDraft(event.target.value)}
                        className={`${textFieldClass} mt-0 min-h-[76px] resize-y`}
                        placeholder={isFrench ? "Ajouter un commentaire..." : "Add a comment..."}
                        disabled={isSubmittingTask || isCreatingTaskComment || isTaskDetailsLoading}
                      />
                      {taskCommentErrorMessage ? (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          {taskCommentErrorMessage}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className={controlButtonClass}
                        onClick={handleCreateComment}
                        disabled={isSubmittingTask || isCreatingTaskComment || isTaskDetailsLoading}
                      >
                        {isCreatingTaskComment
                          ? isFrench
                            ? "Ajout..."
                            : "Adding..."
                          : isFrench
                          ? "Ajouter un commentaire"
                          : "Add comment"}
                      </button>
                    </div>
                  </section>

                  <section>
                    <h4 className="text-sm font-semibold text-foreground">
                      {isFrench ? "Pieces jointes" : "Attachments"} ({taskAttachments.length})
                    </h4>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                      {taskAttachments.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-line bg-surface px-3 py-2 text-sm text-muted">
                          {isFrench ? "Aucune piece jointe pour le moment." : "No attachments yet."}
                        </p>
                      ) : (
                        taskAttachments.map((attachment) => (
                          <article
                            key={attachment.id}
                            className="rounded-xl border border-line bg-surface px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">{attachment.name}</p>
                                <a
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                                  download={isDataUrl(attachment.url) ? attachment.name : undefined}
                                >
                                  {isDataUrl(attachment.url)
                                    ? isFrench
                                      ? "Ouvrir le fichier"
                                      : "Open file"
                                    : attachment.url}
                                </a>
                                {attachment.contentType || typeof attachment.sizeBytes === "number" ? (
                                  <p className="mt-1 text-[11px] text-muted">
                                    {[
                                      attachment.contentType ?? null,
                                      typeof attachment.sizeBytes === "number"
                                        ? formatFileSize(attachment.sizeBytes)
                                        : null,
                                    ]
                                      .filter((value): value is string => Boolean(value))
                                      .join(" · ")}
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className={`${iconButtonClass} h-7 px-2.5 text-[11px]`}
                                onClick={() => handleDeleteAttachment(attachment.id)}
                                disabled={
                                  isSubmittingTask ||
                                  isTaskDetailsLoading ||
                                  pendingAttachmentIds.includes(attachment.id)
                                }
                              >
                                {pendingAttachmentIds.includes(attachment.id)
                                  ? isFrench
                                    ? "Suppression..."
                                    : "Removing..."
                                  : isFrench
                                  ? "Retirer"
                                  : "Remove"}
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
                      <label className="block text-sm font-semibold text-foreground">
                        {isFrench ? "Nom" : "Name"}
                        <input
                          type="text"
                          value={taskAttachmentNameDraft}
                          onChange={(event) => setTaskAttachmentNameDraft(event.target.value)}
                          className={textFieldClass}
                          disabled={isSubmittingTask || isCreatingTaskAttachment || isTaskDetailsLoading}
                          placeholder={isFrench ? "Spec" : "Spec"}
                        />
                      </label>
                      <label className="block text-sm font-semibold text-foreground">
                        {isFrench ? "Fichier" : "File"}
                        <input
                          ref={taskAttachmentFileInputRef}
                          type="file"
                          onChange={(event) => {
                            const nextFile = event.target.files?.[0] ?? null;
                            setTaskAttachmentFileDraft(nextFile);
                          }}
                          className={textFieldClass}
                          disabled={isSubmittingTask || isCreatingTaskAttachment || isTaskDetailsLoading}
                        />
                      </label>
                      <button
                        type="button"
                        className={controlButtonClass}
                        onClick={handleCreateAttachment}
                        disabled={isSubmittingTask || isCreatingTaskAttachment || isTaskDetailsLoading}
                      >
                        {isCreatingTaskAttachment
                          ? isFrench
                            ? "Envoi..."
                            : "Uploading..."
                          : isFrench
                          ? "Televerser"
                          : "Upload"}
                      </button>
                    </div>

                    <p className="mt-2 text-[11px] text-muted">
                      {isFrench
                        ? `Televersement jusqu'a ${formatFileSize(MAX_ATTACHMENT_UPLOAD_BYTES)} par piece jointe.`
                        : `Upload up to ${formatFileSize(MAX_ATTACHMENT_UPLOAD_BYTES)} per attachment.`}
                    </p>

                    {taskAttachmentErrorMessage ? (
                      <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        {taskAttachmentErrorMessage}
                      </p>
                    ) : null}
                  </section>
                </section>
              ) : null}

              {taskFormErrorMessage ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {taskFormErrorMessage}
                </p>
              ) : null}

              <footer className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {taskDialogMode === "edit" ? (
                  <button
                    type="button"
                    className={dangerButtonClass}
                    onClick={() => {
                      if (editingTask) {
                        openDeleteDialog(editingTask);
                      }
                    }}
                    disabled={isSubmittingTask || !editingTask}
                  >
                    {isFrench ? "Supprimer la tache" : "Delete Task"}
                  </button>
                ) : (
                  <span />
                )}

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={controlButtonClass}
                    onClick={closeTaskDialog}
                    disabled={isSubmittingTask}
                  >
                    {isFrench ? "Annuler" : "Cancel"}
                  </button>
                  <button type="submit" className={primaryButtonClass} disabled={isSubmittingTask}>
                    {taskDialogSubmitLabel}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {isProfileDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#09131f]/55 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeProfileDialog();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={isFrench ? "Parametres du profil" : "Profile settings"}
            className="w-full max-w-lg rounded-3xl border border-line bg-surface p-5 shadow-[0_40px_80px_-50px_rgba(0,0,0,0.95)] sm:p-6"
          >
            <header>
              <h3 className="text-lg font-semibold text-foreground">
                {isFrench ? "Parametres du profil" : "Profile Settings"}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {isFrench
                  ? "Personnalisez vos preferences et la langue par defaut de l'assistant."
                  : "Personalize your workspace preferences and default assistant language."}
              </p>
            </header>

            <form className="mt-4 space-y-3" onSubmit={handleProfileSubmit}>
              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Nom affiche" : "Display Name"}
                <input
                  type="text"
                  value={profileFormValues.displayName}
                  onChange={(event) => handleProfileFieldChange("displayName", event.target.value)}
                  className={textFieldClass}
                  disabled={isProfileSaving}
                  placeholder={isFrench ? "Comment devons-nous vous appeler ?" : "How should we address you?"}
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Langue preferee" : "Preferred Language"}
                <select
                  value={profileFormValues.preferredLocale}
                  onChange={(event) =>
                    handleProfileFieldChange("preferredLocale", getPreferredLocale(event.target.value))
                  }
                  className={textFieldClass}
                  disabled={isProfileSaving}
                >
                  {userLocaleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Fuseau horaire prefere" : "Preferred Time Zone"}
                <input
                  type="text"
                  value={profileFormValues.preferredTimeZone}
                  onChange={(event) => handleProfileFieldChange("preferredTimeZone", event.target.value)}
                  className={textFieldClass}
                  disabled={isProfileSaving}
                  placeholder="Europe/Paris"
                />
              </label>

              <button
                type="button"
                className={controlButtonClass}
                onClick={() => handleProfileFieldChange("preferredTimeZone", getBrowserTimeZone())}
                disabled={isProfileSaving}
              >
                {isFrench ? "Utiliser le fuseau du navigateur" : "Use Browser Time Zone"}
              </button>

              {profileErrorMessage ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {profileErrorMessage}
                </p>
              ) : null}

              {profileSuccessMessage ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {profileSuccessMessage}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  className={controlButtonClass}
                  onClick={closeProfileDialog}
                  disabled={isProfileSaving}
                >
                  {isFrench ? "Fermer" : "Close"}
                </button>
                <button type="submit" className={primaryButtonClass} disabled={isProfileSaving}>
                  {isProfileSaving
                    ? isFrench
                      ? "Enregistrement..."
                      : "Saving..."
                    : isFrench
                    ? "Enregistrer le profil"
                    : "Save Profile"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {taskToDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#09131f]/55 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteDialog();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={isFrench ? "Confirmation de suppression de tache" : "Delete task confirmation"}
            className="w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-[0_40px_80px_-50px_rgba(0,0,0,0.95)] sm:p-6"
          >
            <h3 className="text-lg font-semibold text-foreground">
              {isFrench ? "Supprimer la tache ?" : "Delete task?"}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {isFrench ? "Cette action supprimera definitivement " : "This will permanently remove "}
              <span className="font-semibold text-foreground">{taskToDelete.title}</span>.
            </p>

            {deleteErrorMessage ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {deleteErrorMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className={controlButtonClass}
                onClick={closeDeleteDialog}
                disabled={isDeletingTask}
              >
                {isFrench ? "Annuler" : "Cancel"}
              </button>
              <button
                type="button"
                className={dangerButtonClass}
                onClick={handleDeleteTask}
                disabled={isDeletingTask}
              >
                {isDeletingTask
                  ? isFrench
                    ? "Suppression..."
                    : "Deleting..."
                  : isFrench
                  ? "Supprimer la tache"
                  : "Delete task"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isAssistantPanelOpen ? (
        <section className="fixed bottom-24 left-4 right-4 z-40 flex max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_65px_-35px_rgba(16,34,48,0.95)] sm:left-auto sm:right-6 sm:w-[390px]">
          <header className="flex items-center justify-between gap-2 border-b border-line bg-surface-soft px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted">
                {isFrench ? "Assistant IA" : "AI Assistant"}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {isFrench ? "Toutes vos taches" : "All your tasks"}
              </p>
            </div>
            <button
              type="button"
              className={`${iconButtonClass} h-7 px-2.5 text-[11px]`}
              onClick={() => setIsAssistantPanelOpen(false)}
              disabled={isAssistantLoading}
            >
              {isFrench ? "Fermer" : "Close"}
            </button>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto bg-surface-soft/40 px-3 py-3">
            {assistantMessages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-surface px-3 py-2 text-sm text-muted">
                {isFrench
                  ? "Posez vos questions sur toutes vos taches. Appuyez sur Entree pour envoyer."
                  : "Ask anything about your tasks across all dates. Press Enter to send."}
              </p>
            ) : (
              <>
                {assistantMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-[92%] rounded-2xl px-3 py-2 ${
                      message.role === "user"
                        ? "ml-auto border border-accent/25 bg-accent-soft text-foreground"
                        : "border border-line bg-surface text-foreground/90"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatDateTime(message.timestamp, activeLocale, activeTimeZone)}
                      {message.role === "assistant" && message.source ? ` · ${message.source}` : ""}
                      {message.role === "assistant" &&
                      typeof message.usedTaskCount === "number" &&
                      typeof message.usedCommentCount === "number"
                        ? isFrench
                          ? ` · ${message.usedTaskCount} taches, ${message.usedCommentCount} commentaires`
                          : ` · ${message.usedTaskCount} tasks, ${message.usedCommentCount} comments`
                        : ""}
                    </p>
                  </article>
                ))}
                <div ref={assistantMessagesEndRef} />
              </>
            )}
          </div>

          <div className="border-t border-line bg-surface px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {assistantPromptSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className={`${iconButtonClass} h-7 px-2.5 text-[11px]`}
                  onClick={() => {
                    setAssistantQuestion(prompt);
                    setAssistantErrorMessage(null);
                  }}
                  disabled={isAssistantLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form className="flex items-center gap-2" onSubmit={handleAssistantSubmit}>
              <input
                type="text"
                value={assistantQuestion}
                onChange={(event) => {
                  setAssistantQuestion(event.target.value);
                  setAssistantErrorMessage(null);
                }}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-55"
                maxLength={ASSISTANT_QUESTION_MAX_LENGTH}
                placeholder={isFrench ? "Posez une question sur vos taches..." : "Ask anything about your tasks..."}
                disabled={isAssistantLoading}
              />
              <button type="submit" className={primaryButtonClass} disabled={isAssistantLoading}>
                {isAssistantLoading ? "..." : isFrench ? "Envoyer" : "Send"}
              </button>
            </form>

            <p className="mt-2 text-[11px] text-muted">
              {assistantQuestion.trim().length}/{ASSISTANT_QUESTION_MAX_LENGTH}
            </p>

            {assistantErrorMessage ? (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {assistantErrorMessage}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-accent/75 bg-accent text-lg font-semibold text-white shadow-[0_20px_45px_-25px_rgba(16,34,48,0.95)] transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        onClick={() => setIsAssistantPanelOpen((isOpen) => !isOpen)}
        aria-label={
          isAssistantPanelOpen
            ? isFrench
              ? "Fermer l'assistant IA"
              : "Close AI assistant"
            : isFrench
            ? "Ouvrir l'assistant IA"
            : "Open AI assistant"
        }
      >
        AI
      </button>
    </div>
  );
}
