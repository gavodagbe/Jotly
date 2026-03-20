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
import { type DragEvent as ReactDragEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-meta";

type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
type TaskPriority = "low" | "medium" | "high";
type RecurrenceFrequency = "daily" | "weekly" | "monthly";
type ReminderStatus = "pending" | "fired" | "completed" | "cancelled";
type AlertUrgency = "overdue" | "today" | "tomorrow";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: string;
  dueDate: string | null;
  priority: TaskPriority;
  project: string | null;
  plannedTime: number | null;
  rolledFromTaskId: string | null;
  recurrenceSourceTaskId: string | null;
  recurrenceOccurrenceDate: string | null;
  calendarEventId: string | null;
};

type TaskMutationInput = {
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: string;
  dueDate: string;
  priority: TaskPriority;
  project: string | null;
  plannedTime: number | null;
  calendarEventId?: string | null;
};

type CalendarEventLinkedTask = {
  id: string;
  title: string;
  status: TaskStatus;
  targetDate: string;
  dueDate: string | null;
  priority: TaskPriority;
  project: string | null;
};

type LinkedCalendarEvent = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  htmlLink: string | null;
};

type CalendarEventLinkedNote = {
  id: string;
  title: string | null;
  body: string;
  color: string | null;
  targetDate: string | null;
  calendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
};

type CalendarEventNoteAttachment = {
  id: string;
  calendarEventNoteId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

type CalendarEventSummary = {
  id: string;
  connectionId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  htmlLink: string | null;
  note: CalendarEventLinkedNote | null;
  linkedTasks: CalendarEventLinkedTask[];
};

type TaskAlertsSummary = {
  count: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  tasks: Task[];
};

type AlertsSummary = {
  count: number;
  overdueCount: number;
  todayCount: number;
  tomorrowCount: number;
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
  warning?: string | null;
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

type Note = {
  id: string;
  title: string | null;
  body: string;
  color: string | null;
  targetDate: string | null;
  calendarEventId: string | null;
  linkedCalendarEvent: LinkedCalendarEvent | null;
  createdAt: string;
  updatedAt: string;
};

type NoteAttachment = {
  id: string;
  noteId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

type ReminderAttachment = {
  id: string;
  reminderId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

type NoteFormValues = {
  title: string;
  body: string;
  color: string;
  targetDate: string;
  calendarEventId: string;
};

function toCalendarEventLinkedNote(note: Note): CalendarEventLinkedNote {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    color: note.color,
    targetDate: note.targetDate,
    calendarEventId: note.calendarEventId,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

type Reminder = {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
  assignees: string | null;
  remindAt: string;
  status: ReminderStatus;
  isFired: boolean;
  firedAt: string | null;
  isDismissed: boolean;
  dismissedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReminderFormValues = {
  title: string;
  description: string;
  project: string;
  assignees: string;
  remindAt: string;
};

type AlertPanelItem =
  | {
      sourceType: "task";
      urgency: AlertUrgency;
      sortValue: number;
      task: Task;
    }
  | {
      sourceType: "reminder";
      urgency: AlertUrgency;
      sortValue: number;
      reminder: Reminder;
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
    usedCharges: number;
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
      claimed: boolean;
      claimedAt: string | null;
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

type AuthMode = "login" | "register" | "forgot_password" | "reset_password";

type AuthFormValues = {
  email: string;
  password: string;
  displayName: string;
  resetToken: string;
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
  dueDate: string;
  priority: TaskPriority;
  project: string;
  plannedTime: string;
  calendarEventId: string | null;
};

type RecurrenceFormValues = {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  interval: string;
  weekdays: number[];
  endsOn: string;
};

type TaskDialogMode = "create" | "edit";
type TaskFilterStatus = TaskStatus | "all";
type TaskFilterPriority = TaskPriority | "all";
type TaskFilterValues = {
  query: string;
  status: TaskFilterStatus;
  priority: TaskFilterPriority;
  project: string;
};
type SearchSourceType =
  | "task"
  | "comment"
  | "affirmation"
  | "bilan"
  | "reminder"
  | "calendarEvent"
  | "calendarNote"
  | "attachment"
  | "note"
  | "noteAttachment";

type SearchResult = {
  sourceType: SearchSourceType;
  sourceId: string;
  title: string | null;
  snippet: string;
  score: number;
  matchedBy: "fulltext" | "vector";
  metadataJson: Record<string, unknown> | null;
  updatedAt: string;
};

type GlobalSearchState = {
  query: string;
  results: SearchResult[];
  totalCount: number;
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  typeFilter: SearchSourceType | "all";
  from: string;
  to: string;
  recentResults: SearchResult[];
  isLoadingRecent: boolean;
};

type ApiErrorPayload = { error?: { code?: string; message?: string } } | null;
type DashboardBlockId = "overview" | "gamingTrack" | "dailyControls" | "affirmation" | "board" | "bilan" | "reminders" | "notes";
type DashboardLayoutConfig = {
  order: DashboardBlockId[];
  collapsed: Record<DashboardBlockId, boolean>;
};

class ApiRequestError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly apiCode: string | null = null
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function getGoogleCalendarUnavailableMessage(isFrench: boolean): string {
  return isFrench
    ? "Google Calendar n'est pas configure sur ce serveur. Renseignez les variables GOOGLE_* puis redemarrez le backend."
    : "Google Calendar is not configured on this server. Set the GOOGLE_* environment variables and restart the backend.";
}

const AUTH_TOKEN_STORAGE_KEY = "jotly_auth_token";
const PROJECT_OPTIONS_STORAGE_KEY = "jotly_project_options";
const MAX_ATTACHMENT_UPLOAD_BYTES = 5 * 1024 * 1024;
const ASSISTANT_QUESTION_MAX_LENGTH = 3000;
const DAY_AFFIRMATION_MAX_LENGTH = 5000;
const DAY_BILAN_FIELD_MAX_LENGTH = 10000;
const DASHBOARD_LAYOUT_STORAGE_KEY = "jotly_dashboard_layout_v1";
const DEFAULT_TASK_FILTER_VALUES: TaskFilterValues = {
  query: "",
  status: "all",
  priority: "all",
  project: "",
};
const DASHBOARD_BLOCK_IDS: ReadonlyArray<DashboardBlockId> = [
  "overview",
  "gamingTrack",
  "dailyControls",
  "affirmation",
  "reminders",
  "notes",
  "board",
  "bilan",
];
const DEFAULT_DASHBOARD_BLOCK_COLLAPSED: Record<DashboardBlockId, boolean> = {
  overview: false,
  gamingTrack: true,
  dailyControls: false,
  affirmation: true,
  reminders: false,
  notes: true,
  board: false,
  bilan: true,
};

function getDefaultDashboardBlockOrder(): DashboardBlockId[] {
  return [...DASHBOARD_BLOCK_IDS];
}

function getDefaultDashboardBlockCollapsedState(): Record<DashboardBlockId, boolean> {
  return { ...DEFAULT_DASHBOARD_BLOCK_COLLAPSED };
}

function isDashboardBlockId(value: string): value is DashboardBlockId {
  return DASHBOARD_BLOCK_IDS.includes(value as DashboardBlockId);
}

function getNormalizedDashboardBlockOrder(value: unknown): DashboardBlockId[] {
  const fallbackOrder = getDefaultDashboardBlockOrder();

  if (!Array.isArray(value)) {
    return fallbackOrder;
  }

  const uniqueIds: DashboardBlockId[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string" || !isDashboardBlockId(candidate) || uniqueIds.includes(candidate)) {
      continue;
    }
    uniqueIds.push(candidate);
  }

  for (const requiredId of DASHBOARD_BLOCK_IDS) {
    if (!uniqueIds.includes(requiredId)) {
      uniqueIds.push(requiredId);
    }
  }

  return uniqueIds;
}

function getNormalizedDashboardCollapsedState(value: unknown): Record<DashboardBlockId, boolean> {
  const normalized = getDefaultDashboardBlockCollapsedState();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return normalized;
  }

  for (const blockId of DASHBOARD_BLOCK_IDS) {
    const candidate = (value as Record<string, unknown>)[blockId];
    if (typeof candidate === "boolean") {
      normalized[blockId] = candidate;
    }
  }

  return normalized;
}

function parseStoredDashboardLayout(rawValue: string | null): DashboardLayoutConfig | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as { order?: unknown; collapsed?: unknown };
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      order: getNormalizedDashboardBlockOrder(parsed.order),
      collapsed: getNormalizedDashboardCollapsedState(parsed.collapsed),
    };
  } catch {
    return null;
  }
}

function getInitialDashboardLayoutConfig(): DashboardLayoutConfig {
  const fallbackConfig: DashboardLayoutConfig = {
    order: getDefaultDashboardBlockOrder(),
    collapsed: getDefaultDashboardBlockCollapsedState(),
  };

  if (typeof window === "undefined") {
    return fallbackConfig;
  }

  return parseStoredDashboardLayout(window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY)) ?? fallbackConfig;
}
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
  todo: "border-t-sky-400",
  in_progress: "border-t-amber-400",
  done: "border-t-emerald-400",
  cancelled: "border-t-slate-400",
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

const reminderStatusChipClassByStatus: Record<ReminderStatus, string> = {
  pending: "border border-sky-200 bg-sky-50 text-sky-700",
  fired: "border border-amber-200 bg-amber-50 text-amber-700",
  completed: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border border-slate-300 bg-slate-100 text-slate-600",
};

const alertUrgencyChipClassByUrgency: Record<AlertUrgency, string> = {
  overdue: "border border-rose-200 bg-rose-50 text-rose-700",
  today: "border border-amber-200 bg-amber-50 text-amber-700",
  tomorrow: "border border-sky-200 bg-sky-50 text-sky-700",
};

const alertSourceChipClassByType: Record<AlertPanelItem["sourceType"], string> = {
  task: "border border-indigo-200 bg-indigo-50 text-indigo-700",
  reminder: "border border-teal-200 bg-teal-50 text-teal-700",
};

const controlButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent px-3.5 py-2 text-sm font-medium text-foreground/80 transition-all duration-200 hover:border-line hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-accent to-accent-strong px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-600 transition-all duration-200 hover:border-red-300 hover:bg-red-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50";
const textFieldClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-3 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15 focus:shadow-sm disabled:cursor-not-allowed disabled:opacity-50";
const boardFilterFieldClass = `${textFieldClass} h-11 py-0`;
const sectionHeaderClass = "text-base font-semibold text-foreground pl-3 border-l-[3px] border-accent";
const iconButtonClass =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg text-muted transition-all duration-200 hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";
const controlIconButtonClass = `${controlButtonClass} h-9 w-9 px-0`;

function formatDashboardBlockLabel(blockId: DashboardBlockId, locale: UserLocale): string {
  const isFrench = locale === "fr";

  if (blockId === "overview") {
    return isFrench ? "Vue d'ensemble" : "Overview";
  }

  if (blockId === "gamingTrack") {
    return "Gaming Track";
  }

  if (blockId === "dailyControls") {
    return isFrench ? "Pilotage du jour" : "Day controls";
  }

  if (blockId === "affirmation") {
    return isFrench ? "Affirmation du jour" : "Day affirmation";
  }

  if (blockId === "reminders") {
    return isFrench ? "Rappels" : "Reminders";
  }

  if (blockId === "notes") {
    return isFrench ? "Notes" : "Notes";
  }

  if (blockId === "board") {
    return isFrench ? "Tableau Kanban" : "Kanban board";
  }

  return isFrench ? "Bilan du jour" : "Day bilan";
}

function CollapseChevronIcon({ isCollapsed }: { isCollapsed: boolean }) {
  return isCollapsed ? (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        d="M5.75 7.75L10 12.25L14.25 7.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        d="M5.75 12.25L10 7.75L14.25 12.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <circle cx="7" cy="6" r="1.1" fill="currentColor" />
      <circle cx="13" cy="6" r="1.1" fill="currentColor" />
      <circle cx="7" cy="10" r="1.1" fill="currentColor" />
      <circle cx="13" cy="10" r="1.1" fill="currentColor" />
      <circle cx="7" cy="14" r="1.1" fill="currentColor" />
      <circle cx="13" cy="14" r="1.1" fill="currentColor" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M11.75 4.75L6.5 10L11.75 15.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10h8" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M8.25 4.75L13.5 10L8.25 15.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10h8" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="4.5" width="13" height="12" rx="2.2" />
      <path d="M6.5 3v3M13.5 3v3M3.5 8.25h13" strokeLinecap="round" />
      <circle cx="10" cy="11.75" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="6.2" y="6" width="9" height="10" rx="1.8" />
      <path d="M4.8 13V5.8A1.8 1.8 0 016.6 4h6.9" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="8.75" cy="8.75" r="4.75" />
      <path d="M12.25 12.25L16 16" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M10 3.5a3.2 3.2 0 00-3.2 3.2v1.1c0 .8-.2 1.6-.6 2.3l-.8 1.5a1 1 0 00.9 1.5h7.4a1 1 0 00.9-1.5l-.8-1.5a4.7 4.7 0 01-.6-2.3V6.7A3.2 3.2 0 0010 3.5z" />
      <path d="M8.2 15a1.9 1.9 0 003.6 0" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M10 4.5v11M4.5 10h11" strokeLinecap="round" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4.5 4.5h9.5l1.5 1.5v9.5H4.5z" />
      <path d="M7 4.5v4h6v-4M7 15h6" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4.75 13.75l-.5 2 2-.5 8-8-1.5-1.5z" strokeLinejoin="round" />
      <path d="M11.75 5.75l1.5 1.5M13 4.5l1.5 1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4.75 6h10.5M8 6V4.8h4V6M6.5 6l.7 9h5.6l.7-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.7 8.2v5.3M11.3 8.2v5.3" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M5.25 5.25l9.5 9.5M14.75 5.25l-9.5 9.5" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M10 3.5l5 2v4.2c0 3.2-2.1 5.8-5 6.8-2.9-1-5-3.6-5-6.8V5.5z" />
      <path d="M7.75 10.1l1.6 1.7 2.9-3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M6.5 4.5h7v2.1a3.5 3.5 0 01-7 0z" />
      <path d="M6.5 5.3H4.9A1.4 1.4 0 003.5 6.7v.2A2.6 2.6 0 006.1 9.5M13.5 5.3h1.6a1.4 1.4 0 011.4 1.4v.2a2.6 2.6 0 01-2.6 2.6" />
      <path d="M10 10.1v2.3M7.5 15.5h5" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3.5 10l13-6-3.9 12L9.8 11z" strokeLinejoin="round" />
      <path d="M9.8 11L16.5 4" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 4.8h12v8.4H9.2L6 15.8v-2.6H4z" strokeLinejoin="round" />
      <path d="M7 8.3h6M7 10.8h4.5" strokeLinecap="round" />
    </svg>
  );
}

function TimeZoneIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.2v4.1l2.6 1.6" strokeLinecap="round" />
    </svg>
  );
}

function LayoutToggleIcon({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round" />
      <path d="M8 4l2 2 2-2M8 16l2-2 2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round" />
      <path d="M8 7l2-2 2 2M8 13l2 2 2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// (Tiptap toolbar actions are handled inline in TiptapToolbar)

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentDateInputValue(timeZone?: string | null): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function formatDateInputForTimeZone(date: Date, timeZone?: string | null): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
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

function formatCalendarEventTimeLabel(
  event: CalendarEventSummary,
  locale: UserLocale,
  timeZone: string | null
): string {
  if (event.isAllDay) {
    return locale === "fr" ? "Toute la journee" : "All day";
  }

  const formatter = new Intl.DateTimeFormat(getLocaleForFormatting(locale), {
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
  return `${formatter.format(new Date(event.startTime))} - ${formatter.format(new Date(event.endTime))}`;
}

function buildTaskDescriptionFromCalendarEvent(
  event: CalendarEventSummary,
  locale: UserLocale
): string {
  const lines = [
    event.description?.trim() || null,
    event.location ? `${locale === "fr" ? "Lieu" : "Location"}: ${event.location}` : null,
    event.htmlLink ? `${locale === "fr" ? "Lien" : "Link"}: ${event.htmlLink}` : null,
  ].filter((value): value is string => Boolean(value && value.trim() !== ""));

  return lines.join("\n\n");
}

function getTaskDateFromCalendarEvent(
  event: CalendarEventSummary,
  fallbackDate: string,
  timeZone: string | null
): string {
  if (event.startDate && isDateOnly(event.startDate)) {
    return event.startDate;
  }

  const parsedStartTime = new Date(event.startTime);
  if (!Number.isNaN(parsedStartTime.getTime())) {
    return formatDateInputForTimeZone(parsedStartTime, timeZone);
  }

  return fallbackDate;
}

function formatTaskAlertDueLabel(value: string, todayValue: string, locale: UserLocale): string {
  if (value === todayValue) {
    return locale === "fr" ? "Aujourd'hui" : "Today";
  }

  if (value === shiftDate(todayValue, 1)) {
    return locale === "fr" ? "Demain" : "Tomorrow";
  }

  return formatDateOnlyForLocale(value, locale);
}

function getAlertUrgency(value: string, todayValue: string): AlertUrgency | null {
  if (value < todayValue) {
    return "overdue";
  }

  if (value === todayValue) {
    return "today";
  }

  if (value === shiftDate(todayValue, 1)) {
    return "tomorrow";
  }

  return null;
}

function getAlertUrgencyRank(urgency: AlertUrgency): number {
  if (urgency === "overdue") {
    return 0;
  }

  if (urgency === "today") {
    return 1;
  }

  return 2;
}

function formatAlertUrgencyLabel(urgency: AlertUrgency, locale: UserLocale): string {
  if (urgency === "overdue") {
    return locale === "fr" ? "En retard" : "Overdue";
  }

  if (urgency === "today") {
    return locale === "fr" ? "Aujourd'hui" : "Today";
  }

  return locale === "fr" ? "Demain" : "Tomorrow";
}

function formatAlertSourceLabel(sourceType: AlertPanelItem["sourceType"], locale: UserLocale): string {
  if (sourceType === "task") {
    return locale === "fr" ? "Tache" : "Task";
  }

  return locale === "fr" ? "Rappel" : "Reminder";
}

function compareAlertPanelItems(left: AlertPanelItem, right: AlertPanelItem): number {
  const urgencyDelta = getAlertUrgencyRank(left.urgency) - getAlertUrgencyRank(right.urgency);
  if (urgencyDelta !== 0) {
    return urgencyDelta;
  }

  const sortDelta = left.sortValue - right.sortValue;
  if (sortDelta !== 0) {
    return sortDelta;
  }

  const leftTitle = left.sourceType === "task" ? left.task.title : left.reminder.title;
  const rightTitle = right.sourceType === "task" ? right.task.title : right.reminder.title;
  return leftTitle.localeCompare(rightTitle);
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

function formatAssistantSourceLabel(
  source: AssistantReplyPayload["source"] | AssistantChatMessage["source"],
  locale: UserLocale
): string {
  if (source === "openai") {
    return "OpenAI";
  }

  return locale === "fr" ? "Mode local" : "Local fallback";
}

function formatAssistantWarningMessage(
  warning: string,
  locale: UserLocale
): string {
  const normalized = warning.trim().toLowerCase();

  if (normalized.includes("workspace text search is unavailable")) {
    return locale === "fr"
      ? "La recherche textuelle du workspace etait indisponible pour cette reponse. L'assistant a repondu avec le contexte principal uniquement."
      : "Workspace text search was unavailable for this reply. The assistant answered using only the primary structured context.";
  }

  if (normalized.includes("openai is unavailable right now")) {
    return locale === "fr"
      ? "Le mode OpenAI etait indisponible pour cette reponse. Un fallback local a ete utilise."
      : "OpenAI was unavailable for this reply. A local fallback was used instead.";
  }

  return warning;
}

function formatPriority(priority: TaskPriority, locale: UserLocale): string {
  return getPriorityOptions(locale).find((option) => option.value === priority)?.label ?? priority;
}

function formatTaskStatus(status: TaskStatus, locale: UserLocale): string {
  return getBoardColumns(locale).find((column) => column.status === status)?.label ?? status;
}

function formatReminderStatus(status: ReminderStatus, locale: UserLocale): string {
  if (status === "pending") {
    return locale === "fr" ? "En attente" : "Pending";
  }

  if (status === "fired") {
    return locale === "fr" ? "Declenche" : "Fired";
  }

  if (status === "completed") {
    return locale === "fr" ? "Traite" : "Completed";
  }

  return locale === "fr" ? "Annule" : "Cancelled";
}

function isReminderResolvedStatus(status: ReminderStatus): boolean {
  return status === "completed" || status === "cancelled";
}

function sortRemindersByRemindAt(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((left, right) => new Date(left.remindAt).getTime() - new Date(right.remindAt).getTime());
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

function decodeCommonHtmlEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function normalizeTaskFilterText(value: string): string {
  return decodeCommonHtmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getRichTextPreviewText(value: string): string {
  return decodeCommonHtmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTaskSearchableText(task: Task, locale: UserLocale): string {
  return normalizeTaskFilterText(
    [
      task.title,
      task.project ?? "",
      task.description ?? "",
      task.priority,
      task.status,
      formatPriority(task.priority, locale),
      formatTaskStatus(task.status, locale),
    ].join(" ")
  );
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

const allowedRichTextTags = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "hr",
  "input",
  "label",
  "li",
  "mark",
  "ol",
  "p",
  "s",
  "span",
  "strong",
  "u",
  "ul",
]);

function getHtmlAttributeValue(source: string, attributeName: string): string | null {
  const quotedMatch = new RegExp(`${attributeName}\\s*=\\s*(['"])(.*?)\\1`, "i").exec(source);
  if (quotedMatch?.[2]) {
    return quotedMatch[2];
  }

  const unquotedMatch = new RegExp(`${attributeName}\\s*=\\s*([^\\s>]+)`, "i").exec(source);
  return unquotedMatch?.[1] ?? null;
}

function sanitizeRichTextUrl(value: string): string | null {
  const normalized = value.trim();
  return /^https?:\/\//i.test(normalized) ? normalized : null;
}

function sanitizeRichTextTag(tag: string): string {
  const match = /^<\s*(\/?)\s*([a-z0-9-]+)([^>]*)>/i.exec(tag);

  if (!match) {
    return "";
  }

  const [, closingSlash, rawTagName, rawAttributes] = match;
  const tagName = rawTagName.toLowerCase();

  if (!allowedRichTextTags.has(tagName)) {
    return "";
  }

  const isClosingTag = closingSlash === "/";
  if (isClosingTag) {
    return tagName === "br" || tagName === "hr" || tagName === "input" ? "" : `</${tagName}>`;
  }

  if (tagName === "br" || tagName === "hr") {
    return `<${tagName}>`;
  }

  if (tagName === "a") {
    const href = getHtmlAttributeValue(rawAttributes, "href");
    const safeUrl = href ? sanitizeRichTextUrl(href) : null;

    return safeUrl
      ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">`
      : "<a>";
  }

  if (tagName === "ul") {
    const dataType = getHtmlAttributeValue(rawAttributes, "data-type");
    return dataType === "taskList" ? '<ul data-type="taskList">' : "<ul>";
  }

  if (tagName === "li") {
    const checkedState = getHtmlAttributeValue(rawAttributes, "data-checked");
    return checkedState === "true" || checkedState === "false"
      ? `<li data-checked="${checkedState}">`
      : "<li>";
  }

  if (tagName === "input") {
    const type = getHtmlAttributeValue(rawAttributes, "type");
    if (type?.toLowerCase() !== "checkbox") {
      return "";
    }

    const isChecked = /\bchecked(?:\s*=\s*(?:"checked"|'checked'|checked))?/i.test(rawAttributes);
    return `<input type="checkbox"${isChecked ? " checked" : ""} disabled>`;
  }

  return `<${tagName}>`;
}

function sanitizeRichTextHtml(value: string): string {
  return value.replace(/<[^>]+>/g, (tag) => sanitizeRichTextTag(tag));
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

function isRichTextEmpty(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim() === "";
}

function renderDescriptionHtml(markdown: string): string {
  const trimmed = markdown.trim();

  if (!trimmed) {
    return "";
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return sanitizeRichTextHtml(trimmed);
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

    if (/^#{1,3}\s+/.test(cleanLine)) {
      closeList();
      const level = Math.min(3, cleanLine.match(/^#+/)?.[0].length ?? 1);
      const tagName = `h${level}`;
      htmlParts.push(
        `<${tagName}>${formatInlineMarkdown(cleanLine.replace(/^#{1,3}\s+/, ""))}</${tagName}>`
      );
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
    dueDate: targetDate,
    priority: "medium",
    project: "",
    plannedTime: "",
    calendarEventId: null,
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
    dueDate: task.dueDate ?? task.targetDate,
    priority: task.priority,
    project: task.project ?? "",
    plannedTime: typeof task.plannedTime === "number" ? String(task.plannedTime) : "",
    calendarEventId: task.calendarEventId,
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

  if (!isDateOnly(values.dueDate)) {
    return {
      error: isFrench
        ? "La date d'echeance doit respecter le format AAAA-MM-JJ."
        : "Due date must be in YYYY-MM-DD format.",
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
      dueDate: values.dueDate,
      priority: values.priority,
      project: normalizeOptionalTextInput(values.project),
      plannedTime,
      calendarEventId: values.calendarEventId,
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

async function requestPasswordReset(
  email: string
): Promise<{ resetToken: string | null; expiresAt: string | null }> {
  const response = await fetch("/backend-api/auth/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email.trim(),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { resetToken?: string | null; expiresAt?: string | null }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to request password reset"));
  }

  return {
    resetToken: payload?.data?.resetToken ?? null,
    expiresAt: payload?.data?.expiresAt ?? null,
  };
}

async function resetPasswordWithToken(
  token: string,
  password: string
): Promise<{ user: AuthUser; token: string }> {
  const response = await fetch("/backend-api/auth/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: token.trim(),
      password,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { user: AuthUser; token: string }; error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      getApiErrorMessage(response.status, payload, "Unable to reset password"),
      payload?.error?.code ?? null
    );
  }

  if (!payload?.data) {
    throw new Error("Unable to reset password.");
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
    | { data?: { user?: AuthUser }; error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      getApiErrorMessage(response.status, payload, "Unable to validate session"),
      payload?.error?.code ?? null
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

async function loadAllTasks(
  token: string,
  filters: { project?: string; status?: string; dateFrom?: string; dateTo?: string },
  signal?: AbortSignal
): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.project) params.set("project", filters.project);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const query = params.toString() ? `?${params.toString()}` : "";

  const response = await fetch(`/backend-api/tasks/all${query}`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    signal,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Task[]; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load tasks"));
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

async function loadTaskAlerts(date: string, token: string, signal?: AbortSignal): Promise<TaskAlertsSummary> {
  const response = await fetch(`/backend-api/tasks/alerts?date=${encodeURIComponent(date)}`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    signal,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: TaskAlertsSummary; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load task alerts"));
  }

  if (!payload?.data) {
    throw new Error("Unable to load task alerts.");
  }

  return payload.data;
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

async function saveCalendarEventNote(
  eventId: string,
  body: string,
  token: string
): Promise<CalendarEventLinkedNote> {
  const response = await fetch(`/backend-api/google-calendar/events/${encodeURIComponent(eventId)}/note`, {
    method: "PUT",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({ body }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: CalendarEventLinkedNote; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to save calendar event note"));
  }

  if (!payload?.data) {
    throw new Error("Unable to save calendar event note.");
  }

  return payload.data;
}

async function deleteCalendarEventNote(eventId: string, token: string): Promise<void> {
  const response = await fetch(`/backend-api/google-calendar/events/${encodeURIComponent(eventId)}/note`, {
    method: "DELETE",
    headers: createAuthHeaders(token, false),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { deleted: boolean }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to delete calendar event note"));
  }
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
  const searchParams = new URLSearchParams({
    date,
    _: `${Date.now()}`,
  });
  const response = await fetch(`/backend-api/day-affirmation?${searchParams.toString()}`, {
    method: "GET",
    headers: {
      ...createAuthHeaders(token, false),
      "Cache-Control": "no-store, no-cache, max-age=0",
      Pragma: "no-cache",
    },
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

async function loadReminders(
  date: string,
  token: string,
  signal?: AbortSignal
): Promise<Reminder[]> {
  const response = await fetch(`/backend-api/reminders?date=${encodeURIComponent(date)}`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    signal,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Reminder[]; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load reminders"));
  }

  return payload?.data ?? [];
}

async function loadPendingReminders(
  token: string,
  signal?: AbortSignal
): Promise<Reminder[]> {
  const response = await fetch("/backend-api/reminders/pending", {
    method: "GET",
    headers: createAuthHeaders(token, false),
    signal,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Reminder[]; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load pending reminders"));
  }

  return payload?.data ?? [];
}

async function loadNotes(token: string, signal?: AbortSignal): Promise<Note[]> {
  const response = await fetch("/backend-api/notes", {
    method: "GET",
    headers: createAuthHeaders(token, false),
    signal,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Note[]; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load notes"));
  }

  return payload?.data ?? [];
}

async function createNoteApi(
  input: {
    title?: string | null;
    body: string;
    color?: string | null;
    targetDate?: string | null;
    calendarEventId?: string | null;
  },
  token: string
): Promise<Note> {
  const response = await fetch("/backend-api/notes", {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Note; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to create note"));
  }

  if (!payload?.data) throw new Error("Unable to create note");
  return payload.data;
}

async function updateNoteApi(
  id: string,
  input: {
    title?: string | null;
    body?: string;
    color?: string | null;
    targetDate?: string | null;
    calendarEventId?: string | null;
  },
  token: string
): Promise<Note> {
  const response = await fetch(`/backend-api/notes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Note; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to update note"));
  }

  if (!payload?.data) throw new Error("Unable to update note");
  return payload.data;
}

async function deleteNoteApi(id: string, token: string): Promise<void> {
  const response = await fetch(`/backend-api/notes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: createAuthHeaders(token, false),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to delete note"));
  }
}

async function loadNoteAttachments(noteId: string, token: string): Promise<NoteAttachment[]> {
  const response = await fetch(`/backend-api/notes/${encodeURIComponent(noteId)}/attachments`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: NoteAttachment[]; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load attachments"));
  }
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function createNoteAttachmentApi(
  noteId: string,
  input: { name: string; file: File },
  token: string
): Promise<NoteAttachment> {
  const fileDataUrl = await readFileAsDataUrl(input.file);
  const response = await fetch(`/backend-api/notes/${encodeURIComponent(noteId)}/attachments`, {
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
    | { data?: NoteAttachment; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to create attachment"));
  }
  if (!payload?.data) throw new Error("Unable to create attachment.");
  return payload.data;
}

async function deleteNoteAttachmentApi(
  noteId: string,
  attachmentId: string,
  token: string
): Promise<void> {
  const response = await fetch(
    `/backend-api/notes/${encodeURIComponent(noteId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE", headers: createAuthHeaders(token, false) }
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to delete attachment"));
  }
}

async function loadCalendarEventNoteAttachments(eventId: string, token: string): Promise<CalendarEventNoteAttachment[]> {
  const response = await fetch(`/backend-api/google-calendar/events/${encodeURIComponent(eventId)}/note/attachments`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: CalendarEventNoteAttachment[]; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load calendar event note attachments"));
  }
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function createCalendarEventNoteAttachmentApi(
  eventId: string,
  input: { name: string; file: File },
  token: string
): Promise<CalendarEventNoteAttachment> {
  const fileDataUrl = await readFileAsDataUrl(input.file);
  const response = await fetch(`/backend-api/google-calendar/events/${encodeURIComponent(eventId)}/note/attachments`, {
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
    | { data?: CalendarEventNoteAttachment; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to create calendar event note attachment"));
  }
  if (!payload?.data) throw new Error("Unable to create calendar event note attachment.");
  return payload.data;
}

async function deleteCalendarEventNoteAttachmentApi(
  eventId: string,
  attachmentId: string,
  token: string
): Promise<void> {
  const response = await fetch(
    `/backend-api/google-calendar/events/${encodeURIComponent(eventId)}/note/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE", headers: createAuthHeaders(token, false) }
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to delete calendar event note attachment"));
  }
}

async function createReminderApi(
  input: { title: string; description?: string | null; project?: string | null; assignees?: string | null; remindAt: string },
  token: string
): Promise<Reminder> {
  const response = await fetch("/backend-api/reminders", {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Reminder; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to create reminder"));
  }

  if (!payload?.data) {
    throw new Error("Unable to create reminder.");
  }

  return payload.data;
}

async function updateReminderApi(
  id: string,
  input: { title?: string; description?: string | null; project?: string | null; assignees?: string | null; remindAt?: string },
  token: string
): Promise<Reminder> {
  const response = await fetch(`/backend-api/reminders/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Reminder; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to update reminder"));
  }

  if (!payload?.data) {
    throw new Error("Unable to update reminder.");
  }

  return payload.data;
}

async function loadReminderAttachments(reminderId: string, token: string): Promise<ReminderAttachment[]> {
  const response = await fetch(`/backend-api/reminders/${encodeURIComponent(reminderId)}/attachments`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: ReminderAttachment[]; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load attachments"));
  }
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function createReminderAttachmentApi(
  reminderId: string,
  input: { name: string; file: File },
  token: string
): Promise<ReminderAttachment> {
  const fileDataUrl = await readFileAsDataUrl(input.file);
  const response = await fetch(`/backend-api/reminders/${encodeURIComponent(reminderId)}/attachments`, {
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
    | { data?: ReminderAttachment; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to create attachment"));
  }
  if (!payload?.data) throw new Error("Unable to create attachment.");
  return payload.data;
}

async function deleteReminderAttachmentApi(
  reminderId: string,
  attachmentId: string,
  token: string
): Promise<void> {
  const response = await fetch(
    `/backend-api/reminders/${encodeURIComponent(reminderId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE", headers: createAuthHeaders(token, false) }
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to delete attachment"));
  }
}

async function completeReminderApi(id: string, token: string): Promise<Reminder> {
  const response = await fetch(`/backend-api/reminders/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({}),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Reminder; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to complete reminder"));
  }

  if (!payload?.data) {
    throw new Error("Unable to complete reminder.");
  }

  return payload.data;
}

async function cancelReminderApi(id: string, token: string): Promise<Reminder> {
  const response = await fetch(`/backend-api/reminders/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({}),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Reminder; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to cancel reminder"));
  }

  if (!payload?.data) {
    throw new Error("Unable to cancel reminder.");
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

async function claimGamingTrackChallenge(date: string, token: string): Promise<{
  challengeId: GamingTrackSummary["engagement"]["challenge"]["id"];
  challengeWeekStart: string;
  rewardXp: number;
  alreadyClaimed: boolean;
  claimedAt: string;
}> {
  const response = await fetch("/backend-api/gaming-track/challenge/claim", {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({ date }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        data?: {
          challengeId: GamingTrackSummary["engagement"]["challenge"]["id"];
          challengeWeekStart: string;
          rewardXp: number;
          alreadyClaimed: boolean;
          claimedAt: string;
        };
        error?: { message?: string };
      }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to claim challenge reward"));
  }

  if (!payload?.data) {
    throw new Error("Unable to claim challenge reward.");
  }

  return payload.data;
}

async function activateGamingTrackStreakProtection(date: string, token: string): Promise<{
  usedOn: string;
  remainingCharges: number;
  alreadyUsed: boolean;
}> {
  const response = await fetch("/backend-api/gaming-track/streak-protection/use", {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({ date }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { usedOn: string; remainingCharges: number; alreadyUsed: boolean }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to use streak protection"));
  }

  if (!payload?.data) {
    throw new Error("Unable to use streak protection.");
  }

  return payload.data;
}

async function dismissGamingTrackNudge(
  date: string,
  nudgeId: GamingTrackSummary["engagement"]["nudges"][number]["id"],
  token: string
): Promise<{ nudgeId: GamingTrackSummary["engagement"]["nudges"][number]["id"]; dismissedOn: string; alreadyDismissed: boolean }> {
  const response = await fetch("/backend-api/gaming-track/nudges/dismiss", {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({
      date,
      nudgeId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        data?: {
          nudgeId: GamingTrackSummary["engagement"]["nudges"][number]["id"];
          dismissedOn: string;
          alreadyDismissed: boolean;
        };
        error?: { message?: string };
      }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to dismiss nudge"));
  }

  if (!payload?.data) {
    throw new Error("Unable to dismiss nudge.");
  }

  return payload.data;
}

// ─── Project Planning View ───────────────────────────────────────────────────

type ProjectPlanningViewProps = {
  locale: UserLocale;
  tasks: Task[];
  isLoading: boolean;
  errorMessage: string | null;
  filters: { project: string; status: string; dateFrom: string; dateTo: string };
  sort: { column: string; dir: "asc" | "desc" };
  viewMode: "table" | "gantt";
  projectOptions: string[];
  onFilterChange: (key: "project" | "status" | "dateFrom" | "dateTo", value: string) => void;
  onSortChange: (column: string) => void;
  onViewModeChange: (mode: "table" | "gantt") => void;
  onClose: () => void;
  onEditTask: (task: Task) => void;
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-50 text-red-500",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-500",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-rose-100 text-rose-600",
};

const GANTT_STATUS_BAR: Record<TaskStatus, string> = {
  todo: "bg-slate-300",
  in_progress: "bg-blue-400",
  done: "bg-emerald-400",
  cancelled: "bg-red-300",
};

function sortTasks(tasks: Task[], column: string, dir: "asc" | "desc"): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "project":
        cmp = (a.project ?? "").localeCompare(b.project ?? "");
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      case "priority": {
        const rank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
        cmp = rank[a.priority] - rank[b.priority];
        break;
      }
      case "targetDate":
        cmp = a.targetDate.localeCompare(b.targetDate);
        break;
      case "dueDate":
        cmp = (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
        break;
      case "plannedTime":
        cmp = (a.plannedTime ?? 0) - (b.plannedTime ?? 0);
        break;
      default:
        cmp = a.targetDate.localeCompare(b.targetDate);
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

function formatMinutes(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function ProjectPlanningView({
  locale,
  tasks,
  isLoading,
  errorMessage,
  filters,
  sort,
  viewMode,
  projectOptions,
  onFilterChange,
  onSortChange,
  onViewModeChange,
  onClose,
  onEditTask,
}: ProjectPlanningViewProps) {
  const isFrench = locale === "fr";

  const sorted = useMemo(() => sortTasks(tasks, sort.column, sort.dir), [tasks, sort]);

  // ── Gantt chart computation ───────────────────────────────────────────────
  const ganttData = useMemo(() => {
    if (sorted.length === 0) return null;

    const allDates = sorted.flatMap((t) => {
      const dates: string[] = [t.targetDate];
      if (t.dueDate) dates.push(t.dueDate);
      return dates;
    });

    const minDate = allDates.reduce((a, b) => (a < b ? a : b));
    const maxDate = allDates.reduce((a, b) => (a > b ? a : b));

    const start = new Date(minDate + "T00:00:00Z");
    const end = new Date(maxDate + "T00:00:00Z");
    end.setUTCDate(end.getUTCDate() + 1);

    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));

    function dayOffset(dateStr: string): number {
      const d = new Date(dateStr + "T00:00:00Z");
      return Math.round((d.getTime() - start.getTime()) / 86400000);
    }

    // Build month labels
    const months: { label: string; left: number; width: number }[] = [];
    let cursor = new Date(start);
    while (cursor < end) {
      const monthStart = new Date(cursor);
      const nextMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      const clampedEnd = nextMonth < end ? nextMonth : end;
      const left = ((monthStart.getTime() - start.getTime()) / 86400000 / totalDays) * 100;
      const width = ((clampedEnd.getTime() - monthStart.getTime()) / 86400000 / totalDays) * 100;
      months.push({
        label: monthStart.toLocaleDateString(isFrench ? "fr-FR" : "en-US", { month: "short", year: "numeric" }),
        left,
        width,
      });
      cursor = nextMonth;
    }

    // Build day columns (only show if totalDays <= 60)
    const days: { label: string; left: number }[] = [];
    if (totalDays <= 60) {
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start);
        d.setUTCDate(d.getUTCDate() + i);
        days.push({
          label: String(d.getUTCDate()),
          left: (i / totalDays) * 100,
        });
      }
    }

    const bars = sorted.map((task) => {
      const startOffset = dayOffset(task.targetDate);
      const endOffset = task.dueDate ? dayOffset(task.dueDate) + 1 : startOffset + 1;
      const left = (startOffset / totalDays) * 100;
      const width = Math.max(0.5, ((endOffset - startOffset) / totalDays) * 100);
      return { task, left, width };
    });

    return { totalDays, months, days, bars, minDate, maxDate };
  }, [sorted, isFrench]);

  function SortIcon({ column }: { column: string }) {
    if (sort.column !== column) {
      return (
        <svg viewBox="0 0 10 12" className="ml-1 inline h-3 w-3 opacity-30" fill="currentColor">
          <path d="M5 1l3 4H2zM5 11l-3-4h6z" />
        </svg>
      );
    }
    return sort.dir === "asc" ? (
      <svg viewBox="0 0 10 6" className="ml-1 inline h-3 w-3 text-accent" fill="currentColor">
        <path d="M5 0l5 6H0z" />
      </svg>
    ) : (
      <svg viewBox="0 0 10 6" className="ml-1 inline h-3 w-3 text-accent" fill="currentColor">
        <path d="M5 6L0 0h10z" />
      </svg>
    );
  }

  function formatStatusLabel(status: TaskStatus): string {
    const labels: Record<TaskStatus, { fr: string; en: string }> = {
      todo: { fr: "A faire", en: "To do" },
      in_progress: { fr: "En cours", en: "In progress" },
      done: { fr: "Termine", en: "Done" },
      cancelled: { fr: "Annule", en: "Cancelled" },
    };
    return isFrench ? labels[status].fr : labels[status].en;
  }

  function formatPriorityLabel(priority: TaskPriority): string {
    const labels: Record<TaskPriority, { fr: string; en: string }> = {
      low: { fr: "Faible", en: "Low" },
      medium: { fr: "Moyen", en: "Medium" },
      high: { fr: "Elevee", en: "High" },
    };
    return isFrench ? labels[priority].fr : labels[priority].en;
  }

  const th = "cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted hover:text-foreground";
  const td = "px-3 py-2.5 text-sm";

  // Stats
  const statsDone = tasks.filter((t) => t.status === "done").length;
  const statsInProgress = tasks.filter((t) => t.status === "in_progress").length;
  const statsTodo = tasks.filter((t) => t.status === "todo").length;
  const totalPlanned = tasks.reduce((s, t) => s + (t.plannedTime ?? 0), 0);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background lg:pl-[260px]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 20 20" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="2" y="4" width="16" height="2.5" rx="1"/>
            <rect x="2" y="8.75" width="11" height="2.5" rx="1"/>
            <rect x="2" y="13.5" width="14" height="2.5" rx="1"/>
          </svg>
          <h2 className="text-base font-semibold text-foreground">
            {isFrench ? "Planification projet" : "Project Planning"}
          </h2>
          {!isLoading && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
              {tasks.length} {isFrench ? "taches" : "tasks"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-line bg-surface-soft p-0.5">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "table" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
              onClick={() => onViewModeChange("table")}
            >
              <svg viewBox="0 0 16 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="14" height="10" rx="1.5"/>
                <path d="M1 4.5h14M1 8h14M5.5 1v10M11 1v10"/>
              </svg>
            </button>
            <button
              type="button"
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "gantt" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
              onClick={() => onViewModeChange("gantt")}
            >
              <svg viewBox="0 0 16 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1.5" width="8" height="2" rx="1" fill="currentColor" stroke="none"/>
                <rect x="4" y="5" width="7" height="2" rx="1" fill="currentColor" stroke="none"/>
                <rect x="1" y="8.5" width="11" height="2" rx="1" fill="currentColor" stroke="none"/>
              </svg>
            </button>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
            onClick={onClose}
            aria-label={isFrench ? "Fermer" : "Close"}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3l10 10M13 3L3 13"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {!isLoading && tasks.length > 0 && (
        <div className="flex shrink-0 items-center gap-4 border-b border-line bg-surface-soft px-4 py-2 sm:px-6">
          <span className="text-xs text-muted">
            <span className="font-semibold text-emerald-600">{statsDone}</span> {isFrench ? "terminées" : "done"}
          </span>
          <span className="text-xs text-muted">
            <span className="font-semibold text-blue-600">{statsInProgress}</span> {isFrench ? "en cours" : "in progress"}
          </span>
          <span className="text-xs text-muted">
            <span className="font-semibold text-slate-600">{statsTodo}</span> {isFrench ? "à faire" : "to do"}
          </span>
          {totalPlanned > 0 && (
            <span className="text-xs text-muted">
              <span className="font-semibold text-foreground">{formatMinutes(totalPlanned)}</span> {isFrench ? "planifiées" : "planned"}
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-3 sm:px-6">
        {/* Project filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted">{isFrench ? "Projet" : "Project"}</label>
          <select
            className="rounded-md border border-line bg-surface-soft px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
            value={filters.project}
            onChange={(e) => onFilterChange("project", e.target.value)}
          >
            <option value="">{isFrench ? "Tous" : "All"}</option>
            {projectOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted">{isFrench ? "Statut" : "Status"}</label>
          <select
            className="rounded-md border border-line bg-surface-soft px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
            value={filters.status}
            onChange={(e) => onFilterChange("status", e.target.value)}
          >
            <option value="all">{isFrench ? "Tous" : "All"}</option>
            <option value="todo">{isFrench ? "A faire" : "To do"}</option>
            <option value="in_progress">{isFrench ? "En cours" : "In progress"}</option>
            <option value="done">{isFrench ? "Termine" : "Done"}</option>
            <option value="cancelled">{isFrench ? "Annule" : "Cancelled"}</option>
          </select>
        </div>

        {/* Date from */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted">{isFrench ? "Du" : "From"}</label>
          <input
            type="date"
            className="rounded-md border border-line bg-surface-soft px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
            value={filters.dateFrom}
            onChange={(e) => onFilterChange("dateFrom", e.target.value)}
          />
        </div>

        {/* Date to */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted">{isFrench ? "Au" : "To"}</label>
          <input
            type="date"
            className="rounded-md border border-line bg-surface-soft px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
            value={filters.dateTo}
            onChange={(e) => onFilterChange("dateTo", e.target.value)}
          />
        </div>

        {/* Reset filters */}
        {(filters.project || filters.status !== "all" || filters.dateFrom || filters.dateTo) && (
          <button
            type="button"
            className="rounded-md border border-line px-2 py-1.5 text-xs text-muted transition-colors hover:border-accent/30 hover:text-accent"
            onClick={() => {
              onFilterChange("project", "");
              onFilterChange("status", "all");
              onFilterChange("dateFrom", "");
              onFilterChange("dateTo", "");
            }}
          >
            {isFrench ? "Reinitialiser" : "Reset"}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-3 text-muted">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm">{isFrench ? "Chargement..." : "Loading..."}</span>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-sm rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
            <svg viewBox="0 0 48 48" className="h-12 w-12 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="6" y="6" width="36" height="36" rx="4"/>
              <path d="M14 18h20M14 24h14M14 30h18"/>
            </svg>
            <p className="text-sm">{isFrench ? "Aucune tache trouvee" : "No tasks found"}</p>
          </div>
        ) : viewMode === "table" ? (
          // ── Table view ──────────────────────────────────────────────────────
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface">
              <tr>
                <th className={th} onClick={() => onSortChange("title")}>
                  {isFrench ? "Titre" : "Title"}<SortIcon column="title" />
                </th>
                <th className={th} onClick={() => onSortChange("project")}>
                  {isFrench ? "Projet" : "Project"}<SortIcon column="project" />
                </th>
                <th className={th} onClick={() => onSortChange("status")}>
                  {isFrench ? "Statut" : "Status"}<SortIcon column="status" />
                </th>
                <th className={th} onClick={() => onSortChange("priority")}>
                  {isFrench ? "Priorite" : "Priority"}<SortIcon column="priority" />
                </th>
                <th className={th} onClick={() => onSortChange("targetDate")}>
                  {isFrench ? "Date planifiee" : "Planned date"}<SortIcon column="targetDate" />
                </th>
                <th className={th} onClick={() => onSortChange("dueDate")}>
                  {isFrench ? "Echeance" : "Due date"}<SortIcon column="dueDate" />
                </th>
                <th className={th} onClick={() => onSortChange("plannedTime")}>
                  {isFrench ? "Temps" : "Time"}<SortIcon column="plannedTime" />
                </th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((task) => (
                <tr
                  key={task.id}
                  className="group cursor-pointer transition-colors hover:bg-surface-soft"
                  onClick={() => onEditTask(task)}
                >
                  <td className={`${td} max-w-[240px]`}>
                    <span className="line-clamp-2 font-medium text-foreground">{task.title}</span>
                  </td>
                  <td className={td}>
                    {task.project ? (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{task.project}</span>
                    ) : (
                      <span className="text-muted/50">—</span>
                    )}
                  </td>
                  <td className={td}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                      {formatStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className={td}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
                      {formatPriorityLabel(task.priority)}
                    </span>
                  </td>
                  <td className={`${td} text-muted`}>{task.targetDate}</td>
                  <td className={`${td} text-muted`}>{task.dueDate ?? "—"}</td>
                  <td className={`${td} text-muted`}>{formatMinutes(task.plannedTime)}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs text-muted opacity-0 transition-all hover:bg-accent-soft hover:text-accent group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                    >
                      {isFrench ? "Modifier" : "Edit"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // ── Gantt view ───────────────────────────────────────────────────────
          ganttData ? (
            <div className="min-w-[700px] px-4 py-4 sm:px-6">
              {/* Month labels */}
              <div className="relative mb-1 h-6 border-b border-line">
                {ganttData.months.map((m, i) => (
                  <span
                    key={i}
                    className="absolute text-[10px] text-muted"
                    style={{ left: `${m.left}%`, width: `${m.width}%` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>

              {/* Day markers */}
              {ganttData.days.length > 0 && (
                <div className="relative mb-2 h-4">
                  {ganttData.days.map((d, i) => (
                    <span
                      key={i}
                      className="absolute text-[9px] text-muted/60"
                      style={{ left: `${d.left}%` }}
                    >
                      {d.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Task rows */}
              <div className="space-y-1.5">
                {ganttData.bars.map(({ task, left, width }) => (
                  <div key={task.id} className="flex items-center gap-3">
                    {/* Task label */}
                    <div
                      className="w-40 shrink-0 cursor-pointer truncate text-xs text-foreground hover:text-accent"
                      title={task.title}
                      onClick={() => onEditTask(task)}
                    >
                      {task.title}
                    </div>
                    {/* Bar track */}
                    <div className="relative h-6 flex-1 rounded bg-surface-soft">
                      <div
                        className={`absolute h-full cursor-pointer rounded transition-opacity hover:opacity-80 ${GANTT_STATUS_BAR[task.status]}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${task.title} · ${task.targetDate}${task.dueDate ? ` → ${task.dueDate}` : ""}`}
                        onClick={() => onEditTask(task)}
                      >
                        {width > 5 && (
                          <span className="absolute inset-0 flex items-center justify-center truncate px-1.5 text-[10px] font-medium text-white/90">
                            {task.title}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3">
                {(["todo", "in_progress", "done", "cancelled"] as TaskStatus[]).map((s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <span className={`h-3 w-3 rounded ${GANTT_STATUS_BAR[s]}`} />
                    <span className="text-xs text-muted">
                      {s === "todo" ? (isFrench ? "A faire" : "To do")
                        : s === "in_progress" ? (isFrench ? "En cours" : "In progress")
                        : s === "done" ? (isFrench ? "Termine" : "Done")
                        : isFrench ? "Annule" : "Cancelled"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type AppNavbarProps = {
  locale: UserLocale;
  user: AuthUser | null;
  onLogout?: () => void;
  onOpenProfile?: () => void;
  onLogin?: () => void;
  alertsSummary?: AlertsSummary | null;
  isTaskAlertsPanelOpen?: boolean;
  onOpenTaskAlerts?: () => void;
  onOpenSearch?: () => void;
  isBusy?: boolean;
  isProjectPlanningOpen?: boolean;
  onOpenProjectPlanning?: () => void;
};

const SOURCE_TYPE_LABELS: Record<SearchSourceType, { fr: string; en: string }> = {
  task: { fr: "Tâche", en: "Task" },
  comment: { fr: "Commentaire", en: "Comment" },
  affirmation: { fr: "Affirmation", en: "Affirmation" },
  bilan: { fr: "Bilan", en: "Bilan" },
  reminder: { fr: "Rappel", en: "Reminder" },
  calendarEvent: { fr: "Événement", en: "Event" },
  calendarNote: { fr: "Note agenda", en: "Cal. Note" },
  attachment: { fr: "Pièce jointe", en: "Attachment" },
  note: { fr: "Note", en: "Note" },
  noteAttachment: { fr: "Doc note", en: "Note Doc" },
};

const ALL_SEARCH_SOURCE_TYPES: SearchSourceType[] = [
  "task",
  "comment",
  "affirmation",
  "bilan",
  "reminder",
  "calendarEvent",
  "calendarNote",
  "attachment",
  "note",
  "noteAttachment",
];

const TYPE_BADGE: Record<SearchSourceType, string> = {
  task:          "bg-indigo-50 text-indigo-500",
  comment:       "bg-sky-50 text-sky-500",
  affirmation:   "bg-amber-50 text-amber-500",
  bilan:         "bg-emerald-50 text-emerald-500",
  reminder:      "bg-rose-50 text-rose-500",
  calendarEvent: "bg-purple-50 text-purple-500",
  calendarNote:  "bg-violet-50 text-violet-500",
  attachment:    "bg-slate-100 text-slate-500",
  note:          "bg-teal-50 text-teal-500",
  noteAttachment:"bg-cyan-50 text-cyan-500",
};

const TYPE_ICON_COLOR: Record<SearchSourceType, string> = {
  task:          "text-indigo-400",
  comment:       "text-sky-400",
  affirmation:   "text-amber-400",
  bilan:         "text-emerald-400",
  reminder:      "text-rose-400",
  calendarEvent: "text-purple-400",
  calendarNote:  "text-violet-400",
  attachment:    "text-slate-400",
  note:          "text-teal-400",
  noteAttachment:"text-cyan-400",
};

function SearchTypeIcon({ type }: { type: SearchSourceType }) {
  const cls = "h-4 w-4 shrink-0";
  switch (type) {
    case "task":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "comment":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
        </svg>
      );
    case "affirmation":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
        </svg>
      );
    case "bilan":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" />
        </svg>
      );
    case "reminder":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
        </svg>
      );
    case "calendarEvent":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        </svg>
      );
    case "calendarNote":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
          <path d="M8 14h5M8 18h3" strokeLinecap="round" />
        </svg>
      );
    case "attachment":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "note":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" strokeLinecap="round" />
          <line x1="8" y1="17" x2="13" y2="17" strokeLinecap="round" />
        </svg>
      );
    case "noteAttachment":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M10 17l2-2 2 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function formatSearchResultDate(metadataJson: Record<string, unknown> | null, locale: UserLocale): string | null {
  if (!metadataJson) return null;
  const raw = (metadataJson.targetDate ?? metadataJson.remindAt ?? metadataJson.startTime) as string | undefined;
  if (!raw) return null;
  try {
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(raw));
  } catch {
    return null;
  }
}

function renderHighlightedSnippet(snippet: string, query: string): React.ReactNode {
  // If snippet contains [[ markers from ts_headline, parse them
  if (snippet.includes("[[")) {
    const parts: React.ReactNode[] = [];
    let remaining = snippet;
    let key = 0;
    while (remaining.length > 0) {
      const start = remaining.indexOf("[[");
      if (start === -1) {
        parts.push(remaining);
        break;
      }
      if (start > 0) {
        parts.push(remaining.slice(0, start));
      }
      const end = remaining.indexOf("]]", start + 2);
      if (end === -1) {
        parts.push(remaining.slice(start));
        break;
      }
      const term = remaining.slice(start + 2, end);
      parts.push(
        <span key={key++} className="text-accent font-medium">
          {term}
        </span>
      );
      remaining = remaining.slice(end + 2);
    }
    return <>{parts}</>;
  }

  // Client-side highlighting for vector results (no markers)
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return snippet;

  const tokens = [...new Set(
    trimmedQuery.split(/\s+/).filter((t) => t.length >= 2)
  )];
  if (tokens.length === 0) return snippet;

  const pattern = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = snippet.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <span key={i} className="text-accent font-medium">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

function SearchResultRow({
  result,
  locale,
  query,
  isFocused,
  onClick,
}: {
  result: SearchResult;
  locale: UserLocale;
  query: string;
  isFocused: boolean;
  onClick: () => void;
}) {
  const isFrench = locale === "fr";
  const label = SOURCE_TYPE_LABELS[result.sourceType]?.[isFrench ? "fr" : "en"] ?? result.sourceType;
  const date = formatSearchResultDate(result.metadataJson, locale);
  const isVector = result.matchedBy === "vector";

  return (
    <button
      type="button"
      data-search-result
      className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isFocused
          ? "bg-accent/[0.07] outline-none"
          : "hover:bg-surface-soft"
      }`}
      onClick={onClick}
    >
      {/* Type icon */}
      <span className={`shrink-0 ${TYPE_ICON_COLOR[result.sourceType]}`}>
        <SearchTypeIcon type={result.sourceType} />
      </span>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {result.title ? (
            <span className={`truncate text-sm font-medium ${isFocused ? "text-accent" : "text-foreground group-hover:text-accent"}`}>
              {result.title.includes("[[") ? renderHighlightedSnippet(result.title, query) : result.title}
            </span>
          ) : (
            <span className={`truncate text-sm ${isFocused ? "text-accent" : "text-muted"}`}>
              {renderHighlightedSnippet(result.snippet.slice(0, 60), query)}
            </span>
          )}
          {isVector && (
            <span className="shrink-0 rounded px-1 py-px text-[9px] font-medium tracking-wide text-accent/60 ring-1 ring-accent/20">
              {isFrench ? "sémantique" : "semantic"}
            </span>
          )}
        </div>
        {result.title && result.snippet ? (
          <p className="mt-px truncate text-xs text-muted">{renderHighlightedSnippet(result.snippet, query)}</p>
        ) : null}
      </div>

      {/* Right metadata */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest ${TYPE_BADGE[result.sourceType]}`}>
          {label}
        </span>
        {date ? (
          <span className="text-[10px] text-muted">{date}</span>
        ) : null}
      </div>
    </button>
  );
}

type GlobalSearchModalProps = {
  locale: UserLocale;
  state: GlobalSearchState;
  onQueryChange: (value: string) => void;
  onTypeFilterChange: (filter: SearchSourceType | "all") => void;
  onDateFilterChange: (field: "from" | "to", value: string) => void;
  onLoadMore: () => void;
  onClose: () => void;
  onResultClick: (result: SearchResult) => void;
};

function GlobalSearchModal({
  locale,
  state,
  onQueryChange,
  onTypeFilterChange,
  onDateFilterChange,
  onLoadMore,
  onClose,
  onResultClick,
}: GlobalSearchModalProps) {
  const isFrench = locale === "fr";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Reset focused index when results change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [state.results]);

  const hasResults = state.results.length > 0;
  const hasQuery = state.query.trim().length >= 2;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!hasResults) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next = Math.min(prev + 1, state.results.length - 1);
        scrollResultIntoView(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next = Math.max(prev - 1, 0);
        scrollResultIntoView(next);
        return next;
      });
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      const result = state.results[focusedIndex];
      if (result) { onResultClick(result); onClose(); }
    }
  }

  function scrollResultIntoView(index: number) {
    if (!listRef.current) return;
    const rows = listRef.current.querySelectorAll<HTMLElement>("[data-search-result]");
    rows[index]?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[10vh] backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex w-full max-w-xl flex-col rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="shrink-0 text-muted">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={state.query}
            onChange={(e) => { onQueryChange(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder={isFrench ? "Rechercher dans votre espace..." : "Search your workspace..."}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
          />
          {state.isLoading ? (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : null}
          <kbd
            onClick={onClose}
            className="hidden cursor-pointer rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-muted hover:text-foreground sm:block"
          >
            Esc
          </kbd>
        </div>

        {/* Type filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-line px-4 py-2 scrollbar-none">
          <button
            type="button"
            onClick={() => onTypeFilterChange("all")}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              state.typeFilter === "all"
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {isFrench ? "Tout" : "All"}
          </button>
          {ALL_SEARCH_SOURCE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onTypeFilterChange(type)}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                state.typeFilter === type
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {SOURCE_TYPE_LABELS[type][isFrench ? "fr" : "en"]}
            </button>
          ))}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
            <input
              type="date"
              value={state.from}
              onChange={(e) => onDateFilterChange("from", e.target.value)}
              className="w-28 rounded border border-line bg-surface-soft px-1.5 py-0.5 text-[10px] text-muted outline-none focus:border-accent"
              title={isFrench ? "Date de début" : "From"}
            />
            <span className="text-[10px] text-muted">–</span>
            <input
              type="date"
              value={state.to}
              onChange={(e) => onDateFilterChange("to", e.target.value)}
              className="w-28 rounded border border-line bg-surface-soft px-1.5 py-0.5 text-[10px] text-muted outline-none focus:border-accent"
              title={isFrench ? "Date de fin" : "To"}
            />
          </div>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto border-t border-line">
          {state.errorMessage ? (
            <p className="px-4 py-8 text-center text-sm text-rose-500">{state.errorMessage}</p>
          ) : !hasQuery ? (
            state.isLoadingRecent ? (
              <div className="flex items-center justify-center py-12 text-muted">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            ) : state.recentResults.length > 0 ? (
              <div className="py-1">
                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {isFrench ? "Récemment modifié" : "Recently modified"}
                </p>
                {state.recentResults.map((result, index) => (
                  <SearchResultRow
                    key={`recent-${result.sourceType}-${result.sourceId}`}
                    result={result}
                    locale={locale}
                    query=""
                    isFocused={index === focusedIndex}
                    onClick={() => { onResultClick(result); onClose(); }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-muted">
                <svg className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
                </svg>
                <p className="text-sm">
                  {isFrench ? "Tapez au moins 2 caractères" : "Type at least 2 characters"}
                </p>
              </div>
            )
          ) : !hasResults && !state.isLoading ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted">
              <svg className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
              <p className="text-sm">
                {isFrench ? "Aucun résultat" : "No results found"}
              </p>
              <p className="text-xs opacity-60">
                {isFrench ? `Aucun résultat pour « ${state.query} »` : `No matches for "${state.query}"`}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {state.results.map((result, index) => (
                <SearchResultRow
                  key={`${result.sourceType}-${result.sourceId}`}
                  result={result}
                  locale={locale}
                  query={state.query}
                  isFocused={index === focusedIndex}
                  onClick={() => { onResultClick(result); onClose(); }}
                />
              ))}
              {state.hasMore ? (
                <div className="px-4 py-2">
                  <button
                    type="button"
                    onClick={onLoadMore}
                    disabled={state.isLoading}
                    className="w-full rounded-lg border border-line py-2 text-xs text-muted transition-colors hover:bg-surface-soft hover:text-foreground disabled:opacity-50"
                  >
                    {state.isLoading
                      ? (isFrench ? "Chargement..." : "Loading...")
                      : (isFrench ? "Voir plus de résultats" : "Load more results")}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line px-4 py-2">
          <div className="flex items-center gap-3 text-[10px] text-muted">
            <span>↑↓ {isFrench ? "naviguer" : "navigate"}</span>
            <span>↵ {isFrench ? "ouvrir" : "open"}</span>
            <span>Esc {isFrench ? "fermer" : "close"}</span>
          </div>
          {hasResults ? (
            <p className="text-[10px] text-muted">
              {state.totalCount} {isFrench ? "résultat(s)" : "result(s)"}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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

function AppNavbar({
  locale,
  user,
  onLogout,
  onOpenProfile,
  onLogin,
  alertsSummary,
  isTaskAlertsPanelOpen = false,
  onOpenTaskAlerts,
  onOpenSearch,
  isBusy = false,
  isProjectPlanningOpen = false,
  onOpenProjectPlanning,
}: AppNavbarProps) {
  const isLoggedIn = user !== null;
  const isFrench = locale === "fr";
  const profileLabel = user?.displayName ?? user?.email ?? (isFrench ? "Invite" : "Guest");
  const initials = profileLabel.slice(0, 2).toUpperCase();
  const taskAlertsCount = alertsSummary?.count ?? 0;
  const taskAlertsLabel = isFrench ? "Alertes" : "Alerts";

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[260px] flex-col border-r border-line bg-surface lg:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-sm font-bold text-white">J</div>
          <div>
            <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
            <p className="text-[11px] text-muted">{isFrench ? "Planification quotidienne" : "Daily planner"}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <div className="pt-3">
            <button
              type="button"
              onClick={onOpenSearch}
              disabled={!onOpenSearch}
              className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface-soft px-3 py-2 text-sm text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent"
            >
              <SearchIcon />
              <span className="flex-1 text-left">{isFrench ? "Rechercher..." : "Search..."}</span>
              <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-muted lg:block">⌘K</kbd>
            </button>
          </div>
          <nav className="space-y-0.5">
            <p className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{isFrench ? "Navigation" : "Navigation"}</p>
            <a href="#overview" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 transition-colors duration-150 hover:bg-surface-soft hover:text-foreground">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/></svg>
              {isFrench ? "Vue d'ensemble" : "Overview"}
            </a>
            <a href="#board" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 transition-colors duration-150 hover:bg-surface-soft hover:text-foreground">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 7h14M8 7v10M13 7v10"/></svg>
              {isFrench ? "Tableau Kanban" : "Kanban Board"}
            </a>
            <button
              type="button"
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150 ${
                isProjectPlanningOpen
                  ? "bg-accent-soft text-accent"
                  : "text-foreground/80 hover:bg-surface-soft hover:text-foreground"
              }`}
              onClick={onOpenProjectPlanning}
              disabled={isBusy || !onOpenProjectPlanning}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="2" y="4" width="16" height="2.5" rx="1"/>
                <rect x="2" y="8.75" width="11" height="2.5" rx="1"/>
                <rect x="2" y="13.5" width="14" height="2.5" rx="1"/>
              </svg>
              <span className="flex-1">{isFrench ? "Planification projet" : "Project Planning"}</span>
            </button>
            <button
              type="button"
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150 ${
                isTaskAlertsPanelOpen
                  ? "bg-accent-soft text-accent"
                  : "text-foreground/80 hover:bg-surface-soft hover:text-foreground"
              }`}
              onClick={onOpenTaskAlerts}
              disabled={isBusy || !onOpenTaskAlerts}
            >
              <span className="relative inline-flex items-center justify-center text-muted">
                <BellIcon />
                {taskAlertsCount > 0 ? (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
                    {taskAlertsCount > 9 ? "9+" : taskAlertsCount}
                  </span>
                ) : null}
              </span>
              <span className="flex-1">{taskAlertsLabel}</span>
            </button>
            <a href="#affirmation" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 transition-colors duration-150 hover:bg-surface-soft hover:text-foreground">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z"/></svg>
              {isFrench ? "Affirmation" : "Affirmation"}
            </a>
            <a href="#reminders" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 transition-colors duration-150 hover:bg-surface-soft hover:text-foreground">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 4a5 5 0 00-5 5v3l-1 2h12l-1-2V9a5 5 0 00-5-5zM8.5 16a1.5 1.5 0 003 0" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {isFrench ? "Rappels" : "Reminders"}
            </a>
            <a href="#bilan" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 transition-colors duration-150 hover:bg-surface-soft hover:text-foreground">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 15V8M8 15V5M12 15V9M16 15V6" strokeLinecap="round"/></svg>
              {isFrench ? "Bilan du jour" : "Day Bilan"}
            </a>
            <a href="#gaming" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 transition-colors duration-150 hover:bg-surface-soft hover:text-foreground">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z"/></svg>
              Gaming Track
            </a>
            <a href="#notes" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 transition-colors duration-150 hover:bg-surface-soft hover:text-foreground">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 3h10a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round"/></svg>
              {isFrench ? "Notes" : "Notes"}
            </a>
          </nav>
        </div>

        {isLoggedIn ? (
          <div className="border-t border-line px-3 py-4">
            <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{profileLabel}</p>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1 px-1">
              <button
                type="button"
                className="flex-1 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
                onClick={onOpenProfile}
                disabled={isBusy || !onOpenProfile}
              >
                {isFrench ? "Profil" : "Settings"}
              </button>
              <button
                type="button"
                className="flex-1 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                onClick={onLogout}
                disabled={isBusy || !onLogout}
              >
                {isFrench ? "Deconnexion" : "Logout"}
              </button>
            </div>
          </div>
        ) : null}
      </aside>

      {/* Mobile Navbar */}
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-xs font-bold text-white">J</div>
          <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
                onClick={onOpenSearch}
                disabled={!onOpenSearch}
                aria-label={isFrench ? "Rechercher" : "Search"}
              >
                <SearchIcon />
              </button>
              <button
                type="button"
                className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  isTaskAlertsPanelOpen ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-soft hover:text-foreground"
                }`}
                onClick={onOpenTaskAlerts}
                disabled={isBusy || !onOpenTaskAlerts}
                aria-label={taskAlertsLabel}
              >
                <BellIcon />
                {taskAlertsCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
                    {taskAlertsCount > 9 ? "9+" : taskAlertsCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
                onClick={onOpenProfile}
                disabled={isBusy || !onOpenProfile}
                aria-label={isFrench ? "Profil" : "Profile"}
              >
                <ProfileGlyph isLoggedIn />
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
                onClick={onLogout}
                disabled={isBusy || !onLogout}
                aria-label={isFrench ? "Deconnexion" : "Logout"}
              >
                <ArrowRightIcon />
              </button>
            </>
          ) : (
            <button type="button" className={controlButtonClass} onClick={onLogin} disabled={isBusy || !onLogin}>
              {isFrench ? "Connexion" : "Login"}
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

type RichTextEditorProps = {
  locale: UserLocale;
  value: string;
  disabled: boolean;
  onChange: (nextValue: string) => void;
};

function RichTextContent({ value, className }: { value: string; className: string }) {
  const html = renderDescriptionHtml(value);

  if (!html) {
    return null;
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function TiptapToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors duration-150 ${
        isActive
          ? "bg-accent/10 text-accent"
          : "text-muted hover:bg-surface-soft hover:text-foreground"
      } disabled:cursor-not-allowed disabled:opacity-40`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function TiptapToolbar({
  editor,
  disabled,
  locale,
}: {
  editor: Editor | null;
  disabled: boolean;
  locale: UserLocale;
}) {
  if (!editor) {
    return null;
  }

  const isFrench = locale === "fr";

  function addLink() {
    const previousUrl = editor?.getAttributes("link").href ?? "";
    const url = window.prompt(isFrench ? "Entrez une URL" : "Enter a URL", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    editor?.chain().focus().extendMarkRange("link").setLink({ href: normalizedUrl }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5">
      <TiptapToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        disabled={disabled}
        title={isFrench ? "Gras" : "Bold"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M4 2h5a3 3 0 011.5 5.6A3.5 3.5 0 019.5 14H4V2zm2 5h3a1 1 0 100-2H6v2zm0 2v3h3.5a1.5 1.5 0 000-3H6z"/></svg>
      </TiptapToolbarButton>

      <TiptapToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        disabled={disabled}
        title={isFrench ? "Italique" : "Italic"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M6 2h6v2h-2.2l-2.6 8H9v2H3v-2h2.2l2.6-8H6V2z"/></svg>
      </TiptapToolbarButton>

      <TiptapToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        disabled={disabled}
        title={isFrench ? "Souligne" : "Underline"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M4 2v5a4 4 0 008 0V2h-2v5a2 2 0 01-4 0V2H4zM3 14h10v1.5H3V14z"/></svg>
      </TiptapToolbarButton>

      <TiptapToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        disabled={disabled}
        title={isFrench ? "Barre" : "Strikethrough"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M2 7.5h12v1H2zM5.5 3C4.1 3 3 3.9 3 5.1c0 .7.3 1.2.8 1.6h2.3c-.5-.3-.8-.7-.8-1.1 0-.6.6-1 1.3-1h2.8c.7 0 1.3.4 1.3 1h2.1c0-1.3-1.3-2.4-3-2.5H5.5zM10.5 9.5H8.2c.5.3.8.7.8 1.1 0 .6-.6 1-1.3 1H5c-.7 0-1.3-.4-1.3-1H1.8c0 1.3 1.3 2.4 3 2.5h5.7c1.4 0 2.5-.9 2.5-2.1 0-.6-.3-1.1-.8-1.5H10.5z"/></svg>
      </TiptapToolbarButton>

      <div className="mx-1 h-4 w-px bg-line" />

      <TiptapToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
        disabled={disabled}
        title={isFrench ? "Surligner" : "Highlight"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M2 12h12v2H2zM9.4 2.3l4.3 4.3-6.4 6.4H3v-4.3l6.4-6.4zm0 2.1L4.5 9.3v1.2h1.2L10.6 5.6 9.4 4.4z"/></svg>
      </TiptapToolbarButton>

      <TiptapToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        disabled={disabled}
        title={isFrench ? "Code en ligne" : "Inline code"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5.5 4L2 8l3.5 4M10.5 4L14 8l-10.5 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </TiptapToolbarButton>

      <div className="mx-1 h-4 w-px bg-line" />

      <TiptapToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        disabled={disabled}
        title={isFrench ? "Liste a puces" : "Bullet list"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><circle cx="3" cy="4" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="3" cy="12" r="1.2"/><rect x="6" y="3" width="8" height="2" rx="0.5"/><rect x="6" y="7" width="8" height="2" rx="0.5"/><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg>
      </TiptapToolbarButton>

      <TiptapToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        disabled={disabled}
        title={isFrench ? "Liste numerotee" : "Numbered list"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><text x="1" y="5.5" fontSize="4" fontWeight="bold">1</text><text x="1" y="9.5" fontSize="4" fontWeight="bold">2</text><text x="1" y="13.5" fontSize="4" fontWeight="bold">3</text><rect x="6" y="3" width="8" height="2" rx="0.5"/><rect x="6" y="7" width="8" height="2" rx="0.5"/><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg>
      </TiptapToolbarButton>

      <TiptapToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        disabled={disabled}
        title={isFrench ? "Liste de taches" : "Task list"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="2" width="4" height="4" rx="0.8"/><path d="M2.8 4l.8.8L5.2 3" strokeLinecap="round" strokeLinejoin="round"/><rect x="1.5" y="10" width="4" height="4" rx="0.8"/><line x1="8" y1="4" x2="14.5" y2="4" strokeLinecap="round"/><line x1="8" y1="12" x2="14.5" y2="12" strokeLinecap="round"/></svg>
      </TiptapToolbarButton>

      <div className="mx-1 h-4 w-px bg-line" />

      <TiptapToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        disabled={disabled}
        title={isFrench ? "Citation" : "Quote"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M3 3h4v4.5c0 2.5-1.5 4-3.5 4.5l-.5-1.5c1.2-.3 2-1.2 2-2.5H3V3zm6 0h4v4.5c0 2.5-1.5 4-3.5 4.5l-.5-1.5c1.2-.3 2-1.2 2-2.5H9V3z"/></svg>
      </TiptapToolbarButton>

      <TiptapToolbarButton
        onClick={addLink}
        isActive={editor.isActive("link")}
        disabled={disabled}
        title={isFrench ? "Lien" : "Link"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6.5 9.5a3 3 0 004.2.3l2-2a3 3 0 00-4.2-4.3l-1.2 1.1" strokeLinecap="round"/><path d="M9.5 6.5a3 3 0 00-4.2-.3l-2 2a3 3 0 004.2 4.3l1.1-1.1" strokeLinecap="round"/></svg>
      </TiptapToolbarButton>

      <div className="mx-1 h-4 w-px bg-line" />

      <TiptapToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        disabled={disabled}
        title={isFrench ? "Separateur" : "Horizontal rule"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="8" x2="14" y2="8" strokeLinecap="round"/></svg>
      </TiptapToolbarButton>
    </div>
  );
}

function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

function convertMarkdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  if (isHtmlContent(markdown)) return markdown;
  return renderDescriptionHtml(markdown);
}

function RichTextEditor({ locale, value, disabled, onChange }: RichTextEditorProps) {
  const isFrench = locale === "fr";
  const lastExternalValueRef = useRef(value);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: isFrench
          ? "Commencez a ecrire..."
          : "Start writing...",
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Highlight,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: convertMarkdownToHtml(value),
    editable: !disabled,
    onUpdate: ({ editor: updatedEditor }) => {
      const html = updatedEditor.getHTML();
      const isEmpty = updatedEditor.isEmpty;
      const nextValue = isEmpty ? "" : html;
      lastExternalValueRef.current = nextValue;
      onChange(nextValue);
    },
    editorProps: {
      attributes: {
        class:
          "rich-text-render rich-text-editor min-h-[100px] px-3 py-2.5 text-sm leading-6 text-foreground outline-none focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    if (value === lastExternalValueRef.current) return;
    lastExternalValueRef.current = value;
    const htmlContent = convertMarkdownToHtml(value);
    editor.commands.setContent(htmlContent, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className={`mt-1 overflow-hidden rounded-lg border border-line bg-surface transition-all duration-200 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 ${disabled ? "opacity-50" : ""}`}>
      <TiptapToolbar editor={editor} disabled={disabled} locale={locale} />
      <EditorContent editor={editor} />
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
      className={`group relative rounded-xl bg-surface px-4 py-3.5 shadow-sm transition-all duration-200 ${
        isDragging ? "scale-[0.97] opacity-70 shadow-lg ring-2 ring-accent/20" : "hover:-translate-y-0.5 hover:shadow-md"
      } ${isSaving ? "cursor-wait opacity-80" : "cursor-grab active:cursor-grabbing"}`}
      aria-busy={isSaving}
      {...attributes}
      {...listeners}
    >
      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${
        task.priority === "high" ? "bg-red-400" : task.priority === "medium" ? "bg-indigo-400" : "bg-slate-300"
      }`} />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground">{task.title}</h3>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onEdit(task)}
            disabled={isSaving}
            aria-label={isFrench ? "Modifier la tache" : "Edit task"}
            title={isFrench ? "Modifier la tache" : "Edit task"}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-red-50 hover:text-red-500"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onDelete(task)}
            disabled={isSaving}
            aria-label={isFrench ? "Supprimer la tache" : "Delete task"}
            title={isFrench ? "Supprimer la tache" : "Delete task"}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {task.description ? (
        <RichTextContent
          value={task.description}
          className="rich-text-render mt-1.5 pl-2 text-[13px] leading-5 text-muted"
        />
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-2">
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${priorityChipClassByPriority[task.priority]}`}
        >
          {formatPriority(task.priority, locale)}
        </span>
        {task.dueDate ? (
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
            {isFrench ? "Echeance" : "Due"} {formatDateOnlyForLocale(task.dueDate, locale)}
          </span>
        ) : null}
        {task.project ? (
          <span className="rounded-md bg-surface-soft px-2 py-0.5 text-[11px] text-muted">
            {task.project}
          </span>
        ) : null}
        {typeof task.plannedTime === "number" ? (
          <span className="rounded-md bg-surface-soft px-2 py-0.5 text-[11px] text-muted">
            {formatPlannedTime(task.plannedTime)}
          </span>
        ) : null}
        {task.recurrenceSourceTaskId ? (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
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
  infoMessage: string | null;
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
  infoMessage,
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
      : mode === "register"
      ? isSubmitting
        ? isFrench
          ? "Creation..."
          : "Creating..."
        : isFrench
        ? "Creer un compte"
        : "Create account"
      : mode === "forgot_password"
      ? isSubmitting
        ? isFrench
          ? "Preparation..."
          : "Preparing..."
        : isFrench
        ? "Generer un jeton"
        : "Generate reset token"
      : isSubmitting
      ? isFrench
        ? "Reinitialisation..."
        : "Resetting..."
      : isFrench
      ? "Reinitialiser le mot de passe"
      : "Reset password";

  const heading =
    mode === "login"
      ? isFrench
        ? "Bon retour"
        : "Welcome back"
      : mode === "register"
      ? isFrench
        ? "Creer un compte"
        : "Create your account"
      : mode === "forgot_password"
      ? isFrench
        ? "Mot de passe oublie"
        : "Forgot password"
      : isFrench
      ? "Nouveau mot de passe"
      : "Set a new password";

  const subtitle =
    mode === "login"
      ? isFrench
        ? "Connectez-vous pour acceder a votre tableau."
        : "Sign in to access your daily board."
      : mode === "register"
      ? isFrench
        ? "Commencez a suivre vos taches maintenant."
        : "Start tracking your tasks today."
      : mode === "forgot_password"
      ? isFrench
        ? "Entrez votre email pour generer un jeton de reinitialisation."
        : "Enter your email to generate a reset token."
      : isFrench
      ? "Collez le jeton si besoin puis choisissez un nouveau mot de passe."
      : "Paste the token if needed, then choose a new password.";

  return (
    <div className="flex min-h-screen animate-fade-in">
      {/* Left branding panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-lg font-bold text-white backdrop-blur-sm">J</div>
            <p className="text-xl font-semibold text-white">{APP_NAME}</p>
          </div>
          <h1 className="mt-12 max-w-md text-4xl font-semibold leading-tight text-white">
            {isFrench
              ? "Organisez chaque journee avec intention."
              : "Organize every day with intention."}
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-indigo-200">{APP_TAGLINE}</p>

          <div className="mt-10 space-y-4">
            <div className="flex items-center gap-3 text-sm text-indigo-100">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/15">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              {isFrench ? "Planifiez par jour, gardez les priorites visibles" : "Plan by day, keep priorities visible"}
            </div>
            <div className="flex items-center gap-3 text-sm text-indigo-100">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/15">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              {isFrench ? "Glissez les taches entre les statuts" : "Drag tasks across statuses"}
            </div>
            <div className="flex items-center gap-3 text-sm text-indigo-100">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/15">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              {isFrench ? "Suivez votre progression et consistance" : "Track progress and consistency"}
            </div>
          </div>
        </div>
        <p className="text-xs text-indigo-300">&copy; {new Date().getFullYear()} {APP_NAME}</p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-10 lg:w-1/2 lg:px-16">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-sm font-bold text-white">J</div>
              <p className="text-lg font-semibold text-foreground">{APP_NAME}</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-foreground">
            {heading}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {subtitle}
          </p>

          {mode === "login" || mode === "register" ? (
            <div className="mt-6 inline-flex rounded-lg bg-surface-soft p-1">
              <button
                type="button"
                className={`rounded-md px-5 py-2 text-sm font-medium transition-all duration-200 ${
                  mode === "login" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                }`}
                onClick={() => onModeChange("login")}
                disabled={isSubmitting}
              >
                {isFrench ? "Connexion" : "Sign in"}
              </button>
              <button
                type="button"
                className={`rounded-md px-5 py-2 text-sm font-medium transition-all duration-200 ${
                  mode === "register" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                }`}
                onClick={() => onModeChange("register")}
                disabled={isSubmitting}
              >
                {isFrench ? "Inscription" : "Register"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mt-6 text-sm font-medium text-accent hover:text-accent-strong"
              onClick={() => onModeChange("login")}
              disabled={isSubmitting}
            >
              {isFrench ? "Retour a la connexion" : "Back to sign in"}
            </button>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {mode !== "reset_password" ? (
              <label className="block text-sm font-medium text-foreground">
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
            ) : null}

            {mode === "reset_password" ? (
              <label className="block text-sm font-medium text-foreground">
                {isFrench ? "Jeton de reinitialisation" : "Reset token"}
                <input
                  type="text"
                  autoComplete="one-time-code"
                  value={values.resetToken}
                  onChange={(event) => onValueChange("resetToken", event.target.value)}
                  className={textFieldClass}
                  disabled={isSubmitting}
                  placeholder={isFrench ? "Collez le jeton ici" : "Paste the token here"}
                  required
                />
              </label>
            ) : null}

            {mode !== "forgot_password" ? (
              <label className="block text-sm font-medium text-foreground">
                {mode === "reset_password"
                  ? isFrench
                    ? "Nouveau mot de passe"
                    : "New password"
                  : isFrench
                  ? "Mot de passe"
                  : "Password"}
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
            ) : null}

            {mode === "login" ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-strong"
                  onClick={() => onModeChange("forgot_password")}
                  disabled={isSubmitting}
                >
                  {isFrench ? "Mot de passe oublie ?" : "Forgot password?"}
                </button>
              </div>
            ) : null}

            {mode === "register" ? (
              <label className="block text-sm font-medium text-foreground">
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

            {infoMessage ? (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm text-sky-700">
                {infoMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button type="submit" className={`w-full py-3 ${primaryButtonClass}`} disabled={isSubmitting}>
              {submitLabel}
            </button>

            {mode === "reset_password" ? (
              <button
                type="button"
                className="w-full text-sm font-medium text-muted hover:text-foreground"
                onClick={() => onModeChange("forgot_password")}
                disabled={isSubmitting}
              >
                {isFrench ? "Generer un nouveau jeton" : "Generate a new token"}
              </button>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [guestLocale, setGuestLocale] = useState<UserLocale>("en");
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authFormValues, setAuthFormValues] = useState<AuthFormValues>({
    email: "",
    password: "",
    displayName: "",
    resetToken: "",
  });
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [authInfoMessage, setAuthInfoMessage] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [profileFormValues, setProfileFormValues] = useState<ProfileFormValues>(
    getDefaultProfileFormValues
  );
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [googleCalendarConnections, setGoogleCalendarConnections] = useState<
    Array<{ id: string; email: string; color: string; calendarId: string; lastSyncedAt: string | null }>
  >([]);
  const [isGoogleCalendarAvailable, setIsGoogleCalendarAvailable] = useState(true);
  const [isGoogleCalendarLoading, setIsGoogleCalendarLoading] = useState(false);
  const [isGoogleCalendarSyncing, setIsGoogleCalendarSyncing] = useState(false);
  const [googleCalendarError, setGoogleCalendarError] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventSummary[]>([]);
  const [isCalendarEventsLoading, setIsCalendarEventsLoading] = useState(false);
  const [calendarEventNoteDrafts, setCalendarEventNoteDrafts] = useState<Record<string, string>>({});
  const [pendingCalendarEventNoteIds, setPendingCalendarEventNoteIds] = useState<string[]>([]);
  const [calendarEventNoteAttachments, setCalendarEventNoteAttachments] = useState<Record<string, CalendarEventNoteAttachment[]>>({});
  const [calendarEventNoteAttachmentNameDraft, setCalendarEventNoteAttachmentNameDraft] = useState("");
  const [calendarEventNoteAttachmentFileDraft, setCalendarEventNoteAttachmentFileDraft] = useState<File | null>(null);
  const calendarEventNoteAttachmentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [calendarEventNoteAttachmentErrorMessage, setCalendarEventNoteAttachmentErrorMessage] = useState<string | null>(null);
  const [isCreatingCalendarEventNoteAttachment, setIsCreatingCalendarEventNoteAttachment] = useState(false);
  const [pendingCalendarEventNoteAttachmentIds, setPendingCalendarEventNoteAttachmentIds] = useState<string[]>([]);
  const [pendingCalendarEventTaskIds, setPendingCalendarEventTaskIds] = useState<string[]>([]);
  const [expandedCalendarEventId, setExpandedCalendarEventId] = useState<string | null>(null);
  const [calendarEventSearchQuery, setCalendarEventSearchQuery] = useState("");
  const [connectionCalendarOptions, setConnectionCalendarOptions] = useState<
    Record<string, Array<{ id: string; summary: string; primary: boolean }>>
  >({});

  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragErrorMessage, setDragErrorMessage] = useState<string | null>(null);
  const [isCarryingOverYesterday, setIsCarryingOverYesterday] = useState(false);
  const [carryOverMessage, setCarryOverMessage] = useState<string | null>(null);
  const [carryOverErrorMessage, setCarryOverErrorMessage] = useState<string | null>(null);
  const [dashboardBlockOrder, setDashboardBlockOrder] = useState<DashboardBlockId[]>(
    () => getInitialDashboardLayoutConfig().order
  );
  const [dashboardBlockCollapsed, setDashboardBlockCollapsed] = useState<Record<DashboardBlockId, boolean>>(
    () => getInitialDashboardLayoutConfig().collapsed
  );
  const [draggedDashboardBlockId, setDraggedDashboardBlockId] = useState<DashboardBlockId | null>(null);
  const [dashboardDropTargetId, setDashboardDropTargetId] = useState<DashboardBlockId | null>(null);
  const [dayAffirmation, setDayAffirmation] = useState<DayAffirmation | null>(null);
  const [dayAffirmationDraft, setDayAffirmationDraft] = useState("");
  const dayAffirmationDraftRef = useRef(dayAffirmationDraft);
  const dayAffirmationCacheRef = useRef<Record<string, DayAffirmation | null>>({});
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
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);
  const [reminderDialogMode, setReminderDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [reminderFormValues, setReminderFormValues] = useState<ReminderFormValues>({ title: "", description: "", project: "", assignees: "", remindAt: "" });
  const [reminderErrorMessage, setReminderErrorMessage] = useState<string | null>(null);
  const [isSubmittingReminder, setIsSubmittingReminder] = useState(false);
  const [pendingReminders, setPendingReminders] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [noteDialogMode, setNoteDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteFormValues, setNoteFormValues] = useState<NoteFormValues>({
    title: "",
    body: "",
    color: "",
    targetDate: "",
    calendarEventId: "",
  });
  const [noteErrorMessage, setNoteErrorMessage] = useState<string | null>(null);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [noteAttachments, setNoteAttachments] = useState<Record<string, NoteAttachment[]>>({});
  const [noteAttachmentNameDraft, setNoteAttachmentNameDraft] = useState("");
  const [noteAttachmentFileDraft, setNoteAttachmentFileDraft] = useState<File | null>(null);
  const noteAttachmentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [noteAttachmentErrorMessage, setNoteAttachmentErrorMessage] = useState<string | null>(null);
  const [isCreatingNoteAttachment, setIsCreatingNoteAttachment] = useState(false);
  const [pendingNoteAttachmentIds, setPendingNoteAttachmentIds] = useState<string[]>([]);

  const [reminderAttachments, setReminderAttachments] = useState<Record<string, ReminderAttachment[]>>({});
  const [reminderAttachmentNameDraft, setReminderAttachmentNameDraft] = useState("");
  const [reminderAttachmentFileDraft, setReminderAttachmentFileDraft] = useState<File | null>(null);
  const reminderAttachmentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [reminderAttachmentErrorMessage, setReminderAttachmentErrorMessage] = useState<string | null>(null);
  const [isCreatingReminderAttachment, setIsCreatingReminderAttachment] = useState(false);
  const [pendingReminderAttachmentIds, setPendingReminderAttachmentIds] = useState<string[]>([]);
  const [gamingTrackPeriod, setGamingTrackPeriod] = useState<GamingTrackPeriod>("week");
  const [gamingTrackSummary, setGamingTrackSummary] = useState<GamingTrackSummary | null>(null);
  const [isGamingTrackLoading, setIsGamingTrackLoading] = useState(false);
  const [isGamingTrackActionPending, setIsGamingTrackActionPending] = useState(false);
  const [gamingTrackActionMessage, setGamingTrackActionMessage] = useState<string | null>(null);
  const [gamingTrackErrorMessage, setGamingTrackErrorMessage] = useState<string | null>(null);
  const [isAssistantPanelOpen, setIsAssistantPanelOpen] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<AssistantChatMessage[]>([]);
  const [assistantErrorMessage, setAssistantErrorMessage] = useState<string | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const assistantMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const [taskAlertsSummary, setTaskAlertsSummary] = useState<TaskAlertsSummary | null>(null);
  const [alertReminders, setAlertReminders] = useState<Reminder[]>([]);
  const [taskAlertsErrorMessage, setTaskAlertsErrorMessage] = useState<string | null>(null);
  const [isTaskAlertsLoading, setIsTaskAlertsLoading] = useState(false);
  const [isTaskAlertsPanelOpen, setIsTaskAlertsPanelOpen] = useState(false);
  const [taskAlertsReloadKey, setTaskAlertsReloadKey] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([]);
  const [taskFilterValues, setTaskFilterValues] = useState<TaskFilterValues>(DEFAULT_TASK_FILTER_VALUES);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [pendingOpenTaskId, setPendingOpenTaskId] = useState<string | null>(null);
  const [pendingOpenReminderId, setPendingOpenReminderId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState<GlobalSearchState>({
    query: "",
    results: [],
    totalCount: 0,
    page: 1,
    hasMore: false,
    isLoading: false,
    errorMessage: null,
    typeFilter: "all",
    from: "",
    to: "",
    recentResults: [],
    isLoadingRecent: false,
  });
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateDayAffirmationDraft = useCallback((nextValue: string) => {
    dayAffirmationDraftRef.current = nextValue;
    setDayAffirmationDraft(nextValue);
  }, []);

  const applyDayAffirmationState = useCallback((nextAffirmation: DayAffirmation | null) => {
    setDayAffirmation(nextAffirmation);
    updateDayAffirmationDraft(nextAffirmation?.text ?? "");
  }, [updateDayAffirmationDraft]);

  function getCachedDayAffirmation(date: string): DayAffirmation | null | undefined {
    return Object.prototype.hasOwnProperty.call(dayAffirmationCacheRef.current, date)
      ? dayAffirmationCacheRef.current[date]
      : undefined;
  }

  function cacheDayAffirmation(date: string, nextAffirmation: DayAffirmation | null) {
    dayAffirmationCacheRef.current[date] = nextAffirmation;
  }

  function shouldApplyFetchedDayAffirmation(
    nextAffirmation: DayAffirmation | null,
    cachedAffirmation: DayAffirmation | null | undefined
  ) {
    if (nextAffirmation === null) {
      return cachedAffirmation === undefined || cachedAffirmation === null;
    }

    if (!cachedAffirmation) {
      return true;
    }

    const nextUpdatedAt = Date.parse(nextAffirmation.updatedAt);
    const cachedUpdatedAt = Date.parse(cachedAffirmation.updatedAt);

    if (Number.isNaN(nextUpdatedAt) || Number.isNaN(cachedUpdatedAt)) {
      return true;
    }

    return nextUpdatedAt >= cachedUpdatedAt;
  }

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

  // Project planning view state
  const [isProjectPlanningOpen, setIsProjectPlanningOpen] = useState(false);
  const [allProjectTasks, setAllProjectTasks] = useState<Task[]>([]);
  const [isLoadingAllTasks, setIsLoadingAllTasks] = useState(false);
  const [allTasksErrorMessage, setAllTasksErrorMessage] = useState<string | null>(null);
  const [projectPlanningViewMode, setProjectPlanningViewMode] = useState<"table" | "gantt">("table");
  const [projectPlanningFilters, setProjectPlanningFilters] = useState({
    project: "",
    status: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [projectPlanningSort, setProjectPlanningSort] = useState<{ column: string; dir: "asc" | "desc" }>({
    column: "targetDate",
    dir: "asc",
  });

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

  const connectionColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const conn of googleCalendarConnections) {
      map.set(conn.id, conn.color);
    }
    return map;
  }, [googleCalendarConnections]);

  const filteredCalendarEvents = useMemo(() => {
    if (!calendarEventSearchQuery.trim()) return calendarEvents;
    const q = calendarEventSearchQuery.toLowerCase();
    return calendarEvents.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q))
    );
  }, [calendarEvents, calendarEventSearchQuery]);

  const editingNote = useMemo(() => {
    if (!editingNoteId) {
      return null;
    }

    return notes.find((note) => note.id === editingNoteId) ?? null;
  }, [editingNoteId, notes]);

  const linkedCalendarEventIdsInUse = useMemo(() => {
    return new Set(
      notes
        .filter((note) => note.id !== editingNoteId && note.calendarEventId)
        .map((note) => note.calendarEventId as string)
    );
  }, [editingNoteId, notes]);

  const noteCalendarEventOptions = useMemo(() => {
    const options = new Map<
      string,
      {
        id: string;
        title: string;
        startTime: string;
        endTime: string;
        isAllDay: boolean;
        startDate: string | null;
        endDate: string | null;
        htmlLink: string | null;
      }
    >();

    for (const event of calendarEvents) {
      options.set(event.id, {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        startDate: event.startDate,
        endDate: event.endDate,
        htmlLink: event.htmlLink,
      });
    }

    if (
      editingNote?.linkedCalendarEvent &&
      !options.has(editingNote.linkedCalendarEvent.id)
    ) {
      options.set(editingNote.linkedCalendarEvent.id, {
        ...editingNote.linkedCalendarEvent,
        isAllDay: false,
        startDate: editingNote.linkedCalendarEvent.startTime.substring(0, 10),
        endDate: null,
      });
    }

    return [...options.values()].sort(
      (left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime()
    );
  }, [calendarEvents, editingNote]);

  const editingTask = useMemo(() => {
    if (!editingTaskId) {
      return null;
    }

    return tasks.find((task) => task.id === editingTaskId) ?? null;
  }, [editingTaskId, tasks]);

  const isTaskDialogOpen = taskDialogMode !== null;
  const isNoteDialogOpen = noteDialogMode !== null;
  const isMutationPending = isSubmittingTask || isDeletingTask || isCarryingOverYesterday;
  const activeLocale = getPreferredLocale(authUser?.preferredLocale ?? guestLocale);
  const isFrench = activeLocale === "fr";
  const boardColumns = getBoardColumns(activeLocale);
  const priorityOptions = getPriorityOptions(activeLocale);
  const recurrenceFrequencyOptions = getRecurrenceFrequencyOptions(activeLocale);
  const weekdayOptions = getWeekdayOptions(activeLocale);
  const taskSearchQuery = normalizeTaskFilterText(taskFilterValues.query);
  const gamingTrackPeriodOptions = getGamingTrackPeriodOptions(activeLocale);
  const assistantPromptSuggestions = getAssistantPromptSuggestions(activeLocale);
  const userLocaleOptions = getUserLocaleOptions(activeLocale);
  const activeTimeZone = authUser?.preferredTimeZone ?? null;
  const taskAlertsAnchorDate = getCurrentDateInputValue(activeTimeZone ?? getBrowserTimeZone());
  const alertRemindersHorizonDate = shiftDate(taskAlertsAnchorDate, 1);
  const dashboardIconButtonClass = `${iconButtonClass} h-9 w-9 rounded-xl px-0`;
  const alertPanelItems = useMemo(() => {
    const taskItems: AlertPanelItem[] = (taskAlertsSummary?.tasks ?? []).flatMap((task) => {
      if (!task.dueDate) {
        return [];
      }

      const urgency = getAlertUrgency(task.dueDate, taskAlertsAnchorDate);
      if (!urgency) {
        return [];
      }

      return [
        {
          sourceType: "task",
          urgency,
          sortValue: parseDateInput(task.dueDate).getTime(),
          task,
        },
      ];
    });

    const reminderItems: AlertPanelItem[] = alertReminders.flatMap((reminder) => {
      const remindAt = new Date(reminder.remindAt);
      if (Number.isNaN(remindAt.getTime())) {
        return [];
      }

      const remindDateValue = formatDateInputForTimeZone(remindAt, activeTimeZone);
      const urgency = getAlertUrgency(remindDateValue, taskAlertsAnchorDate);
      if (!urgency) {
        return [];
      }

      return [
        {
          sourceType: "reminder",
          urgency,
          sortValue: remindAt.getTime(),
          reminder,
        },
      ];
    });

    return [...taskItems, ...reminderItems].sort(compareAlertPanelItems);
  }, [activeTimeZone, alertReminders, taskAlertsAnchorDate, taskAlertsSummary]);
  const alertsSummary = useMemo<AlertsSummary>(() => {
    const summary: AlertsSummary = {
      count: alertPanelItems.length,
      overdueCount: 0,
      todayCount: 0,
      tomorrowCount: 0,
    };

    for (const item of alertPanelItems) {
      if (item.urgency === "overdue") {
        summary.overdueCount += 1;
        continue;
      }

      if (item.urgency === "today") {
        summary.todayCount += 1;
        continue;
      }

      summary.tomorrowCount += 1;
    }

    return summary;
  }, [alertPanelItems]);
  const dashboardBlockOrderIndex = useMemo(() => {
    const fallbackIndex = Object.fromEntries(
      DASHBOARD_BLOCK_IDS.map((blockId, index) => [blockId, index])
    ) as Record<DashboardBlockId, number>;

    dashboardBlockOrder.forEach((blockId, index) => {
      fallbackIndex[blockId] = index;
    });

    return fallbackIndex;
  }, [dashboardBlockOrder]);
  const getDashboardBlockVisualOrder = useCallback(
    (blockId: DashboardBlockId, offset = 0) => (dashboardBlockOrderIndex[blockId] ?? 0) * 10 + offset,
    [dashboardBlockOrderIndex]
  );
  const isAllDashboardBlocksCollapsed = DASHBOARD_BLOCK_IDS.every((blockId) => dashboardBlockCollapsed[blockId]);
  const getCollapseToggleLabel = (isCollapsed: boolean) =>
    isCollapsed
      ? isFrench
        ? "Developper"
        : "Expand"
      : isFrench
      ? "Reduire"
      : "Collapse";
  const getCollapseToggleAriaLabel = (blockId: DashboardBlockId, isCollapsed: boolean) => {
    const blockLabel = formatDashboardBlockLabel(blockId, activeLocale);
    const action = getCollapseToggleLabel(isCollapsed);
    return `${action} ${blockLabel}`;
  };
  const getDashboardDragHandleLabel = (blockId: DashboardBlockId) => {
    const blockLabel = formatDashboardBlockLabel(blockId, activeLocale);
    return isFrench ? `Deplacer ${blockLabel}` : `Move ${blockLabel}`;
  };
  const getDashboardDropClassName = (blockId: DashboardBlockId) =>
    draggedDashboardBlockId && dashboardDropTargetId === blockId
      ? "ring-2 ring-accent/35 ring-offset-2 ring-offset-surface"
      : "";
  const collapseAllBlocksButtonLabel = isAllDashboardBlocksCollapsed
    ? isFrench
      ? "Developper tous les blocs"
      : "Expand all blocks"
    : isFrench
    ? "Reduire tous les blocs"
    : "Collapse all blocks";
  const collapsedHintLabel = isFrench ? "Bloc replie." : "Block collapsed.";
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

  const normalizedReminderProject = normalizeProjectName(reminderFormValues.project);
  const projectSelectOptions = useMemo(
    () => getUniqueSortedProjectNames([...projectOptions, normalizedSelectedProject, normalizedReminderProject]),
    [normalizedSelectedProject, normalizedReminderProject, projectOptions]
  );

  const taskDialogHeightClass = taskDialogMode === "edit" ? "max-h-[76vh]" : "max-h-[82vh]";
  const noteDialogHeightClass = noteDialogMode === "edit" ? "max-h-[82vh]" : "max-h-[76vh]";

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
    setAuthMode("login");
    setAuthErrorMessage(null);
    setAuthInfoMessage(null);
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
    setGoogleCalendarConnections([]);
    setIsGoogleCalendarAvailable(true);
    setIsGoogleCalendarLoading(false);
    setIsGoogleCalendarSyncing(false);
    setGoogleCalendarError(null);
    setCalendarEvents([]);
    setIsCalendarEventsLoading(false);
    setCalendarEventNoteDrafts({});
    setPendingCalendarEventNoteIds([]);
    setCalendarEventNoteAttachments({});
    setPendingCalendarEventNoteAttachmentIds([]);
    setPendingCalendarEventTaskIds([]);
    setExpandedCalendarEventId(null);
    setCalendarEventSearchQuery("");
    setConnectionCalendarOptions({});
    setTasks([]);
    setErrorMessage(null);
    setDragErrorMessage(null);
    setIsCarryingOverYesterday(false);
    setCarryOverMessage(null);
    setCarryOverErrorMessage(null);
    setDraggedDashboardBlockId(null);
    setDashboardDropTargetId(null);
    dayAffirmationCacheRef.current = {};
    applyDayAffirmationState(null);
    setIsDayAffirmationLoading(false);
    setIsDayAffirmationSaving(false);
    setDayAffirmationErrorMessage(null);
    setDayBilan(null);
    setDayBilanFormValues(getDefaultDayBilanFormValues());
    setIsDayBilanLoading(false);
    setIsDayBilanSaving(false);
    setDayBilanErrorMessage(null);
    setDayBilanSuccessMessage(null);
    setReminders([]);
    setIsLoadingReminders(false);
    setReminderDialogMode(null);
    setEditingReminderId(null);
    setReminderErrorMessage(null);
    setIsSubmittingReminder(false);
    setGamingTrackPeriod("week");
    setGamingTrackSummary(null);
    setIsGamingTrackLoading(false);
    setIsGamingTrackActionPending(false);
    setGamingTrackActionMessage(null);
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
    setAuthMode("login");
    setAuthErrorMessage(null);
    setAuthInfoMessage(null);
    setAuthFormValues((current) => ({
      ...current,
      password: "",
      resetToken: "",
    }));
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
  }, [applyDayAffirmationState]);

  function handleAuthFormFieldChange(field: keyof AuthFormValues, value: string) {
    setAuthFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleAuthModeChange(mode: AuthMode) {
    setAuthMode(mode);
    setAuthErrorMessage(null);
    setAuthInfoMessage(null);
    setAuthFormValues((current) => ({
      ...current,
      password: "",
      displayName: mode === "register" ? current.displayName : "",
      resetToken: mode === "reset_password" ? current.resetToken : "",
    }));
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAuthSubmitting) {
      return;
    }

    setAuthErrorMessage(null);
    setAuthInfoMessage(null);
    setIsAuthSubmitting(true);

    try {
      if (authMode === "login" || authMode === "register") {
        const result =
          authMode === "login" ? await loginUser(authFormValues) : await registerUser(authFormValues);

        applyAuthSession(result.token, result.user);
        setAuthFormValues({
          email: result.user.email,
          password: "",
          displayName: result.user.displayName ?? "",
          resetToken: "",
        });
      } else if (authMode === "forgot_password") {
        const result = await requestPasswordReset(authFormValues.email);
        const resetToken = result.resetToken;
        if (resetToken) {
          setAuthFormValues((current) => ({
            ...current,
            password: "",
            resetToken,
          }));
          setAuthMode("reset_password");
          setAuthInfoMessage(
            isFrench
              ? "Un jeton de reinitialisation a ete genere. Choisissez maintenant un nouveau mot de passe."
              : "A reset token was generated. You can now choose a new password."
          );
        } else {
          setAuthFormValues((current) => ({
            ...current,
            password: "",
            resetToken: "",
          }));
          setAuthInfoMessage(
            isFrench
              ? "Aucun jeton n'a ete genere. Verifiez l'email saisi ou creez un compte si vous n'en avez pas encore."
              : "No reset token was generated. Check the email address or create an account if you do not have one yet."
          );
        }
      } else {
        const result = await resetPasswordWithToken(
          authFormValues.resetToken,
          authFormValues.password
        );

        applyAuthSession(result.token, result.user);
        setAuthFormValues({
          email: result.user.email,
          password: "",
          displayName: result.user.displayName ?? "",
          resetToken: "",
        });
      }
    } catch (error) {
      if (
        authMode === "reset_password" &&
        error instanceof ApiRequestError &&
        error.statusCode === 401 &&
        error.apiCode === "INVALID_RESET_TOKEN"
      ) {
        setAuthMode("login");
        setAuthFormValues((current) => ({
          ...current,
          password: "",
          resetToken: "",
        }));
        setAuthErrorMessage(
          isFrench
            ? "Ce jeton de reinitialisation n'est plus valide. Connectez-vous avec votre mot de passe actuel ou demandez un nouveau jeton."
            : "This reset token is no longer valid. Sign in with your current password or request a new reset token."
        );
        return;
      }

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

  async function fetchGoogleCalendarStatus() {
    if (!authToken) return;
    setIsGoogleCalendarLoading(true);
    setGoogleCalendarError(null);
    try {
      const response = await fetch("/backend-api/google-calendar/status", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.status === 404) {
        setIsGoogleCalendarAvailable(false);
        setGoogleCalendarConnections([]);
        setGoogleCalendarError(getGoogleCalendarUnavailableMessage(isFrench));
        return;
      }
      if (response.ok) {
        setIsGoogleCalendarAvailable(true);
        const payload = await response.json();
        setGoogleCalendarConnections(payload.data.connections ?? []);
      }
    } catch {
      // Non-critical — connections will stay empty
    } finally {
      setIsGoogleCalendarLoading(false);
    }
  }

  async function handleConnectGoogleCalendar() {
    if (!authToken) return;
    if (!isGoogleCalendarAvailable) {
      setGoogleCalendarError(getGoogleCalendarUnavailableMessage(isFrench));
      return;
    }
    setGoogleCalendarError(null);
    try {
      const response = await fetch("/backend-api/google-calendar/auth-url", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.status === 404) {
        setIsGoogleCalendarAvailable(false);
        setGoogleCalendarError(getGoogleCalendarUnavailableMessage(isFrench));
        return;
      }
      if (!response.ok) {
        setGoogleCalendarError(
          isFrench
            ? "Impossible de demarrer la connexion Google Calendar."
            : "Unable to start Google Calendar connection."
        );
        return;
      }
      const payload = await response.json();
      window.location.href = payload.data.url;
    } catch {
      setGoogleCalendarError(
        isFrench
          ? "Impossible de demarrer la connexion Google Calendar."
          : "Unable to start Google Calendar connection."
      );
    }
  }

  async function handleDisconnectGoogleCalendar(connectionId: string) {
    if (!authToken) return;
    setGoogleCalendarError(null);
    try {
      const response = await fetch(`/backend-api/google-calendar/connection/${connectionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        setGoogleCalendarConnections((prev) => prev.filter((c) => c.id !== connectionId));
      } else {
        setGoogleCalendarError(
          isFrench ? "Impossible de deconnecter Google Calendar." : "Unable to disconnect Google Calendar."
        );
      }
    } catch {
      setGoogleCalendarError(
        isFrench ? "Impossible de deconnecter Google Calendar." : "Unable to disconnect Google Calendar."
      );
    }
  }

  async function handleUpdateConnectionColor(connectionId: string, color: string) {
    if (!authToken) return;
    try {
      const response = await fetch(`/backend-api/google-calendar/connection/${connectionId}/color`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (response.ok) {
        setGoogleCalendarConnections((prev) =>
          prev.map((c) => (c.id === connectionId ? { ...c, color } : c))
        );
      }
    } catch {
      // Non-critical
    }
  }

  async function fetchConnectionCalendars(connectionId: string) {
    if (!authToken) return;
    try {
      const response = await fetch(`/backend-api/google-calendar/connection/${connectionId}/calendars`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const payload = await response.json();
        setConnectionCalendarOptions((prev) => ({ ...prev, [connectionId]: payload.data ?? [] }));
      }
    } catch {
      // Non-critical
    }
  }

  async function handleUpdateCalendarId(connectionId: string, calendarId: string) {
    if (!authToken) return;
    setGoogleCalendarError(null);
    try {
      const response = await fetch(`/backend-api/google-calendar/connection/${connectionId}/calendar`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId }),
      });
      if (response.ok) {
        setGoogleCalendarConnections((prev) =>
          prev.map((c) => (c.id === connectionId ? { ...c, calendarId } : c))
        );
        // Re-sync after calendar change
        handleSyncGoogleCalendar();
      } else {
        const payload = await response.json().catch(() => null);
        setGoogleCalendarError(
          payload?.error?.message ??
            (isFrench
              ? "Impossible de changer le calendrier selectionne."
              : "Unable to change the selected calendar.")
        );
      }
    } catch {
      setGoogleCalendarError(
        isFrench
          ? "Impossible de changer le calendrier selectionne."
          : "Unable to change the selected calendar."
      );
    }
  }

  async function fetchCalendarEvents(date: string, forceLoad = false) {
    if (!authToken || (!forceLoad && googleCalendarConnections.length === 0)) {
      setCalendarEvents([]);
      setCalendarEventNoteDrafts({});
      setExpandedCalendarEventId(null);
      return;
    }
    setIsCalendarEventsLoading(true);
    try {
      const response = await fetch(`/backend-api/google-calendar/events?date=${date}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const payload = await response.json();
        const nextEvents = (payload.data ?? []) as CalendarEventSummary[];
        setCalendarEvents(nextEvents);
        setCalendarEventNoteDrafts(
          Object.fromEntries(nextEvents.map((event) => [event.id, event.note?.body ?? ""]))
        );
        setExpandedCalendarEventId(null);
      } else {
        setCalendarEvents([]);
        setCalendarEventNoteDrafts({});
        setExpandedCalendarEventId(null);
      }
    } catch {
      setCalendarEvents([]);
      setCalendarEventNoteDrafts({});
      setExpandedCalendarEventId(null);
    } finally {
      setIsCalendarEventsLoading(false);
    }
  }

  async function handleSyncGoogleCalendar() {
    if (!authToken) return;
    setGoogleCalendarError(null);
    setIsGoogleCalendarSyncing(true);
    try {
      const response = await fetch("/backend-api/google-calendar/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        await fetchGoogleCalendarStatus();
        await fetchCalendarEvents(selectedDate, true);
      } else {
        const payload = await response.json().catch(() => null);
        setGoogleCalendarError(
          payload?.error?.message ??
            (isFrench ? "La synchronisation a echoue." : "Sync failed.")
        );
      }
    } catch {
      setGoogleCalendarError(
        isFrench ? "La synchronisation a echoue." : "Sync failed."
      );
    } finally {
      setIsGoogleCalendarSyncing(false);
    }
  }

  async function handleSaveCalendarEventNote(eventId: string) {
    if (!authToken) return;
    const draft = (calendarEventNoteDrafts[eventId] ?? "").trim();
    if (!draft) {
      setGoogleCalendarError(
        isFrench ? "La note de l'evenement ne peut pas etre vide." : "Calendar event note cannot be empty."
      );
      return;
    }

    setGoogleCalendarError(null);
    setPendingCalendarEventNoteIds((current) =>
      current.includes(eventId) ? current : [...current, eventId]
    );

    try {
      const note = await saveCalendarEventNote(eventId, draft, authToken);
      setCalendarEvents((current) =>
        current.map((event) => (event.id === eventId ? { ...event, note } : event))
      );
      setCalendarEventNoteDrafts((current) => ({
        ...current,
        [eventId]: note.body,
      }));
    } catch (error) {
      setGoogleCalendarError(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible d'enregistrer la note de l'evenement."
          : "Unable to save calendar event note."
      );
    } finally {
      setPendingCalendarEventNoteIds((current) => current.filter((candidate) => candidate !== eventId));
    }
  }

  async function handleDeleteCalendarEventNote(eventId: string) {
    if (!authToken) return;

    setGoogleCalendarError(null);
    setPendingCalendarEventNoteIds((current) =>
      current.includes(eventId) ? current : [...current, eventId]
    );

    try {
      await deleteCalendarEventNote(eventId, authToken);
      setCalendarEvents((current) =>
        current.map((event) => (event.id === eventId ? { ...event, note: null } : event))
      );
      setCalendarEventNoteDrafts((current) => ({
        ...current,
        [eventId]: "",
      }));
    } catch (error) {
      setGoogleCalendarError(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de supprimer la note de l'evenement."
          : "Unable to delete calendar event note."
      );
    } finally {
      setPendingCalendarEventNoteIds((current) => current.filter((candidate) => candidate !== eventId));
    }
  }

  async function handleLoadCalendarEventNoteAttachments(eventId: string) {
    if (!authToken || calendarEventNoteAttachments[eventId]) return;
    try {
      const attachments = await loadCalendarEventNoteAttachments(eventId, authToken);
      setCalendarEventNoteAttachments((prev) => ({ ...prev, [eventId]: attachments }));
    } catch {
      setCalendarEventNoteAttachments((prev) => ({ ...prev, [eventId]: [] }));
    }
  }

  async function handleCreateCalendarEventNoteAttachment(eventId: string) {
    if (!authToken || isCreatingCalendarEventNoteAttachment) return;
    const file = calendarEventNoteAttachmentFileDraft;
    const name = calendarEventNoteAttachmentNameDraft.trim() || file?.name?.trim() || "";

    if (!name) {
      setCalendarEventNoteAttachmentErrorMessage(isFrench ? "Le nom de la piece jointe est requis." : "Attachment name is required.");
      return;
    }
    if (!file) {
      setCalendarEventNoteAttachmentErrorMessage(isFrench ? "Veuillez selectionner un fichier." : "Please select a file.");
      return;
    }

    setCalendarEventNoteAttachmentErrorMessage(null);
    setIsCreatingCalendarEventNoteAttachment(true);

    try {
      const attachment = await createCalendarEventNoteAttachmentApi(eventId, { name, file }, authToken);
      setCalendarEventNoteAttachments((prev) => ({
        ...prev,
        [eventId]: [...(prev[eventId] ?? []), attachment],
      }));
      setCalendarEventNoteAttachmentNameDraft("");
      setCalendarEventNoteAttachmentFileDraft(null);
      if (calendarEventNoteAttachmentFileInputRef.current) calendarEventNoteAttachmentFileInputRef.current.value = "";
    } catch (error) {
      setCalendarEventNoteAttachmentErrorMessage(
        error instanceof Error ? error.message : isFrench ? "Impossible d'ajouter le document." : "Unable to add document."
      );
    } finally {
      setIsCreatingCalendarEventNoteAttachment(false);
    }
  }

  async function handleDeleteCalendarEventNoteAttachment(eventId: string, attachmentId: string) {
    if (!authToken) return;
    setPendingCalendarEventNoteAttachmentIds((prev) => [...prev, attachmentId]);
    try {
      await deleteCalendarEventNoteAttachmentApi(eventId, attachmentId, authToken);
      setCalendarEventNoteAttachments((prev) => ({
        ...prev,
        [eventId]: (prev[eventId] ?? []).filter((a) => a.id !== attachmentId),
      }));
    } catch {
      // silent
    } finally {
      setPendingCalendarEventNoteAttachmentIds((prev) => prev.filter((id) => id !== attachmentId));
    }
  }

  async function performGlobalSearch(
    query: string,
    page: number,
    typeFilter: SearchSourceType | "all",
    from: string,
    to: string,
    append = false
  ) {
    if (!authToken || query.trim().length < 2) return;

    setGlobalSearch((prev) => ({ ...prev, isLoading: true, errorMessage: null }));

    const params = new URLSearchParams({ q: query.trim(), page: String(page), limit: "30" });
    if (typeFilter !== "all") params.set("types", typeFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      const response = await fetch(`/backend-api/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(err?.error?.message ?? "Search failed");
      }
      const payload = await response.json() as {
        data: {
          results: SearchResult[];
          totalCount: number;
          page: number;
          hasMore: boolean;
        };
      };
      setGlobalSearch((prev) => ({
        ...prev,
        results: append ? [...prev.results, ...payload.data.results] : payload.data.results,
        totalCount: payload.data.totalCount,
        page: payload.data.page,
        hasMore: payload.data.hasMore,
        isLoading: false,
      }));
    } catch (error) {
      setGlobalSearch((prev) => ({
        ...prev,
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : isFrench ? "Erreur de recherche" : "Search error",
      }));
    }
  }

  function handleSearchQueryChange(value: string) {
    setGlobalSearch((prev) => ({ ...prev, query: value, page: 1, results: [], totalCount: 0, hasMore: false }));
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.trim().length < 2) return;
    searchDebounceRef.current = setTimeout(() => {
      performGlobalSearch(value, 1, globalSearch.typeFilter, globalSearch.from, globalSearch.to);
    }, 300);
  }

  function handleSearchTypeFilterChange(nextFilter: SearchSourceType | "all") {
    setGlobalSearch((prev) => ({ ...prev, typeFilter: nextFilter, page: 1, results: [], totalCount: 0, hasMore: false }));
    if (globalSearch.query.trim().length >= 2) {
      performGlobalSearch(globalSearch.query, 1, nextFilter, globalSearch.from, globalSearch.to);
    }
  }

  function handleSearchDateFilterChange(field: "from" | "to", value: string) {
    const nextFrom = field === "from" ? value : globalSearch.from;
    const nextTo = field === "to" ? value : globalSearch.to;
    setGlobalSearch((prev) => ({ ...prev, [field]: value, page: 1, results: [], totalCount: 0, hasMore: false }));
    if (globalSearch.query.trim().length >= 2) {
      performGlobalSearch(globalSearch.query, 1, globalSearch.typeFilter, nextFrom, nextTo);
    }
  }

  function handleSearchLoadMore() {
    const nextPage = globalSearch.page + 1;
    performGlobalSearch(globalSearch.query, nextPage, globalSearch.typeFilter, globalSearch.from, globalSearch.to, true);
  }

  async function fetchRecentSearchResults() {
    if (!authToken) return;
    setGlobalSearch((prev) => ({ ...prev, isLoadingRecent: true }));
    try {
      const response = await fetch("/backend-api/search/recent?limit=10", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const payload = await response.json() as { data: { results: SearchResult[] } };
        setGlobalSearch((prev) => ({ ...prev, recentResults: payload.data.results, isLoadingRecent: false }));
      } else {
        setGlobalSearch((prev) => ({ ...prev, isLoadingRecent: false }));
      }
    } catch {
      setGlobalSearch((prev) => ({ ...prev, isLoadingRecent: false }));
    }
  }

  function handleCloseSearchModal() {
    setIsSearchModalOpen(false);
  }

  function openProfileDialog() {
    setProfileFormValues(getProfileFormValues(authUser));
    setProfileErrorMessage(null);
    setProfileSuccessMessage(null);
    setIsProfileDialogOpen(true);
    fetchGoogleCalendarStatus();
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

  function openCreateTaskDialog(
    initialStatus: TaskStatus = "todo",
    overrides?: Partial<TaskFormValues>
  ) {
    setTaskDialogMode("create");
    setEditingTaskId(null);
    setTaskFormValues({
      ...getDefaultTaskFormValues(selectedDate),
      status: initialStatus,
      ...overrides,
    });
    setRecurrenceFormValues(getDefaultRecurrenceFormValues());
    setTaskFormErrorMessage(null);
    setProjectFormErrorMessage(null);
    setNewProjectDraft("");
    setDeleteErrorMessage(null);
    resetTaskDetailsState();
  }

  function handleCreateTaskFromCalendarEvent(event: CalendarEventSummary) {
    setGoogleCalendarError(null);
    setPendingCalendarEventTaskIds((current) =>
      current.includes(event.id) ? current : [...current, event.id]
    );
    openCreateTaskDialog("todo", {
      title: event.title,
      description: buildTaskDescriptionFromCalendarEvent(event, activeLocale),
      targetDate: getTaskDateFromCalendarEvent(event, selectedDate, activeTimeZone),
      dueDate: getTaskDateFromCalendarEvent(event, selectedDate, activeTimeZone),
      calendarEventId: event.id,
    });
    setPendingCalendarEventTaskIds((current) => current.filter((candidate) => candidate !== event.id));
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
    const cachedAffirmation = getCachedDayAffirmation(nextDate);
    applyDayAffirmationState(cachedAffirmation ?? null);
    setDayAffirmationErrorMessage(null);
    setDayBilan(null);
    setDayBilanFormValues(getDefaultDayBilanFormValues());
    setDayBilanErrorMessage(null);
    setDayBilanSuccessMessage(null);
    setGamingTrackActionMessage(null);
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

  function toggleDashboardBlock(blockId: DashboardBlockId) {
    setDashboardBlockCollapsed((currentState) => ({
      ...currentState,
      [blockId]: !currentState[blockId],
    }));
  }

  function handleToggleAllDashboardBlocks() {
    setDashboardBlockCollapsed((currentState) => {
      const shouldCollapseAll = DASHBOARD_BLOCK_IDS.some((blockId) => !currentState[blockId]);
      const nextState = { ...currentState };

      for (const blockId of DASHBOARD_BLOCK_IDS) {
        nextState[blockId] = shouldCollapseAll;
      }

      return nextState;
    });
  }

  function moveDashboardBlock(sourceId: DashboardBlockId, targetId: DashboardBlockId) {
    if (sourceId === targetId) {
      return;
    }

    setDashboardBlockOrder((currentOrder) => {
      const sourceIndex = currentOrder.indexOf(sourceId);
      const targetIndex = currentOrder.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) {
        return currentOrder;
      }

      const nextOrder = [...currentOrder];
      nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, sourceId);
      return nextOrder;
    });
  }

  function handleDashboardBlockDragStart(blockId: DashboardBlockId, event: ReactDragEvent<HTMLButtonElement>) {
    setDraggedDashboardBlockId(blockId);
    setDashboardDropTargetId(blockId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", blockId);
  }

  function handleDashboardBlockDragOver(blockId: DashboardBlockId, event: ReactDragEvent<HTMLElement>) {
    const sourceIdFromTransfer = event.dataTransfer.getData("text/plain");
    const sourceId =
      typeof sourceIdFromTransfer === "string" && isDashboardBlockId(sourceIdFromTransfer)
        ? sourceIdFromTransfer
        : draggedDashboardBlockId;

    if (!sourceId || sourceId === blockId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (dashboardDropTargetId !== blockId) {
      setDashboardDropTargetId(blockId);
    }
  }

  function handleDashboardBlockDrop(blockId: DashboardBlockId, event: ReactDragEvent<HTMLElement>) {
    event.preventDefault();
    const sourceIdFromTransfer = event.dataTransfer.getData("text/plain");
    const sourceId =
      typeof sourceIdFromTransfer === "string" && isDashboardBlockId(sourceIdFromTransfer)
        ? sourceIdFromTransfer
        : draggedDashboardBlockId;

    if (sourceId && sourceId !== blockId) {
      moveDashboardBlock(sourceId, blockId);
    }

    setDraggedDashboardBlockId(null);
    setDashboardDropTargetId(null);
  }

  function handleDashboardBlockDragEnd() {
    setDraggedDashboardBlockId(null);
    setDashboardDropTargetId(null);
  }

  function refreshTaskAlerts() {
    setTaskAlertsReloadKey((currentValue) => currentValue + 1);
  }

  function toggleTaskAlertsPanel() {
    setIsAssistantPanelOpen(false);
    setIsTaskAlertsPanelOpen((isOpen) => !isOpen);
  }

  async function fetchAllProjectTasks(filters = projectPlanningFilters) {
    if (!authToken) return;
    setIsLoadingAllTasks(true);
    setAllTasksErrorMessage(null);
    try {
      const tasks = await loadAllTasks(authToken, filters);
      setAllProjectTasks(tasks);
    } catch (error) {
      setAllTasksErrorMessage(
        error instanceof Error ? error.message : isFrench ? "Impossible de charger les taches." : "Unable to load tasks."
      );
    } finally {
      setIsLoadingAllTasks(false);
    }
  }

  function openProjectPlanning() {
    setIsProjectPlanningOpen(true);
    void fetchAllProjectTasks();
  }

  function closeProjectPlanning() {
    setIsProjectPlanningOpen(false);
  }

  function handleProjectPlanningFilterChange(key: keyof typeof projectPlanningFilters, value: string) {
    const nextFilters = { ...projectPlanningFilters, [key]: value };
    setProjectPlanningFilters(nextFilters);
    void fetchAllProjectTasks(nextFilters);
  }

  function handleProjectPlanningSort(column: string) {
    setProjectPlanningSort((current) => ({
      column,
      dir: current.column === column && current.dir === "asc" ? "desc" : "asc",
    }));
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

    setIsTaskAlertsPanelOpen(false);
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
        warning: reply.warning
          ? formatAssistantWarningMessage(reply.warning, activeLocale)
          : null,
      };

      setAssistantMessages((currentMessages) => [...currentMessages, assistantMessage]);
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

      refreshTaskAlerts();
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

    const nextTextCandidate = options?.text ?? dayAffirmationDraftRef.current;
    const normalizedText = nextTextCandidate.trim();
    const nextCompletion = options?.isCompleted ?? dayAffirmation?.isCompleted ?? false;

    if (normalizedText.length === 0) {
      setDayAffirmationErrorMessage(
        isFrench
          ? "Veuillez saisir votre affirmation avant d'enregistrer."
          : "Enter your affirmation before saving."
      );
      return;
    }

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

      cacheDayAffirmation(selectedDate, savedAffirmation);
      applyDayAffirmationState(savedAffirmation);
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

  function getDefaultReminderFormValues(): ReminderFormValues {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return { title: "", description: "", project: "", assignees: "", remindAt: localIso };
  }

  function openCreateReminderDialog() {
    setReminderDialogMode("create");
    setEditingReminderId(null);
    setReminderFormValues(getDefaultReminderFormValues());
    setReminderErrorMessage(null);
  }

  function openEditReminderDialog(reminder: Reminder) {
    setReminderDialogMode("edit");
    setEditingReminderId(reminder.id);
    const remindAtLocal = new Date(new Date(reminder.remindAt).getTime() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setReminderFormValues({
      title: reminder.title,
      description: reminder.description ?? "",
      project: reminder.project ?? "",
      assignees: reminder.assignees ?? "",
      remindAt: remindAtLocal,
    });
    setReminderErrorMessage(null);
    // Load attachments for this reminder if not already loaded
    if (authToken && !reminderAttachments[reminder.id]) {
      void loadReminderAttachments(reminder.id, authToken).then((attachments) => {
        setReminderAttachments((prev) => ({ ...prev, [reminder.id]: attachments }));
      }).catch(() => {
        setReminderAttachments((prev) => ({ ...prev, [reminder.id]: [] }));
      });
    }
  }

  function closeReminderDialog() {
    setReminderDialogMode(null);
    setEditingReminderId(null);
    setReminderErrorMessage(null);
    setReminderAttachmentNameDraft("");
    setReminderAttachmentFileDraft(null);
    if (reminderAttachmentFileInputRef.current) reminderAttachmentFileInputRef.current.value = "";
    setReminderAttachmentErrorMessage(null);
  }

  async function handleReminderFormSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmittingReminder || !authToken) return;

    const { title, description, project, assignees, remindAt } = reminderFormValues;
    if (!title.trim()) {
      setReminderErrorMessage(isFrench ? "Le titre est requis." : "Title is required.");
      return;
    }
    if (!remindAt) {
      setReminderErrorMessage(isFrench ? "La date et l'heure sont requises." : "Date and time are required.");
      return;
    }

    setIsSubmittingReminder(true);
    setReminderErrorMessage(null);

    try {
      const remindAtIso = new Date(remindAt).toISOString();

      if (reminderDialogMode === "edit" && editingReminderId) {
        const updated = await updateReminderApi(
          editingReminderId,
          { title: title.trim(), description: description.trim() || null, project: normalizeProjectName(project) || null, assignees: assignees.trim() || null, remindAt: remindAtIso },
          authToken
        );
        setReminders((prev) => sortRemindersByRemindAt(prev.map((r) => (r.id === updated.id ? updated : r))));
        refreshTaskAlerts();
      } else {
        const created = await createReminderApi(
          { title: title.trim(), description: description.trim() || null, project: normalizeProjectName(project) || null, assignees: assignees.trim() || null, remindAt: remindAtIso },
          authToken
        );
        setReminders((prev) => sortRemindersByRemindAt([...prev, created]));
        refreshTaskAlerts();
        openEditReminderDialog(created);
        return;
      }
      closeReminderDialog();
    } catch (error) {
      setReminderErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible d'enregistrer le rappel."
          : "Unable to save reminder."
      );
    } finally {
      setIsSubmittingReminder(false);
    }
  }

  async function handleCompleteReminder(id: string) {
    if (!authToken) return;
    try {
      const completed = await completeReminderApi(id, authToken);
      setReminders((prev) => prev.filter((r) => r.id !== completed.id));
      setAlertReminders((prev) => prev.filter((r) => r.id !== completed.id));
      setPendingReminders((prev) => prev.filter((r) => r.id !== completed.id));
      if (editingReminderId === completed.id) {
        closeReminderDialog();
      }
      refreshTaskAlerts();
    } catch {
      // silent
    }
  }

  async function handleCancelReminder(id: string) {
    if (!authToken) return;
    try {
      const cancelled = await cancelReminderApi(id, authToken);
      setReminders((prev) => prev.filter((r) => r.id !== cancelled.id));
      setAlertReminders((prev) => prev.filter((r) => r.id !== cancelled.id));
      setPendingReminders((prev) => prev.filter((r) => r.id !== cancelled.id));
      if (editingReminderId === cancelled.id) {
        closeReminderDialog();
      }
      refreshTaskAlerts();
    } catch {
      // silent
    }
  }

  function openCreateNoteDialog(options?: {
    calendarEventId?: string | null;
    targetDate?: string | null;
    title?: string | null;
  }) {
    setNoteDialogMode("create");
    setEditingNoteId(null);
    setNoteFormValues({
      title: options?.title ?? "",
      body: "",
      color: "",
      targetDate: options?.targetDate ?? "",
      calendarEventId: options?.calendarEventId ?? "",
    });
    setNoteErrorMessage(null);
    setNoteAttachmentErrorMessage(null);
    setNoteAttachmentNameDraft("");
    setNoteAttachmentFileDraft(null);
    if (noteAttachmentFileInputRef.current) {
      noteAttachmentFileInputRef.current.value = "";
    }
  }

  function openEditNoteDialog(note: Note) {
    setNoteDialogMode("edit");
    setEditingNoteId(note.id);
    setNoteFormValues({
      title: note.title ?? "",
      body: note.body,
      color: note.color ?? "",
      targetDate: note.targetDate ?? "",
      calendarEventId: note.calendarEventId ?? "",
    });
    setNoteErrorMessage(null);
    setNoteAttachmentErrorMessage(null);
    setNoteAttachmentNameDraft("");
    setNoteAttachmentFileDraft(null);
    if (noteAttachmentFileInputRef.current) {
      noteAttachmentFileInputRef.current.value = "";
    }

    // Load attachments for this note if not already loaded
    if (authToken && !noteAttachments[note.id]) {
      void loadNoteAttachments(note.id, authToken).then((attachments) => {
        setNoteAttachments((prev) => ({ ...prev, [note.id]: attachments }));
      }).catch(() => {
        setNoteAttachments((prev) => ({ ...prev, [note.id]: [] }));
      });
    }
  }

  function closeNoteDialog() {
    setNoteDialogMode(null);
    setEditingNoteId(null);
    setNoteErrorMessage(null);
    setNoteAttachmentErrorMessage(null);
    setNoteAttachmentNameDraft("");
    setNoteAttachmentFileDraft(null);
    if (noteAttachmentFileInputRef.current) {
      noteAttachmentFileInputRef.current.value = "";
    }
  }

  function syncCalendarEventsForNoteChange(
    nextNote: Note | null,
    previousCalendarEventId?: string | null
  ) {
    setCalendarEvents((currentEvents) =>
      currentEvents.map((event) => {
        if (previousCalendarEventId && event.id === previousCalendarEventId) {
          if (!nextNote || nextNote.calendarEventId !== previousCalendarEventId) {
            return { ...event, note: null };
          }
        }

        if (nextNote?.calendarEventId && event.id === nextNote.calendarEventId) {
          return { ...event, note: toCalendarEventLinkedNote(nextNote) };
        }

        return event;
      })
    );
  }

  function openCreateNoteDialogForCalendarEvent(event: CalendarEventSummary) {
    const targetDate =
      event.startDate ??
      event.startTime.substring(0, 10);

    openCreateNoteDialog({
      calendarEventId: event.id,
      targetDate,
      title: event.title,
    });
  }

  async function handleSubmitNote() {
    if (!authToken) return;
    if (isRichTextEmpty(noteFormValues.body)) {
      setNoteErrorMessage(isFrench ? "Le contenu de la note est requis." : "Note body is required.");
      return;
    }

    setIsSubmittingNote(true);
    setNoteErrorMessage(null);

    const payload = {
      title: noteFormValues.title.trim() || null,
      body: noteFormValues.body,
      color: noteFormValues.color.trim() || null,
      targetDate: noteFormValues.targetDate.trim() || null,
      calendarEventId: noteFormValues.calendarEventId.trim() || null,
    };

    try {
      if (noteDialogMode === "edit" && editingNoteId) {
        const previousNote = notes.find((note) => note.id === editingNoteId) ?? null;
        const updated = await updateNoteApi(editingNoteId, payload, authToken);
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        syncCalendarEventsForNoteChange(updated, previousNote?.calendarEventId ?? null);
      } else {
        const created = await createNoteApi(payload, authToken);
        setNotes((prev) => [created, ...prev]);
        syncCalendarEventsForNoteChange(created);
        openEditNoteDialog(created);
        return;
      }
      closeNoteDialog();
    } catch (error) {
      setNoteErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible d'enregistrer la note."
          : "Unable to save note."
      );
    } finally {
      setIsSubmittingNote(false);
    }
  }

  async function handleDeleteNote(id: string) {
    if (!authToken) return;
    try {
      const noteToDelete = notes.find((note) => note.id === id) ?? null;
      await deleteNoteApi(id, authToken);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      syncCalendarEventsForNoteChange(null, noteToDelete?.calendarEventId ?? null);
      if (expandedNoteId === id) setExpandedNoteId(null);
    } catch {
      // silent
    }
  }

  async function handleExpandNote(noteId: string) {
    if (expandedNoteId === noteId) {
      setExpandedNoteId(null);
      return;
    }
    setExpandedNoteId(noteId);
    if (!authToken || noteAttachments[noteId]) return;
    try {
      const attachments = await loadNoteAttachments(noteId, authToken);
      setNoteAttachments((prev) => ({ ...prev, [noteId]: attachments }));
    } catch {
      setNoteAttachments((prev) => ({ ...prev, [noteId]: [] }));
    }
  }

  async function handleCreateNoteAttachment(noteId: string) {
    if (!authToken || isCreatingNoteAttachment) return;
    const file = noteAttachmentFileDraft;
    const name = noteAttachmentNameDraft.trim() || file?.name?.trim() || "";

    if (!name) {
      setNoteAttachmentErrorMessage(isFrench ? "Le nom de la piece jointe est requis." : "Attachment name is required.");
      return;
    }
    if (!file) {
      setNoteAttachmentErrorMessage(isFrench ? "Selectionnez un fichier a televerser." : "Select a file to upload.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_UPLOAD_BYTES) {
      setNoteAttachmentErrorMessage(
        isFrench
          ? `La piece jointe depasse la limite de ${formatFileSize(MAX_ATTACHMENT_UPLOAD_BYTES)}.`
          : `Attachment exceeds ${formatFileSize(MAX_ATTACHMENT_UPLOAD_BYTES)} limit.`
      );
      return;
    }

    setNoteAttachmentErrorMessage(null);
    setIsCreatingNoteAttachment(true);
    try {
      const attachment = await createNoteAttachmentApi(noteId, { name, file }, authToken);
      setNoteAttachments((prev) => ({
        ...prev,
        [noteId]: [...(prev[noteId] ?? []), attachment],
      }));
      setNoteAttachmentNameDraft("");
      setNoteAttachmentFileDraft(null);
      if (noteAttachmentFileInputRef.current) noteAttachmentFileInputRef.current.value = "";
    } catch (error) {
      setNoteAttachmentErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench ? "Impossible de creer la piece jointe." : "Unable to create attachment."
      );
    } finally {
      setIsCreatingNoteAttachment(false);
    }
  }

  async function handleDeleteNoteAttachment(noteId: string, attachmentId: string) {
    if (!authToken) return;
    setPendingNoteAttachmentIds((prev) => [...prev, attachmentId]);
    try {
      await deleteNoteAttachmentApi(noteId, attachmentId, authToken);
      setNoteAttachments((prev) => ({
        ...prev,
        [noteId]: (prev[noteId] ?? []).filter((a) => a.id !== attachmentId),
      }));
    } catch {
      // silent
    } finally {
      setPendingNoteAttachmentIds((prev) => prev.filter((id) => id !== attachmentId));
    }
  }

  async function handleCreateReminderAttachment(reminderId: string) {
    if (!authToken || isCreatingReminderAttachment) return;
    const file = reminderAttachmentFileDraft;
    const name = reminderAttachmentNameDraft.trim() || file?.name?.trim() || "";

    if (!name) {
      setReminderAttachmentErrorMessage(isFrench ? "Le nom de la piece jointe est requis." : "Attachment name is required.");
      return;
    }
    if (!file) {
      setReminderAttachmentErrorMessage(isFrench ? "Selectionnez un fichier a televerser." : "Select a file to upload.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_UPLOAD_BYTES) {
      setReminderAttachmentErrorMessage(
        isFrench
          ? `La piece jointe depasse la limite de ${formatFileSize(MAX_ATTACHMENT_UPLOAD_BYTES)}.`
          : `Attachment exceeds ${formatFileSize(MAX_ATTACHMENT_UPLOAD_BYTES)} limit.`
      );
      return;
    }

    setReminderAttachmentErrorMessage(null);
    setIsCreatingReminderAttachment(true);
    try {
      const attachment = await createReminderAttachmentApi(reminderId, { name, file }, authToken);
      setReminderAttachments((prev) => ({
        ...prev,
        [reminderId]: [...(prev[reminderId] ?? []), attachment],
      }));
      setReminderAttachmentNameDraft("");
      setReminderAttachmentFileDraft(null);
      if (reminderAttachmentFileInputRef.current) reminderAttachmentFileInputRef.current.value = "";
    } catch (error) {
      setReminderAttachmentErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench ? "Impossible de creer la piece jointe." : "Unable to create attachment."
      );
    } finally {
      setIsCreatingReminderAttachment(false);
    }
  }

  async function handleDeleteReminderAttachment(reminderId: string, attachmentId: string) {
    if (!authToken) return;
    setPendingReminderAttachmentIds((prev) => [...prev, attachmentId]);
    try {
      await deleteReminderAttachmentApi(reminderId, attachmentId, authToken);
      setReminderAttachments((prev) => ({
        ...prev,
        [reminderId]: (prev[reminderId] ?? []).filter((a) => a.id !== attachmentId),
      }));
    } catch {
      // silent
    } finally {
      setPendingReminderAttachmentIds((prev) => prev.filter((id) => id !== attachmentId));
    }
  }

  async function refreshGamingTrackSummary() {
    if (!authToken) {
      return;
    }

    const summary = await loadGamingTrackSummary(selectedDate, gamingTrackPeriod, authToken);
    setGamingTrackSummary(summary);
  }

  async function handleClaimGamingTrackChallenge() {
    if (isGamingTrackActionPending || isGamingTrackLoading) {
      return;
    }

    if (!authToken) {
      setGamingTrackErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    setIsGamingTrackActionPending(true);
    setGamingTrackActionMessage(null);
    setGamingTrackErrorMessage(null);

    try {
      const result = await claimGamingTrackChallenge(selectedDate, authToken);
      await refreshGamingTrackSummary();
      setGamingTrackActionMessage(
        result.alreadyClaimed
          ? isFrench
            ? "Recompense deja reclamee."
            : "Reward already claimed."
          : isFrench
          ? `Recompense challenge reclamee (+${result.rewardXp} XP).`
          : `Challenge reward claimed (+${result.rewardXp} XP).`
      );
    } catch (error) {
      setGamingTrackErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de reclamer la recompense."
          : "Unable to claim challenge reward."
      );
    } finally {
      setIsGamingTrackActionPending(false);
    }
  }

  async function handleUseGamingTrackStreakProtection() {
    if (isGamingTrackActionPending || isGamingTrackLoading) {
      return;
    }

    if (!authToken) {
      setGamingTrackErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    setIsGamingTrackActionPending(true);
    setGamingTrackActionMessage(null);
    setGamingTrackErrorMessage(null);

    try {
      const result = await activateGamingTrackStreakProtection(selectedDate, authToken);
      await refreshGamingTrackSummary();
      setGamingTrackActionMessage(
        result.alreadyUsed
          ? isFrench
            ? "Protection deja utilisee aujourd'hui."
            : "Protection already used today."
          : isFrench
          ? `Protection utilisee. Charges restantes: ${result.remainingCharges}.`
          : `Protection used. Remaining charges: ${result.remainingCharges}.`
      );
    } catch (error) {
      setGamingTrackErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible d'utiliser la protection de serie."
          : "Unable to use streak protection."
      );
    } finally {
      setIsGamingTrackActionPending(false);
    }
  }

  async function handleDismissGamingTrackNudge(
    nudgeId: GamingTrackSummary["engagement"]["nudges"][number]["id"]
  ) {
    if (isGamingTrackActionPending || isGamingTrackLoading) {
      return;
    }

    if (!authToken) {
      setGamingTrackErrorMessage(isFrench ? "Authentification requise." : "Authentication is required.");
      return;
    }

    setIsGamingTrackActionPending(true);
    setGamingTrackActionMessage(null);
    setGamingTrackErrorMessage(null);

    try {
      const result = await dismissGamingTrackNudge(selectedDate, nudgeId, authToken);
      await refreshGamingTrackSummary();
      setGamingTrackActionMessage(
        result.alreadyDismissed
          ? isFrench
            ? "Nudge deja masque."
            : "Nudge already dismissed."
          : isFrench
          ? "Nudge masque."
          : "Nudge dismissed."
      );
    } catch (error) {
      setGamingTrackErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de masquer ce nudge."
          : "Unable to dismiss this nudge."
      );
    } finally {
      setIsGamingTrackActionPending(false);
    }
  }

  function updateTaskFormField(field: keyof TaskFormValues, value: string | null) {
    setTaskFormValues((current) => {
      if (field === "targetDate") {
        return {
          ...current,
          targetDate: value ?? current.targetDate,
          dueDate: current.dueDate === current.targetDate ? value ?? current.targetDate : current.dueDate,
        };
      }

      return {
        ...current,
        [field]: value,
      };
    });

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

      refreshTaskAlerts();
      await fetchCalendarEvents(selectedDate, true);

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

      if (taskDialogMode === "create") {
        setTaskDialogMode("edit");
        setEditingTaskId(savedTask.id);
        setTaskFormValues(getTaskFormValues(savedTask));
        setTaskFormErrorMessage(null);
        resetTaskDetailsState();
      } else {
        setTaskDialogMode(null);
        setEditingTaskId(null);
        setTaskFormErrorMessage(null);
        resetTaskDetailsState();
      }
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
      refreshTaskAlerts();
      await fetchCalendarEvents(selectedDate, true);
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

  // Handle Google Calendar OAuth callback redirect + auto-fetch status
  useEffect(() => {
    if (!isAuthReady || !authToken) return;

    const params = new URLSearchParams(window.location.search);
    const gcalResult = params.get("google-calendar");
    if (gcalResult) {
      params.delete("google-calendar");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      if (gcalResult === "connected") {
        // Fetch status then auto-sync to pull events from Google
        fetchGoogleCalendarStatus().then(() => {
          handleSyncGoogleCalendar();
        });
      } else if (gcalResult === "error") {
        setGoogleCalendarError(
          isFrench
            ? "La connexion Google Calendar a echoue. Veuillez reessayer."
            : "Google Calendar connection failed. Please try again."
        );
      }
    } else {
      // Always fetch status when auth is ready
      fetchGoogleCalendarStatus();
    }
  }, [isAuthReady, authToken]);

  useEffect(() => {
    if (!pendingOpenTaskId) return;
    const task = tasks.find((t) => t.id === pendingOpenTaskId);
    if (task) {
      openEditTaskDialog(task);
      setPendingOpenTaskId(null);
    }
  }, [tasks, pendingOpenTaskId]);

  useEffect(() => {
    if (!pendingOpenReminderId) return;
    const reminder = reminders.find((entry) => entry.id === pendingOpenReminderId);
    if (reminder) {
      openEditReminderDialog(reminder);
      setPendingOpenReminderId(null);
    }
  }, [pendingOpenReminderId, reminders]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
      if (event.key === "Escape" && isSearchModalOpen) {
        setIsSearchModalOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSearchModalOpen]);

  useEffect(() => {
    if (isSearchModalOpen) {
      fetchRecentSearchResults();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchModalOpen]);

  useEffect(() => {
    document.documentElement.lang = activeLocale;
  }, [activeLocale]);

  useEffect(() => {
    window.localStorage.setItem(
      DASHBOARD_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        order: dashboardBlockOrder,
        collapsed: dashboardBlockCollapsed,
      })
    );
  }, [dashboardBlockCollapsed, dashboardBlockOrder]);

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

  // Fetch calendar events for the selected date
  useEffect(() => {
    if (!isAuthReady || !authToken || !authUser) {
      setCalendarEvents([]);
      return;
    }
    fetchCalendarEvents(selectedDate);
  }, [authToken, authUser, isAuthReady, selectedDate, googleCalendarConnections.length]);

  // Fetch reminders for the selected date
  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!authToken || !authUser) {
      setReminders([]);
      setIsLoadingReminders(false);
      return;
    }

    setIsLoadingReminders(true);
    const controller = new AbortController();

    loadReminders(selectedDate, authToken, controller.signal)
      .then((nextReminders) => {
        if (!controller.signal.aborted) {
          setReminders(nextReminders);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setReminders([]);
          setReminderErrorMessage(
            error instanceof Error
              ? error.message
              : isFrench
              ? "Impossible de charger les rappels."
              : "Unable to load reminders."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingReminders(false);
        }
      });

    return () => controller.abort();
  }, [authToken, authUser, isAuthReady, isFrench, selectedDate]);

  // Fetch notes
  useEffect(() => {
    if (!isAuthReady) return;
    if (!authToken || !authUser) {
      setNotes([]);
      setIsLoadingNotes(false);
      return;
    }

    setIsLoadingNotes(true);
    const controller = new AbortController();

    loadNotes(authToken, controller.signal)
      .then((nextNotes) => {
        if (!controller.signal.aborted) setNotes(nextNotes);
      })
      .catch(() => {
        if (!controller.signal.aborted) setNotes([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingNotes(false);
      });

    return () => controller.abort();
  }, [authToken, authUser, isAuthReady]);

  // Poll for pending reminders every 30s
  useEffect(() => {
    if (!isAuthReady || !authToken || !authUser) {
      setPendingReminders([]);
      return;
    }

    let active = true;

    const poll = () => {
      loadPendingReminders(authToken)
        .then((pending) => {
          if (active) {
            setReminders((prev) => {
              if (pending.length === 0) {
                return prev;
              }

              const byId = new Map(pending.map((reminder) => [reminder.id, reminder]));
              return sortRemindersByRemindAt(
                prev.map((reminder) => byId.get(reminder.id) ?? reminder)
              );
            });
            setPendingReminders((prev) => {
              const existingIds = new Set(prev.map((r) => r.id));
              const newOnes = pending.filter((r) => !existingIds.has(r.id));
              return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
            });
            setAlertReminders((prev) => {
              if (pending.length === 0) {
                return prev;
              }

              const mergedById = new Map(prev.map((reminder) => [reminder.id, reminder]));
              for (const reminder of pending) {
                mergedById.set(reminder.id, reminder);
              }

              return sortRemindersByRemindAt([...mergedById.values()]);
            });
          }
        })
        .catch(() => {
          // silent fail for polling
        });
    };

    poll();
    const intervalId = setInterval(poll, 30000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [authToken, authUser, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!authToken || !authUser) {
      setTaskAlertsSummary(null);
      setAlertReminders([]);
      setTaskAlertsErrorMessage(null);
      setIsTaskAlertsLoading(false);
      setIsTaskAlertsPanelOpen(false);
      return;
    }

    setIsTaskAlertsLoading(true);
    setTaskAlertsErrorMessage(null);
    const controller = new AbortController();

    Promise.all([
      loadTaskAlerts(taskAlertsAnchorDate, authToken, controller.signal),
      loadReminders(alertRemindersHorizonDate, authToken, controller.signal),
    ])
      .then(([nextTaskAlerts, nextAlertReminders]) => {
        if (controller.signal.aborted) {
          return;
        }

        setTaskAlertsSummary(nextTaskAlerts);
        setAlertReminders(sortRemindersByRemindAt(nextAlertReminders));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setTaskAlertsSummary(null);
        setAlertReminders([]);
        setTaskAlertsErrorMessage(
          error instanceof Error
            ? error.message
            : isFrench
            ? "Impossible de charger les alertes."
            : "Unable to load alerts."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsTaskAlertsLoading(false);
        }
      });

    return () => controller.abort();
  }, [alertRemindersHorizonDate, authToken, authUser, isAuthReady, isFrench, taskAlertsAnchorDate, taskAlertsReloadKey]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!authToken || !authUser) {
      setGamingTrackSummary(null);
      setGamingTrackErrorMessage(null);
      setIsGamingTrackLoading(false);
      setIsGamingTrackActionPending(false);
      setGamingTrackActionMessage(null);
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
      dayAffirmationCacheRef.current = {};
      applyDayAffirmationState(null);
      setIsDayAffirmationLoading(false);
      return;
    }

    const cachedAffirmation = getCachedDayAffirmation(selectedDate);
    if (cachedAffirmation !== undefined) {
      applyDayAffirmationState(cachedAffirmation);
    } else {
      applyDayAffirmationState(null);
    }

    setIsDayAffirmationLoading(true);
    setDayAffirmationErrorMessage(null);
    const controller = new AbortController();

    loadDayAffirmation(selectedDate, authToken, controller.signal)
      .then((nextAffirmation) => {
        if (controller.signal.aborted) {
          return;
        }

        const latestCachedAffirmation = getCachedDayAffirmation(selectedDate);

        if (!shouldApplyFetchedDayAffirmation(nextAffirmation, latestCachedAffirmation)) {
          return;
        }

        cacheDayAffirmation(selectedDate, nextAffirmation);
        applyDayAffirmationState(nextAffirmation);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (getCachedDayAffirmation(selectedDate) === undefined) {
          cacheDayAffirmation(selectedDate, null);
          applyDayAffirmationState(null);
        }

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
  }, [applyDayAffirmationState, authToken, authUser, isAuthReady, isFrench, selectedDate]);

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

  const taskFilterProjectOptions = useMemo(() => {
    return getUniqueSortedProjectNames([
      ...projectOptions,
      ...tasks.map((task) => task.project ?? ""),
      taskFilterValues.project,
    ]);
  }, [projectOptions, taskFilterValues.project, tasks]);

  const tasksByStatus = useMemo(() => {
    return {
      todo: tasks.filter((task) => task.status === "todo"),
      in_progress: tasks.filter((task) => task.status === "in_progress"),
      done: tasks.filter((task) => task.status === "done"),
      cancelled: tasks.filter((task) => task.status === "cancelled"),
    };
  }, [tasks]);
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (taskFilterValues.status !== "all" && task.status !== taskFilterValues.status) {
        return false;
      }

      if (taskFilterValues.priority !== "all" && task.priority !== taskFilterValues.priority) {
        return false;
      }

      if (taskFilterValues.project && normalizeProjectName(task.project ?? "") !== taskFilterValues.project) {
        return false;
      }

      if (!taskSearchQuery) {
        return true;
      }

      return getTaskSearchableText(task, activeLocale).includes(taskSearchQuery);
    });
  }, [activeLocale, taskFilterValues.priority, taskFilterValues.project, taskFilterValues.status, taskSearchQuery, tasks]);
  const filteredTasksByStatus = useMemo(() => {
    return {
      todo: filteredTasks.filter((task) => task.status === "todo"),
      in_progress: filteredTasks.filter((task) => task.status === "in_progress"),
      done: filteredTasks.filter((task) => task.status === "done"),
      cancelled: filteredTasks.filter((task) => task.status === "cancelled"),
    };
  }, [filteredTasks]);
  const hasActiveTaskFilters =
    taskFilterValues.query.trim().length > 0 ||
    taskFilterValues.status !== "all" ||
    taskFilterValues.priority !== "all" ||
    taskFilterValues.project.length > 0;

  const isEmptyBoard = !isLoading && !errorMessage && tasks.length === 0;
  const isFilteredBoardEmpty = !isLoading && !errorMessage && tasks.length > 0 && filteredTasks.length === 0;
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
  const noteDialogTitle = noteDialogMode === "create"
    ? isFrench
      ? "Nouvelle note"
      : "New note"
    : isFrench
      ? "Modifier la note"
      : "Edit note";
  const noteDialogSubmitLabel =
    noteDialogMode === "create"
      ? isSubmittingNote
        ? isFrench
          ? "Creation..."
          : "Creating..."
        : isFrench
          ? "Creer la note"
          : "Create note"
      : isSubmittingNote
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
      refreshTaskAlerts();
      await fetchCalendarEvents(selectedDate, true);
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-muted">
            {isFrench ? "Initialisation..." : "Initializing..."}
          </p>
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
        infoMessage={authInfoMessage}
        onModeChange={handleAuthModeChange}
        onValueChange={handleAuthFormFieldChange}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  function navigateToSearchDate(targetDate: string | null | undefined) {
    if (!targetDate) {
      return;
    }
    handleDateChange(targetDate);
  }

  function handleSearchResultClick(result: SearchResult) {
    const meta = result.metadataJson as Record<string, unknown> | null;

    switch (result.sourceType) {
      case "task": {
        const targetDate = meta?.targetDate as string | undefined;
        navigateToSearchDate(targetDate);
        setPendingOpenTaskId(result.sourceId);
        setTimeout(() => document.getElementById("board")?.scrollIntoView({ behavior: "smooth" }), 100);
        break;
      }
      case "comment":
      case "attachment": {
        const targetDate = meta?.targetDate as string | undefined;
        const taskId = meta?.taskId as string | undefined;
        navigateToSearchDate(targetDate);
        if (taskId) setPendingOpenTaskId(taskId);
        setTimeout(() => document.getElementById("board")?.scrollIntoView({ behavior: "smooth" }), 100);
        break;
      }
      case "affirmation": {
        const targetDate = meta?.targetDate as string | undefined;
        navigateToSearchDate(targetDate);
        setTimeout(() => document.getElementById("affirmation")?.scrollIntoView({ behavior: "smooth" }), 300);
        break;
      }
      case "bilan": {
        const targetDate = meta?.targetDate as string | undefined;
        navigateToSearchDate(targetDate);
        setTimeout(() => document.getElementById("bilan")?.scrollIntoView({ behavior: "smooth" }), 300);
        break;
      }
      case "reminder": {
        const remindAt = meta?.remindAt as string | undefined;
        navigateToSearchDate(remindAt?.slice(0, 10));
        setPendingOpenReminderId(result.sourceId);
        setTimeout(() => document.getElementById("reminders")?.scrollIntoView({ behavior: "smooth" }), 100);
        break;
      }
      case "calendarEvent": {
        const startTime = meta?.startTime as string | undefined;
        navigateToSearchDate(startTime?.slice(0, 10));
        setExpandedCalendarEventId(result.sourceId);
        setTimeout(() => document.getElementById("board")?.scrollIntoView({ behavior: "smooth" }), 300);
        break;
      }
      case "calendarNote": {
        const calendarEventId = meta?.calendarEventId as string | undefined;
        const startTime = meta?.startTime as string | undefined;
        navigateToSearchDate(startTime?.slice(0, 10));
        if (calendarEventId) {
          setExpandedCalendarEventId(calendarEventId);
        }
        setTimeout(() => document.getElementById("board")?.scrollIntoView({ behavior: "smooth" }), 300);
        break;
      }
      case "note": {
        const targetDate = meta?.targetDate as string | undefined;
        navigateToSearchDate(targetDate);
        setExpandedNoteId(result.sourceId);
        setTimeout(() => document.getElementById("notes")?.scrollIntoView({ behavior: "smooth" }), 300);
        break;
      }
      case "noteAttachment": {
        const targetDate = meta?.targetDate as string | undefined;
        const noteId = meta?.noteId as string | undefined;
        navigateToSearchDate(targetDate);
        if (noteId) setExpandedNoteId(noteId);
        setTimeout(() => document.getElementById("notes")?.scrollIntoView({ behavior: "smooth" }), 300);
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {isSearchModalOpen ? (
        <GlobalSearchModal
          locale={activeLocale}
          state={globalSearch}
          onQueryChange={handleSearchQueryChange}
          onTypeFilterChange={handleSearchTypeFilterChange}
          onDateFilterChange={handleSearchDateFilterChange}
          onLoadMore={handleSearchLoadMore}
          onClose={handleCloseSearchModal}
          onResultClick={handleSearchResultClick}
        />
      ) : null}
      <AppNavbar
        locale={activeLocale}
        user={authUser}
        onLogout={handleLogout}
        onOpenProfile={openProfileDialog}
        alertsSummary={alertsSummary}
        isTaskAlertsPanelOpen={isTaskAlertsPanelOpen}
        onOpenTaskAlerts={toggleTaskAlertsPanel}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        isBusy={isMutationPending || isLoading}
        isProjectPlanningOpen={isProjectPlanningOpen}
        onOpenProjectPlanning={openProjectPlanning}
      />

    {isProjectPlanningOpen ? (
      <ProjectPlanningView
        locale={activeLocale}
        tasks={allProjectTasks}
        isLoading={isLoadingAllTasks}
        errorMessage={allTasksErrorMessage}
        filters={projectPlanningFilters}
        sort={projectPlanningSort}
        viewMode={projectPlanningViewMode}
        projectOptions={projectOptions}
        onFilterChange={handleProjectPlanningFilterChange}
        onSortChange={handleProjectPlanningSort}
        onViewModeChange={setProjectPlanningViewMode}
        onClose={closeProjectPlanning}
        onEditTask={(task) => {
          closeProjectPlanning();
          handleDateChange(task.targetDate);
          setTimeout(() => openEditTaskDialog(task), 100);
        }}
      />
    ) : null}

    <div className="flex min-h-screen flex-col gap-6 px-4 py-6 sm:px-8 lg:ml-[260px] lg:px-10 lg:py-8">
      <div className="flex items-center justify-between">
        <div />
        <button
          type="button"
          className={controlIconButtonClass}
          onClick={handleToggleAllDashboardBlocks}
          aria-label={collapseAllBlocksButtonLabel}
          title={collapseAllBlocksButtonLabel}
        >
          <LayoutToggleIcon collapsed={isAllDashboardBlocksCollapsed} />
        </button>
      </div>

      <header
        id="overview"
        className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getDashboardDropClassName("overview")}`}
        style={{ order: getDashboardBlockVisualOrder("overview") }}
        onDragOver={(event) => handleDashboardBlockDragOver("overview", event)}
        onDrop={(event) => handleDashboardBlockDrop("overview", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{getDateHeading(selectedDate, activeLocale)}</h1>
            <p className="mt-0.5 text-sm text-muted">{APP_TAGLINE}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={dashboardIconButtonClass}
              draggable
              onDragStart={(event) => handleDashboardBlockDragStart("overview", event)}
              onDragEnd={handleDashboardBlockDragEnd}
              aria-label={getDashboardDragHandleLabel("overview")}
              title={getDashboardDragHandleLabel("overview")}
            >
              <DragHandleIcon />
            </button>
            <button
              type="button"
              className={dashboardIconButtonClass}
              onClick={() => toggleDashboardBlock("overview")}
              aria-expanded={!dashboardBlockCollapsed.overview}
              aria-label={getCollapseToggleAriaLabel("overview", dashboardBlockCollapsed.overview)}
              title={getCollapseToggleAriaLabel("overview", dashboardBlockCollapsed.overview)}
            >
              <CollapseChevronIcon isCollapsed={dashboardBlockCollapsed.overview} />
            </button>
          </div>
        </div>

        {dashboardBlockCollapsed.overview ? (
          <p className="mt-3 text-xs text-muted">{collapsedHintLabel}</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-500">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="14" height="11" rx="2"/><path d="M7 3v4M13 3v4M3 9h14" strokeLinecap="round"/></svg>
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{tasks.length}</p>
                <p className="text-xs text-muted">{isFrench ? "Total taches" : "Total Tasks"}</p>
              </div>
            </div>
            <div className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-500">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 3v14M5 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{actionableTaskCount}</p>
                <p className="text-xs text-muted">{isFrench ? "Actionnables" : "Actionable"}</p>
              </div>
            </div>
            <div className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-500">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="7"/><path d="M10 6v4.5l2.8 1.7" strokeLinecap="round"/></svg>
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{formatPlannedTime(totalPlannedMinutes)}</p>
                <p className="text-xs text-muted">{isFrench ? "Temps planifie" : "Planned Time"}</p>
              </div>
            </div>
          </div>
        )}
      </header>

      <section
        id="gaming"
        className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getDashboardDropClassName("gamingTrack")}`}
        style={{ order: getDashboardBlockVisualOrder("gamingTrack"), animationDelay: "0.05s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("gamingTrack", event)}
        onDrop={(event) => handleDashboardBlockDrop("gamingTrack", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className={sectionHeaderClass}>Gaming Track</h2>
            <p className="text-sm text-muted">
              {gamingTrackRangeLabel
                ? `${gamingTrackPeriodLabel} · ${gamingTrackRangeLabel}`
                : isFrench
                ? "Suivi periodique de vos resultats."
                : "Periodized tracking of your results."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!dashboardBlockCollapsed.gamingTrack ? (
              <div className="inline-flex items-center gap-0.5 rounded-lg bg-surface-soft p-1">
                {gamingTrackPeriodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      gamingTrackPeriod === option.value ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
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
            ) : null}
            <button
              type="button"
              className={dashboardIconButtonClass}
              draggable
              onDragStart={(event) => handleDashboardBlockDragStart("gamingTrack", event)}
              onDragEnd={handleDashboardBlockDragEnd}
              aria-label={getDashboardDragHandleLabel("gamingTrack")}
              title={getDashboardDragHandleLabel("gamingTrack")}
            >
              <DragHandleIcon />
            </button>
            <button
              type="button"
              className={dashboardIconButtonClass}
              onClick={() => toggleDashboardBlock("gamingTrack")}
              aria-expanded={!dashboardBlockCollapsed.gamingTrack}
              aria-label={getCollapseToggleAriaLabel("gamingTrack", dashboardBlockCollapsed.gamingTrack)}
              title={getCollapseToggleAriaLabel("gamingTrack", dashboardBlockCollapsed.gamingTrack)}
            >
              <CollapseChevronIcon isCollapsed={dashboardBlockCollapsed.gamingTrack} />
            </button>
          </div>
        </div>

        {dashboardBlockCollapsed.gamingTrack ? <p className="mt-3 text-xs text-muted">{collapsedHintLabel}</p> : null}

        {!dashboardBlockCollapsed.gamingTrack && isGamingTrackLoading ? (
          <p className="mt-4 rounded-xl border border-line bg-surface-soft px-3 py-2 text-sm text-muted">
            {isFrench ? "Chargement du gaming track..." : "Loading gaming track..."}
          </p>
        ) : null}

        {!dashboardBlockCollapsed.gamingTrack && gamingTrackSummary ? (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="flex items-center gap-5 rounded-xl bg-accent-soft/40 px-5 py-5">
                <div className="relative h-20 w-20 shrink-0">
                  <svg viewBox="0 0 36 36" className="score-ring h-20 w-20">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-line" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={`${gamingTrackSummary.scores.overall * 0.974} 97.4`} strokeLinecap="round" className="text-accent transition-all duration-700" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
                    {gamingTrackSummary.scores.overall}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{isFrench ? "Score global" : "Overall Score"}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {isFrench ? "Tendance" : "Trend"} {formatSignedDelta(gamingTrackOverallDelta)} pts
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line p-3">
                  <p className="text-[11px] font-medium text-muted">{isFrench ? "Execution" : "Execution"}</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{gamingTrackSummary.scores.execution}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-surface-soft"><div className="progress-gradient h-full rounded-full transition-all duration-500" style={{ width: `${gamingTrackSummary.scores.execution}%` }} /></div>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <p className="text-[11px] font-medium text-muted">{isFrench ? "Reflection" : "Reflection"}</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{gamingTrackSummary.scores.reflection}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-surface-soft"><div className="progress-gradient h-full rounded-full transition-all duration-500" style={{ width: `${gamingTrackSummary.scores.reflection}%` }} /></div>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <p className="text-[11px] font-medium text-muted">{isFrench ? "Consistance" : "Consistency"}</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{gamingTrackSummary.scores.consistency}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-surface-soft"><div className="progress-gradient h-full rounded-full transition-all duration-500" style={{ width: `${gamingTrackSummary.scores.consistency}%` }} /></div>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <p className="text-[11px] font-medium text-muted">{isFrench ? "Momentum" : "Momentum"}</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{gamingTrackSummary.scores.momentum}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-surface-soft"><div className="progress-gradient h-full rounded-full transition-all duration-500" style={{ width: `${gamingTrackSummary.scores.momentum}%` }} /></div>
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
                    {isFrench ? "Total utilisees" : "Used total"}: {gamingTrackSummary.streakProtection.usedCharges}
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
                  <button
                    type="button"
                    className={`${controlButtonClass} mt-2 w-full`}
                    onClick={handleUseGamingTrackStreakProtection}
                    disabled={
                      isGamingTrackActionPending ||
                      isGamingTrackLoading ||
                      !gamingTrackSummary.streakProtection.atRisk ||
                      gamingTrackSummary.streakProtection.availableCharges <= 0
                    }
                  >
                    <ShieldIcon />
                    {isGamingTrackActionPending
                      ? isFrench
                        ? "Traitement..."
                        : "Processing..."
                      : isFrench
                      ? "Utiliser une protection"
                      : "Use protection"}
                  </button>
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
                  {gamingTrackSummary.engagement.challenge.claimed ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      {isFrench ? "Recompense reclamee" : "Reward claimed"}
                      {gamingTrackSummary.engagement.challenge.claimedAt
                        ? ` · ${formatDateOnlyForLocale(gamingTrackSummary.engagement.challenge.claimedAt, activeLocale)}`
                        : ""}
                    </p>
                  ) : null}
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
                  <button
                    type="button"
                    className={`${controlButtonClass} mt-2 w-full`}
                    onClick={handleClaimGamingTrackChallenge}
                    disabled={
                      isGamingTrackActionPending ||
                      isGamingTrackLoading ||
                      !gamingTrackSummary.engagement.challenge.completed ||
                      gamingTrackSummary.engagement.challenge.claimed
                    }
                  >
                    <TrophyIcon />
                    {isGamingTrackActionPending
                      ? isFrench
                        ? "Traitement..."
                        : "Processing..."
                      : isFrench
                      ? "Reclamer la recompense"
                      : "Claim reward"}
                  </button>
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
                      <button
                        type="button"
                        key={`${nudge.id}-${index}`}
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getGamingTrackNudgeClass(
                          nudge.severity
                        )}`}
                        onClick={() => handleDismissGamingTrackNudge(nudge.id)}
                        disabled={isGamingTrackActionPending || isGamingTrackLoading}
                      >
                        {formatGamingTrackNudgeLabel(nudge.id, activeLocale)}: {nudge.metric} ×
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {!dashboardBlockCollapsed.gamingTrack && gamingTrackActionMessage ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {gamingTrackActionMessage}
          </p>
        ) : null}

        {!dashboardBlockCollapsed.gamingTrack && gamingTrackErrorMessage ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {gamingTrackErrorMessage}
          </p>
        ) : null}
      </section>

      <section
        className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getDashboardDropClassName("dailyControls")}`}
        style={{ order: getDashboardBlockVisualOrder("dailyControls"), animationDelay: "0.1s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("dailyControls", event)}
        onDrop={(event) => handleDashboardBlockDrop("dailyControls", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={sectionHeaderClass}>
            {isFrench ? "Pilotage du jour" : "Day Controls"}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={dashboardIconButtonClass}
              draggable
              onDragStart={(event) => handleDashboardBlockDragStart("dailyControls", event)}
              onDragEnd={handleDashboardBlockDragEnd}
              aria-label={getDashboardDragHandleLabel("dailyControls")}
              title={getDashboardDragHandleLabel("dailyControls")}
            >
              <DragHandleIcon />
            </button>
            <button
              type="button"
              className={dashboardIconButtonClass}
              onClick={() => toggleDashboardBlock("dailyControls")}
              aria-expanded={!dashboardBlockCollapsed.dailyControls}
              aria-label={getCollapseToggleAriaLabel("dailyControls", dashboardBlockCollapsed.dailyControls)}
              title={getCollapseToggleAriaLabel("dailyControls", dashboardBlockCollapsed.dailyControls)}
            >
              <CollapseChevronIcon isCollapsed={dashboardBlockCollapsed.dailyControls} />
            </button>
          </div>
        </div>

        {dashboardBlockCollapsed.dailyControls ? (
          <p className="mt-3 text-xs text-muted">{collapsedHintLabel}</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1 rounded-lg bg-surface-soft p-1">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
                  onClick={() => handleDateChange(shiftDate(selectedDate, -1))}
                  disabled={isMutationPending}
                  aria-label={isFrench ? "Jour precedent" : "Previous day"}
                >
                  <ArrowLeftIcon />
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
                  onClick={() => handleDateChange(toDateInputValue(new Date()))}
                  disabled={isMutationPending}
                >
                  {isFrench ? "Aujourd'hui" : "Today"}
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
                  onClick={() => handleDateChange(shiftDate(selectedDate, 1))}
                  disabled={isMutationPending}
                  aria-label={isFrench ? "Jour suivant" : "Next day"}
                >
                  <ArrowRightIcon />
                </button>
              </div>

              <input
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  if (event.target.value) {
                    handleDateChange(event.target.value);
                  }
                }}
                disabled={isMutationPending}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15"
              />

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={controlButtonClass}
                  onClick={handleCarryOverYesterday}
                  disabled={isMutationPending || isLoading || isDayAffirmationSaving}
                >
                  <CopyIcon />
                  {isCarryingOverYesterday
                    ? isFrench
                      ? "Copie..."
                      : "Carrying..."
                    : isFrench
                    ? "Copier d'hier"
                    : "Carry Over"}
                </button>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => openCreateTaskDialog()}
                  disabled={isMutationPending}
                >
                  <PlusIcon />
                  {isFrench ? "Nouvelle tache" : "New Task"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface-soft px-4 py-2.5">
              <p className="flex-1 text-sm text-muted">
                {isLoading
                  ? isFrench
                    ? "Chargement des taches..."
                    : "Loading tasks..."
                  : isFrench
                  ? `${tasks.length} tache${tasks.length === 1 ? "" : "s"} pour la date selectionnee`
                  : `${tasks.length} task${tasks.length === 1 ? "" : "s"} for the selected date`}
              </p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 rounded-full bg-line">
                  <div className="progress-gradient h-full rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
                </div>
                <span className="text-xs font-medium text-muted">{completionRate}%</span>
              </div>
            </div>

            {googleCalendarConnections.length > 0 ? (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    {isFrench ? "Evenements du calendrier" : "Calendar Events"}
                  </h3>
                  <span className="text-xs text-muted">
                    {isCalendarEventsLoading
                      ? (isFrench ? "Chargement..." : "Loading...")
                      : calendarEventSearchQuery.trim()
                        ? `${filteredCalendarEvents.length}/${calendarEvents.length}`
                        : `${calendarEvents.length} ${isFrench ? "evenement" : "event"}${calendarEvents.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                {calendarEvents.length > 1 ? (
                  <div className="relative mt-2">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true">
                      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                    </svg>
                    <input
                      type="text"
                      value={calendarEventSearchQuery}
                      onChange={(e) => setCalendarEventSearchQuery(e.target.value)}
                      placeholder={isFrench ? "Rechercher un evenement..." : "Search events..."}
                      className="w-full rounded-lg border border-line bg-surface px-3 py-2 pl-9 pr-8 text-sm text-foreground outline-none transition-all placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                    {calendarEventSearchQuery ? (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                        onClick={() => setCalendarEventSearchQuery("")}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {filteredCalendarEvents.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-line bg-surface-soft overflow-hidden divide-y divide-line">
                    {filteredCalendarEvents.map((event) => {
                      const isExpanded = expandedCalendarEventId === event.id;
                      const hasNote = Boolean(event.note);
                      const hasLinkedTasks = event.linkedTasks.length > 0;

                      return (
                        <div key={event.id}>
                          {/* Compact row — always visible */}
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface"
                            onClick={() => setExpandedCalendarEventId(isExpanded ? null : event.id)}
                          >
                            <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: connectionColorMap.get(event.connectionId) ?? "#6366f1" }} />
                            <span className="shrink-0 text-xs tabular-nums text-muted">
                              {formatCalendarEventTimeLabel(event, activeLocale, activeTimeZone)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                              {event.title}
                            </span>
                            {hasNote ? (
                              <span className="shrink-0 text-xs text-accent" title={isFrench ? "Note interne" : "Internal note"}>
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                                  <path d="M3.505 2.365A41.369 41.369 0 0 1 9 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.249 2.18 2.487V11.5a2.5 2.5 0 0 1-2.5 2.5h-1.862l-3.27 3.27a.75.75 0 0 1-1.293-.519V14h-.5A2.5 2.5 0 0 1 4.75 11.5V4.852c0-1.238.933-2.32 2.18-2.487h-3.425Z" />
                                </svg>
                              </span>
                            ) : null}
                            {hasLinkedTasks ? (
                              <span className="shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                                {event.linkedTasks.length}
                              </span>
                            ) : null}
                            <svg
                              viewBox="0 0 20 20"
                              aria-hidden="true"
                              className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            >
                              <path
                                d="M5.75 7.75L10 12.25L14.25 7.75"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.75"
                              />
                            </svg>
                          </button>

                          {/* Expanded detail panel */}
                          {isExpanded ? (
                            <div className="border-t border-line bg-surface px-4 py-3 space-y-3">
                              {/* Title + link + location + create task */}
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  {event.htmlLink ? (
                                    <a
                                      href={event.htmlLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-medium text-accent hover:underline"
                                    >
                                      {event.title} &#8599;
                                    </a>
                                  ) : null}
                                  {event.location ? (
                                    <p className="mt-0.5 text-xs text-muted truncate">
                                      <svg viewBox="0 0 20 20" fill="currentColor" className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden="true">
                                        <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
                                      </svg>
                                      {event.location}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  className={controlButtonClass}
                                  onClick={() => handleCreateTaskFromCalendarEvent(event)}
                                  disabled={pendingCalendarEventTaskIds.includes(event.id)}
                                >
                                  <PlusIcon />
                                  {isFrench ? "Nouvelle tache" : "New Task"}
                                </button>
                              </div>

                              {/* Description */}
                              {event.description ? (
                                <p className="text-xs text-muted whitespace-pre-wrap leading-relaxed">
                                  {event.description}
                                </p>
                              ) : null}

                              {/* Linked tasks */}
                              {hasLinkedTasks ? (
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                                    {isFrench ? "Taches liees" : "Linked Tasks"}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {event.linkedTasks.map((linkedTask) => (
                                      <button
                                        key={linkedTask.id}
                                        type="button"
                                        className="rounded-full border border-line bg-surface-soft px-2.5 py-1 text-xs text-foreground hover:bg-surface"
                                        onClick={() => {
                                          const task = tasks.find((candidate) => candidate.id === linkedTask.id);
                                          if (task) {
                                            openEditTaskDialog(task);
                                          }
                                        }}
                                      >
                                        {linkedTask.title}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {/* Internal Note */}
                              <div className="space-y-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                                  {isFrench ? "Note interne" : "Internal Note"}
                                </p>
                                {event.note ? (
                                  <>
                                    <p className="rounded-xl border border-line bg-white/70 px-3 py-2 text-sm text-foreground">
                                      {event.note.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || (isFrench ? "Note enregistree." : "Saved note.")}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className={controlButtonClass}
                                        onClick={() =>
                                          openEditNoteDialog(
                                            notes.find((note) => note.id === event.note!.id) ?? {
                                              id: event.note!.id,
                                              title: event.note!.title,
                                              body: event.note!.body,
                                              color: event.note!.color,
                                              targetDate: event.note!.targetDate,
                                              calendarEventId: event.note!.calendarEventId,
                                              createdAt: event.note!.createdAt,
                                              updatedAt: event.note!.updatedAt,
                                              linkedCalendarEvent: {
                                                id: event.id,
                                                title: event.title,
                                                startTime: event.startTime,
                                                endTime: event.endTime,
                                                htmlLink: event.htmlLink,
                                              },
                                            }
                                          )
                                        }
                                      >
                                        <SaveIcon />
                                        {isFrench ? "Ouvrir la note" : "Open note"}
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className={controlButtonClass}
                                    onClick={() => openCreateNoteDialogForCalendarEvent(event)}
                                  >
                                    <PlusIcon />
                                    {isFrench ? "Creer une note pour cet evenement" : "Create note for this event"}
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : !isCalendarEventsLoading ? (
                  <p className="mt-2 text-xs text-muted">
                    {isFrench ? "Aucun evenement pour cette date." : "No events for this date."}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>

      {carryOverMessage ? (
        <section
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
          style={{ order: getDashboardBlockVisualOrder("dailyControls", 1) }}
        >
          {carryOverMessage}
        </section>
      ) : null}

      {carryOverErrorMessage ? (
        <section
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
          style={{ order: getDashboardBlockVisualOrder("dailyControls", 2) }}
        >
          {carryOverErrorMessage}
        </section>
      ) : null}

      <section
        id="affirmation"
        className={`animate-fade-in-up overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50/50 via-surface to-violet-50/30 p-6 shadow-sm ${getDashboardDropClassName("affirmation")}`}
        style={{ order: getDashboardBlockVisualOrder("affirmation"), animationDelay: "0.15s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("affirmation", event)}
        onDrop={(event) => handleDashboardBlockDrop("affirmation", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={sectionHeaderClass}>
              {isFrench ? "Affirmation du jour" : "Day Affirmation"}
            </h2>
            <p className="text-sm text-muted">
              {isFrench
                ? "Une phrase intentionnelle pour la journee."
                : "One intentional statement for the day."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!dashboardBlockCollapsed.affirmation ? (
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${isAffirmationCompleted ? "bg-accent" : "bg-line"}`}
                onClick={() => {
                  void saveDayAffirmation({ isCompleted: !isAffirmationCompleted });
                }}
                disabled={isDayAffirmationLoading || isDayAffirmationSaving}
                role="switch"
                aria-checked={isAffirmationCompleted}
                aria-label={isFrench ? "Affirmation terminee" : "Affirmation completed"}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${isAffirmationCompleted ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            ) : null}
            <button
              type="button"
              className={dashboardIconButtonClass}
              draggable
              onDragStart={(event) => handleDashboardBlockDragStart("affirmation", event)}
              onDragEnd={handleDashboardBlockDragEnd}
              aria-label={getDashboardDragHandleLabel("affirmation")}
              title={getDashboardDragHandleLabel("affirmation")}
            >
              <DragHandleIcon />
            </button>
            <button
              type="button"
              className={dashboardIconButtonClass}
              onClick={() => toggleDashboardBlock("affirmation")}
              aria-expanded={!dashboardBlockCollapsed.affirmation}
              aria-label={getCollapseToggleAriaLabel("affirmation", dashboardBlockCollapsed.affirmation)}
              title={getCollapseToggleAriaLabel("affirmation", dashboardBlockCollapsed.affirmation)}
            >
              <CollapseChevronIcon isCollapsed={dashboardBlockCollapsed.affirmation} />
            </button>
          </div>
        </div>

        {dashboardBlockCollapsed.affirmation ? (
          <p className="mt-3 text-xs text-muted">
            {collapsedHintLabel}{" "}
            {isAffirmationCompleted
              ? isFrench
                ? "Statut: terminee."
                : "Status: completed."
              : isFrench
              ? "Statut: en attente."
              : "Status: pending."}
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              <div className="block text-sm font-semibold text-foreground">
                <span>{isFrench ? "Phrase du jour" : "Today statement"}</span>
                <RichTextEditor
                  locale={activeLocale}
                  value={dayAffirmationDraft}
                  onChange={(nextValue) => {
                    updateDayAffirmationDraft(nextValue);
                    setDayAffirmationErrorMessage(null);
                  }}
                  disabled={isDayAffirmationLoading || isDayAffirmationSaving}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => {
                    void saveDayAffirmation();
                  }}
                  disabled={isDayAffirmationLoading || isDayAffirmationSaving}
                >
                  <SaveIcon />
                  {isDayAffirmationSaving
                    ? isFrench
                      ? "Enregistrement..."
                      : "Saving..."
                    : isFrench
                    ? "Enregistrer l'affirmation"
                    : "Save affirmation"}
                </button>
              </div>
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
          </>
        )}
      </section>

      <section
        id="reminders"
        className={`animate-fade-in-up overflow-hidden rounded-xl bg-gradient-to-br from-amber-50/40 via-surface to-orange-50/30 p-6 shadow-sm ${getDashboardDropClassName("reminders")}`}
        style={{ order: getDashboardBlockVisualOrder("reminders"), animationDelay: "0.18s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("reminders", event)}
        onDrop={(event) => handleDashboardBlockDrop("reminders", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={sectionHeaderClass}>
              {isFrench ? "Rappels" : "Reminders"}
            </h2>
            <p className="text-sm text-muted">
              {isFrench
                ? "Vos rappels actifs jusqu'a la journee selectionnee."
                : "Your active reminders up to the selected day."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!dashboardBlockCollapsed.reminders ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={openCreateReminderDialog}
                disabled={isLoadingReminders}
              >
                <PlusIcon />
                {isFrench ? "Ajouter" : "Add"}
              </button>
            ) : null}
            <button
              type="button"
              className={dashboardIconButtonClass}
              draggable
              onDragStart={(event) => handleDashboardBlockDragStart("reminders", event)}
              onDragEnd={handleDashboardBlockDragEnd}
              aria-label={getDashboardDragHandleLabel("reminders")}
              title={getDashboardDragHandleLabel("reminders")}
            >
              <DragHandleIcon />
            </button>
            <button
              type="button"
              className={dashboardIconButtonClass}
              onClick={() => toggleDashboardBlock("reminders")}
              aria-expanded={!dashboardBlockCollapsed.reminders}
              aria-label={getCollapseToggleAriaLabel("reminders", dashboardBlockCollapsed.reminders)}
              title={getCollapseToggleAriaLabel("reminders", dashboardBlockCollapsed.reminders)}
            >
              <CollapseChevronIcon isCollapsed={dashboardBlockCollapsed.reminders} />
            </button>
          </div>
        </div>

        {dashboardBlockCollapsed.reminders ? (
          <p className="mt-3 text-xs text-muted">
            {collapsedHintLabel}{" "}
            {reminders.length === 0
              ? isFrench
                ? "Aucun rappel."
                : "No reminders."
              : isFrench
              ? `${reminders.length} rappel(s).`
              : `${reminders.length} reminder(s).`}
          </p>
        ) : (
          <>
            {isLoadingReminders ? (
              <p className="mt-4 text-sm text-muted">
                {isFrench ? "Chargement..." : "Loading..."}
              </p>
            ) : reminders.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                {isFrench ? "Aucun rappel actif." : "No active reminders."}
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {reminders.map((reminder) => {
                  const remindAtDate = new Date(reminder.remindAt);
                  const timeStr = remindAtDate.toLocaleTimeString(isFrench ? "fr-FR" : "en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: activeTimeZone ?? undefined,
                  });

                  return (
                    <li
                      key={reminder.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/60 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {reminder.title}
                          {reminder.project ? (
                            <span className="ml-2 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{reminder.project}</span>
                          ) : null}
                        </p>
                        {reminder.assignees ? (
                          <p className="truncate text-xs text-muted">{reminder.assignees}</p>
                        ) : null}
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>{timeStr}</span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${reminderStatusChipClassByStatus[reminder.status]}`}
                          >
                            {formatReminderStatus(reminder.status, activeLocale)}
                          </span>
                          {remindAtDate.getTime() < Date.now() ? (
                            <span>{isFrench ? "Echeance depassee" : "Past due"}</span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!isReminderResolvedStatus(reminder.status) ? (
                          <button
                            type="button"
                            className="rounded-md px-2 py-1 text-xs text-accent transition-colors hover:bg-accent-soft"
                            onClick={() => { void handleCompleteReminder(reminder.id); }}
                          >
                            {isFrench ? "Traiter" : "Complete"}
                          </button>
                        ) : null}
                        {!isReminderResolvedStatus(reminder.status) ? (
                          <button
                            type="button"
                            className="rounded-md px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-surface-soft hover:text-foreground"
                            onClick={() => { void handleCancelReminder(reminder.id); }}
                          >
                            {isFrench ? "Annuler" : "Cancel"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
                          onClick={() => openEditReminderDialog(reminder)}
                        >
                          {isFrench ? "Modifier" : "Edit"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {reminderErrorMessage && !reminderDialogMode ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {reminderErrorMessage}
              </p>
            ) : null}
          </>
        )}
      </section>

      {/* Notes section */}
      <section
        id="notes"
        className={`animate-fade-in-up overflow-hidden rounded-xl bg-gradient-to-br from-violet-50/40 via-surface to-indigo-50/30 p-6 shadow-sm ${getDashboardDropClassName("notes")}`}
        style={{ order: getDashboardBlockVisualOrder("notes"), animationDelay: "0.19s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("notes", event)}
        onDrop={(event) => handleDashboardBlockDrop("notes", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={sectionHeaderClass}>
              {isFrench ? "Notes" : "Notes"}
            </h2>
            <p className="text-sm text-muted">
              {isFrench ? "Vos notes libres et liees aux evenements." : "Your standalone and event-linked notes."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => openCreateNoteDialog()}
              disabled={isLoadingNotes}
            >
              <PlusIcon />
              {isFrench ? "Ajouter une note" : "Add note"}
            </button>
            <button
              type="button"
              className={dashboardIconButtonClass}
              draggable
              onDragStart={(event) => handleDashboardBlockDragStart("notes", event)}
              onDragEnd={handleDashboardBlockDragEnd}
              aria-label={getDashboardDragHandleLabel("notes")}
              title={getDashboardDragHandleLabel("notes")}
            >
              <DragHandleIcon />
            </button>
            <button
              type="button"
              className={dashboardIconButtonClass}
              onClick={() => toggleDashboardBlock("notes")}
              aria-expanded={!dashboardBlockCollapsed.notes}
              aria-label={getCollapseToggleAriaLabel("notes", dashboardBlockCollapsed.notes)}
              title={getCollapseToggleAriaLabel("notes", dashboardBlockCollapsed.notes)}
            >
              <CollapseChevronIcon isCollapsed={dashboardBlockCollapsed.notes} />
            </button>
          </div>
        </div>

        {dashboardBlockCollapsed.notes ? (
          <p className="mt-3 text-xs text-muted">
            {collapsedHintLabel}{" "}
            {notes.length === 0
              ? isFrench ? "Aucune note." : "No notes."
              : isFrench ? `${notes.length} note(s).` : `${notes.length} note(s).`}
          </p>
        ) : (
          <>
            {isLoadingNotes ? (
              <p className="mt-4 text-sm text-muted">
                {isFrench ? "Chargement..." : "Loading..."}
              </p>
            ) : notes.length === 0 && noteDialogMode === null ? (
              <p className="mt-4 text-sm text-muted">
                {isFrench ? "Aucune note. Créez votre première note." : "No notes yet. Create your first note."}
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {notes.map((note) => {
                  const isExpanded = expandedNoteId === note.id;
                  const attachmentsForNote = noteAttachments[note.id] ?? [];
                  const hasLoadedAttachments = Object.prototype.hasOwnProperty.call(noteAttachments, note.id);
                  const previewText = getRichTextPreviewText(note.body);
                  const noteTitle =
                    note.title?.trim() ||
                    (isFrench ? "Note sans titre" : "Untitled note");
                  const noteAccentClass = note.linkedCalendarEvent
                    ? "from-sky-500 via-cyan-400 to-indigo-400"
                    : note.targetDate
                      ? "from-amber-400 via-orange-300 to-rose-300"
                      : "from-slate-300 via-slate-200 to-transparent";
                  const attachmentLabel = hasLoadedAttachments
                    ? isFrench
                      ? `${attachmentsForNote.length} document${attachmentsForNote.length > 1 ? "s" : ""}`
                      : `${attachmentsForNote.length} document${attachmentsForNote.length === 1 ? "" : "s"}`
                    : isFrench
                      ? "Documents"
                      : "Documents";

                  return (
                    <li
                      key={note.id}
                      className={`group relative overflow-hidden rounded-2xl border border-line bg-white/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                        isExpanded ? "md:col-span-2" : ""
                      }`}
                    >
                      <div className={`h-1.5 w-full bg-gradient-to-r ${noteAccentClass}`} />

                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {note.linkedCalendarEvent ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                                  <CalendarIcon />
                                  <span className="truncate max-w-[220px]">
                                    {note.linkedCalendarEvent.title}
                                  </span>
                                </span>
                              ) : null}
                              {note.targetDate ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                  <CalendarIcon />
                                  {formatDateOnlyForLocale(note.targetDate, activeLocale)}
                                </span>
                              ) : null}
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                <span className="font-semibold">{attachmentLabel}</span>
                              </span>
                            </div>

                            <div className="mt-3">
                              <p className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-accent">
                                {noteTitle}
                              </p>
                              <p className="mt-1 text-xs text-muted">
                                {isFrench ? "Mis a jour" : "Updated"}{" "}
                                {formatDateTime(note.updatedAt, activeLocale, activeTimeZone)}
                              </p>
                            </div>

                            <div className="mt-3 rounded-2xl border border-line/80 bg-gradient-to-br from-surface-soft/90 to-white px-4 py-3">
                              <p className="text-sm leading-6 text-foreground/85 line-clamp-4">
                                {previewText || (isFrench ? "Note vide." : "Empty note.")}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              className={`${iconButtonClass} h-9 w-9 rounded-xl border border-transparent bg-surface-soft/70 px-0 hover:border-line`}
                              onClick={() => { void handleExpandNote(note.id); }}
                              title={isExpanded
                                ? (isFrench ? "Replier la note" : "Collapse note")
                                : (isFrench ? "Afficher les details" : "Show details")}
                              aria-label={isExpanded
                                ? (isFrench ? "Replier la note" : "Collapse note")
                                : (isFrench ? "Afficher les details" : "Show details")}
                            >
                              <CollapseChevronIcon isCollapsed={!isExpanded} />
                            </button>
                            <button
                              type="button"
                              className={`${iconButtonClass} h-9 w-9 rounded-xl border border-transparent bg-surface-soft/70 px-0 hover:border-line`}
                              onClick={() => openEditNoteDialog(note)}
                              title={isFrench ? "Modifier la note" : "Edit note"}
                              aria-label={isFrench ? "Modifier la note" : "Edit note"}
                            >
                              <PencilIcon />
                            </button>
                            <button
                              type="button"
                              className={`${iconButtonClass} h-9 w-9 rounded-xl border border-red-100 bg-red-50/80 px-0 text-rose-500 hover:border-red-200 hover:bg-rose-50 hover:text-rose-600`}
                              onClick={() => { void handleDeleteNote(note.id); }}
                              title={isFrench ? "Supprimer la note" : "Delete note"}
                              aria-label={isFrench ? "Supprimer la note" : "Delete note"}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/80 pt-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            {note.linkedCalendarEvent ? (
                              <span>
                                {isFrench ? "Lie a un evenement" : "Linked to an event"}
                              </span>
                            ) : (
                              <span>
                                {isFrench ? "Note libre" : "Standalone note"}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className={`${controlButtonClass} px-3 py-1.5 text-xs`}
                            onClick={() => { void handleExpandNote(note.id); }}
                          >
                            {isExpanded
                              ? isFrench ? "Masquer les details" : "Hide details"
                              : isFrench ? "Voir les details" : "View details"}
                          </button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="border-t border-line bg-surface-soft/55 px-4 py-4 sm:px-5">
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.9fr)]">
                            <section>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                {isFrench ? "Contenu complet" : "Full content"}
                              </p>
                              <div className="mt-2 rounded-2xl border border-line bg-surface px-4 py-4 shadow-sm">
                                <RichTextContent
                                  value={note.body}
                                  className="rich-text-render text-sm leading-6 text-foreground"
                                />
                              </div>
                            </section>

                            <section className="rounded-2xl border border-line bg-surface px-4 py-4 shadow-sm">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                  {isFrench ? "Documents" : "Documents"}
                                </p>
                                <span className="rounded-full bg-surface-soft px-2 py-1 text-[11px] font-semibold text-muted">
                                  {attachmentsForNote.length}
                                </span>
                              </div>

                              {attachmentsForNote.length > 0 ? (
                                <ul className="mt-3 flex flex-col gap-1.5">
                                  {attachmentsForNote.map((attachment) => (
                                    <li
                                      key={attachment.id}
                                      className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-soft/60 px-3 py-2"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
                                        <a
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                                          download={isDataUrl(attachment.url) ? attachment.name : undefined}
                                        >
                                          {isDataUrl(attachment.url)
                                            ? isFrench ? "Ouvrir le fichier" : "Open file"
                                            : attachment.url}
                                        </a>
                                        {attachment.contentType || typeof attachment.sizeBytes === "number" ? (
                                          <p className="mt-0.5 text-[11px] text-muted">
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
                                        className={`${iconButtonClass} h-8 w-8 rounded-lg px-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50`}
                                        disabled={pendingNoteAttachmentIds.includes(attachment.id)}
                                        onClick={() => { void handleDeleteNoteAttachment(note.id, attachment.id); }}
                                        aria-label={isFrench ? "Supprimer" : "Delete"}
                                      >
                                        {pendingNoteAttachmentIds.includes(attachment.id) ? "…" : <TrashIcon />}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-3 rounded-xl border border-dashed border-line bg-surface-soft/40 px-3 py-3 text-sm text-muted">
                                  {isFrench ? "Aucun document pour le moment." : "No documents yet."}
                                </p>
                              )}

                              <div className="mt-3 grid gap-2">
                                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                                  {isFrench ? "Nom du fichier" : "File name"}
                                  <input
                                    type="text"
                                    value={noteAttachmentNameDraft}
                                    onChange={(event) => setNoteAttachmentNameDraft(event.target.value)}
                                    className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                                    placeholder={isFrench ? "Nom du fichier" : "File name"}
                                    disabled={isCreatingNoteAttachment}
                                  />
                                </label>
                                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                                  {isFrench ? "Fichier" : "File"}
                                  <input
                                    ref={noteAttachmentFileInputRef}
                                    type="file"
                                    onChange={(event) => setNoteAttachmentFileDraft(event.target.files?.[0] ?? null)}
                                    className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                                    disabled={isCreatingNoteAttachment}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className={`${controlButtonClass} justify-center rounded-xl border-line bg-surface-soft/70`}
                                  disabled={isCreatingNoteAttachment}
                                  onClick={() => { void handleCreateNoteAttachment(note.id); }}
                                >
                                  <PlusIcon />
                                  {isCreatingNoteAttachment
                                    ? isFrench ? "Envoi..." : "Uploading..."
                                    : isFrench ? "Ajouter un document" : "Add document"}
                                </button>
                              </div>

                              {noteAttachmentErrorMessage ? (
                                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                  {noteAttachmentErrorMessage}
                                </p>
                              ) : null}
                            </section>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>

      {errorMessage ? (
        <section
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
          style={{ order: getDashboardBlockVisualOrder("board", 1) }}
        >
          {errorMessage}
        </section>
      ) : null}

      {dragErrorMessage ? (
        <section
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
          style={{ order: getDashboardBlockVisualOrder("board", 2) }}
        >
          {dragErrorMessage}
        </section>
      ) : null}

      <section
        id="board"
        className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getDashboardDropClassName("board")}`}
        style={{ order: getDashboardBlockVisualOrder("board"), animationDelay: "0.2s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("board", event)}
        onDrop={(event) => handleDashboardBlockDrop("board", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={sectionHeaderClass}>{isFrench ? "Tableau Kanban" : "Kanban Board"}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={dashboardIconButtonClass}
              draggable
              onDragStart={(event) => handleDashboardBlockDragStart("board", event)}
              onDragEnd={handleDashboardBlockDragEnd}
              aria-label={getDashboardDragHandleLabel("board")}
              title={getDashboardDragHandleLabel("board")}
            >
              <DragHandleIcon />
            </button>
            <button
              type="button"
              className={dashboardIconButtonClass}
              onClick={() => toggleDashboardBlock("board")}
              aria-expanded={!dashboardBlockCollapsed.board}
              aria-label={getCollapseToggleAriaLabel("board", dashboardBlockCollapsed.board)}
              title={getCollapseToggleAriaLabel("board", dashboardBlockCollapsed.board)}
            >
              <CollapseChevronIcon isCollapsed={dashboardBlockCollapsed.board} />
            </button>
          </div>
        </div>

        {dashboardBlockCollapsed.board ? (
          <p className="mt-3 text-xs text-muted">{collapsedHintLabel}</p>
        ) : (
          <>
            <section className="mt-4 rounded-2xl border border-line bg-surface-soft/60 p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.9fr))_auto]">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {isFrench ? "Recherche" : "Search"}
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-muted">
                      <SearchIcon />
                    </span>
                    <input
                      type="search"
                      value={taskFilterValues.query}
                      onChange={(event) => {
                        setTaskFilterValues((currentValues) => ({
                          ...currentValues,
                          query: event.target.value,
                        }));
                      }}
                      className={`${boardFilterFieldClass} mt-0 pl-10 pr-10`}
                      placeholder={
                        isFrench
                          ? "Titre, projet, description..."
                          : "Title, project, description..."
                      }
                    />
                    {taskFilterValues.query ? (
                      <button
                        type="button"
                        className="absolute inset-y-0 right-2 inline-flex items-center justify-center rounded-md px-1 text-muted transition-colors hover:text-foreground"
                        onClick={() => {
                          setTaskFilterValues((currentValues) => ({
                            ...currentValues,
                            query: "",
                          }));
                        }}
                        aria-label={isFrench ? "Effacer la recherche" : "Clear search"}
                        title={isFrench ? "Effacer la recherche" : "Clear search"}
                      >
                        <CloseIcon />
                      </button>
                    ) : null}
                  </div>
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {isFrench ? "Statut" : "Status"}
                  <select
                    value={taskFilterValues.status}
                    onChange={(event) => {
                      setTaskFilterValues((currentValues) => ({
                        ...currentValues,
                        status: isTaskStatus(event.target.value) ? event.target.value : "all",
                      }));
                    }}
                    className={`${boardFilterFieldClass} mt-2`}
                  >
                    <option value="all">{isFrench ? "Tous les statuts" : "All statuses"}</option>
                    {boardColumns.map((column) => (
                      <option key={column.status} value={column.status}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {isFrench ? "Priorite" : "Priority"}
                  <select
                    value={taskFilterValues.priority}
                    onChange={(event) => {
                      setTaskFilterValues((currentValues) => ({
                        ...currentValues,
                        priority: isTaskPriority(event.target.value) ? event.target.value : "all",
                      }));
                    }}
                    className={`${boardFilterFieldClass} mt-2`}
                  >
                    <option value="all">{isFrench ? "Toutes les priorites" : "All priorities"}</option>
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {isFrench ? "Projet" : "Project"}
                  <select
                    value={taskFilterValues.project}
                    onChange={(event) => {
                      setTaskFilterValues((currentValues) => ({
                        ...currentValues,
                        project: event.target.value,
                      }));
                    }}
                    className={`${boardFilterFieldClass} mt-2`}
                  >
                    <option value="">{isFrench ? "Tous les projets" : "All projects"}</option>
                    {taskFilterProjectOptions.map((projectName) => (
                      <option key={projectName} value={projectName}>
                        {projectName}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    className={`w-full xl:w-auto ${controlButtonClass}`}
                    onClick={() => setTaskFilterValues(DEFAULT_TASK_FILTER_VALUES)}
                    disabled={!hasActiveTaskFilters}
                  >
                    {isFrench ? "Reinitialiser" : "Reset"}
                  </button>
                </div>
              </div>

              <p className="mt-3 text-xs text-muted">
                {hasActiveTaskFilters
                  ? isFrench
                    ? `${filteredTasks.length} tache${filteredTasks.length === 1 ? "" : "s"} visible${filteredTasks.length === 1 ? "" : "s"} sur ${tasks.length}.`
                    : `${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"} shown out of ${tasks.length}.`
                  : isFrench
                  ? "Filtrez rapidement par texte, statut, priorite ou projet."
                  : "Quickly filter by text, status, priority, or project."}
              </p>
            </section>

            {isEmptyBoard ? (
              <section className="mt-4 rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted shadow-sm">
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

            {isFilteredBoardEmpty ? (
              <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
                <p className="font-semibold">
                  {isFrench
                    ? "Aucune tache ne correspond aux filtres actifs."
                    : "No tasks match the active filters."}
                </p>
                <p className="mt-1">
                  {isFrench
                    ? "Ajustez la recherche ou reinitialisez les filtres pour revoir tout le planning."
                    : "Adjust the search or reset filters to show the full schedule again."}
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
              <main className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {boardColumns.map((column) => {
                  const columnTasks = filteredTasksByStatus[column.status];
                  const totalColumnTasks = tasksByStatus[column.status];

                  return (
                    <section
                      key={column.status}
                      className={`flex min-h-[340px] flex-col rounded-xl border-t-2 bg-surface-soft/50 px-3 py-3 ${statusColumnClassByStatus[column.status]}`}
                    >
                      <header className="flex items-center justify-between gap-2 pb-2">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xs font-semibold text-foreground">
                            {column.label}
                          </h2>
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface px-1.5 text-[10px] font-semibold text-muted">
                            {hasActiveTaskFilters ? `${columnTasks.length}/${totalColumnTasks.length}` : columnTasks.length}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
                          onClick={() => openCreateTaskDialog(column.status)}
                          disabled={isMutationPending}
                          aria-label={isFrench ? `Nouvelle tache (${column.label})` : `New task (${column.label})`}
                          title={isFrench ? `Nouvelle tache (${column.label})` : `New task (${column.label})`}
                        >
                          <PlusIcon />
                        </button>
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
                            {hasActiveTaskFilters
                              ? isFrench
                                ? "Aucune tache visible avec ces filtres."
                                : "No visible tasks with these filters."
                              : column.emptyLabel}
                          </div>
                        )}
                      </TaskColumn>
                    </section>
                  );
                })}
              </main>
            </DndContext>
          </>
        )}
      </section>

      <section
        id="bilan"
        className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getDashboardDropClassName("bilan")}`}
        style={{ order: getDashboardBlockVisualOrder("bilan"), animationDelay: "0.25s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("bilan", event)}
        onDrop={(event) => handleDashboardBlockDrop("bilan", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={sectionHeaderClass}>
              {isFrench ? "Bilan du jour" : "Day Bilan"}
            </h2>
            <p className="text-sm text-muted">
              {isFrench
                ? "Capturez vos victoires, blocages et top 3 pour demain."
                : "Capture wins, blockers, and your top 3 for tomorrow."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!dashboardBlockCollapsed.bilan ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={handleSaveDayBilan}
                disabled={isDayBilanLoading || isDayBilanSaving}
              >
                <SaveIcon />
                {isDayBilanSaving
                  ? isFrench
                    ? "Enregistrement..."
                    : "Saving..."
                  : isFrench
                  ? "Enregistrer le bilan"
                  : "Save bilan"}
              </button>
            ) : null}
            <button
              type="button"
              className={dashboardIconButtonClass}
              draggable
              onDragStart={(event) => handleDashboardBlockDragStart("bilan", event)}
              onDragEnd={handleDashboardBlockDragEnd}
              aria-label={getDashboardDragHandleLabel("bilan")}
              title={getDashboardDragHandleLabel("bilan")}
            >
              <DragHandleIcon />
            </button>
            <button
              type="button"
              className={dashboardIconButtonClass}
              onClick={() => toggleDashboardBlock("bilan")}
              aria-expanded={!dashboardBlockCollapsed.bilan}
              aria-label={getCollapseToggleAriaLabel("bilan", dashboardBlockCollapsed.bilan)}
              title={getCollapseToggleAriaLabel("bilan", dashboardBlockCollapsed.bilan)}
            >
              <CollapseChevronIcon isCollapsed={dashboardBlockCollapsed.bilan} />
            </button>
          </div>
        </div>

        {dashboardBlockCollapsed.bilan ? (
          <p className="mt-3 text-xs text-muted">{collapsedHintLabel}</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-line p-3">
                <p className="text-[11px] font-medium text-muted">
                  {isFrench ? "Taches terminees" : "Done Tasks"}
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">{tasksByStatus.done.length}</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-[11px] font-medium text-muted">
                  {isFrench ? "Actionnables" : "Actionable"}
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">{actionableTaskCount}</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-[11px] font-medium text-muted">
                  {isFrench ? "Annulees" : "Cancelled"}
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">{tasksByStatus.cancelled.length}</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-[11px] font-medium text-muted">
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
                <div>
                  <p className="text-sm font-medium text-foreground">{isFrench ? "Humeur" : "Mood"}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {[
                      { value: "1", emoji: "\ud83d\ude2b", label: isFrench ? "Tres difficile" : "Very hard" },
                      { value: "2", emoji: "\ud83d\ude1f", label: isFrench ? "Difficile" : "Hard" },
                      { value: "3", emoji: "\ud83d\ude10", label: isFrench ? "Neutre" : "Neutral" },
                      { value: "4", emoji: "\ud83d\ude0a", label: isFrench ? "Bonne" : "Good" },
                      { value: "5", emoji: "\ud83e\udd29", label: isFrench ? "Excellente" : "Excellent" },
                    ].map((mood) => (
                      <button
                        key={mood.value}
                        type="button"
                        className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all duration-200 ${
                          dayBilanFormValues.mood === mood.value
                            ? "scale-110 bg-accent-soft ring-2 ring-accent"
                            : "bg-surface-soft hover:scale-105 hover:bg-surface"
                        }`}
                        onClick={() => updateDayBilanField("mood", dayBilanFormValues.mood === mood.value ? "" : mood.value)}
                        disabled={isDayBilanSaving}
                        title={mood.label}
                        aria-label={mood.label}
                      >
                        {mood.emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="block text-sm font-semibold text-foreground">
                    <span>{isFrench ? "Victoires" : "Wins"}</span>
                    <RichTextEditor
                      locale={activeLocale}
                      value={dayBilanFormValues.wins}
                      onChange={(nextValue) => updateDayBilanField("wins", nextValue)}
                      disabled={isDayBilanSaving}
                    />
                  </div>
                  <div className="block text-sm font-semibold text-foreground">
                    <span>{isFrench ? "Blocages" : "Blockers"}</span>
                    <RichTextEditor
                      locale={activeLocale}
                      value={dayBilanFormValues.blockers}
                      onChange={(nextValue) => updateDayBilanField("blockers", nextValue)}
                      disabled={isDayBilanSaving}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="block text-sm font-semibold text-foreground">
                    <span>{isFrench ? "Lecons apprises" : "Lessons learned"}</span>
                    <RichTextEditor
                      locale={activeLocale}
                      value={dayBilanFormValues.lessonsLearned}
                      onChange={(nextValue) => updateDayBilanField("lessonsLearned", nextValue)}
                      disabled={isDayBilanSaving}
                    />
                  </div>
                  <div className="block text-sm font-semibold text-foreground">
                    <span>{isFrench ? "Top 3 de demain" : "Tomorrow top 3"}</span>
                    <RichTextEditor
                      locale={activeLocale}
                      value={dayBilanFormValues.tomorrowTop3}
                      onChange={(nextValue) => updateDayBilanField("tomorrowTop3", nextValue)}
                      disabled={isDayBilanSaving}
                    />
                  </div>
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
          </>
        )}
      </section>

      {isNoteDialogOpen ? (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeNoteDialog();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={noteDialogTitle}
            className={`animate-scale-in flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6 ${noteDialogHeightClass}`}
          >
            <header className="mb-3 flex shrink-0 items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{noteDialogTitle}</h2>
                <p className="mt-1 text-sm text-muted">
                  {isFrench
                    ? "Capturez une note libre ou reliez-la a un evenement calendrier."
                    : "Capture a standalone note or link it to a calendar event."}
                </p>
              </div>
              <button
                type="button"
                className={controlIconButtonClass}
                onClick={closeNoteDialog}
                disabled={isSubmittingNote}
                aria-label={isFrench ? "Fermer la fenetre de note" : "Close note dialog"}
                title={isFrench ? "Fermer la fenetre de note" : "Close note dialog"}
              >
                <CloseIcon />
              </button>
            </header>

            <form
              className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmitNote();
              }}
            >
              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Titre (facultatif)" : "Title (optional)"}
                <input
                  type="text"
                  className={textFieldClass}
                  placeholder={isFrench ? "Titre..." : "Title..."}
                  value={noteFormValues.title}
                  onChange={(event) => setNoteFormValues((prev) => ({ ...prev, title: event.target.value }))}
                  maxLength={300}
                  disabled={isSubmittingNote}
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Contenu" : "Body"}
                <RichTextEditor
                  locale={activeLocale}
                  value={noteFormValues.body}
                  disabled={isSubmittingNote}
                  onChange={(nextValue) => setNoteFormValues((prev) => ({ ...prev, body: nextValue }))}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-foreground">
                  {isFrench ? "Date cible (facultatif)" : "Target date (optional)"}
                  <input
                    type="date"
                    className={textFieldClass}
                    value={noteFormValues.targetDate}
                    onChange={(event) => setNoteFormValues((prev) => ({ ...prev, targetDate: event.target.value }))}
                    disabled={isSubmittingNote}
                  />
                </label>

                <label className="block text-sm font-semibold text-foreground">
                  {isFrench ? "Evenement lie (facultatif)" : "Linked event (optional)"}
                  <select
                    className={textFieldClass}
                    value={noteFormValues.calendarEventId}
                    onChange={(event) => {
                      const nextCalendarEventId = event.target.value;
                      const selectedEvent = noteCalendarEventOptions.find(
                        (eventOption) => eventOption.id === nextCalendarEventId
                      );
                      setNoteFormValues((prev) => ({
                        ...prev,
                        calendarEventId: nextCalendarEventId,
                        targetDate:
                          !prev.targetDate && selectedEvent
                            ? selectedEvent.startTime.substring(0, 10)
                            : prev.targetDate,
                      }));
                    }}
                    disabled={isSubmittingNote}
                  >
                    <option value="">
                      {isFrench ? "Aucun evenement" : "No event"}
                    </option>
                    {noteCalendarEventOptions.map((eventOption) => {
                      const isDisabled =
                        linkedCalendarEventIdsInUse.has(eventOption.id) &&
                        eventOption.id !== editingNote?.calendarEventId;

                      return (
                        <option
                          key={eventOption.id}
                          value={eventOption.id}
                          disabled={isDisabled}
                        >
                          {`${formatCalendarEventTimeLabel(
                            {
                              id: eventOption.id,
                              connectionId: "",
                              title: eventOption.title,
                              description: null,
                              startTime: eventOption.startTime,
                              endTime: eventOption.endTime,
                              isAllDay: eventOption.isAllDay,
                              startDate: eventOption.startDate,
                              endDate: eventOption.endDate,
                              location: null,
                              htmlLink: eventOption.htmlLink,
                              note: null,
                              linkedTasks: [],
                            },
                            activeLocale,
                            activeTimeZone
                          )} - ${eventOption.title}${isDisabled ? isFrench ? " (deja lie)" : " (already linked)" : ""}`}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>

              {noteErrorMessage ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {noteErrorMessage}
                </p>
              ) : null}

              {noteDialogMode === "edit" && editingNoteId ? (
                <section className="rounded-2xl border border-line bg-surface-soft/50 p-4">
                  <header>
                    <h3 className="text-sm font-semibold text-foreground">
                      {isFrench ? "Documents" : "Documents"} ({(noteAttachments[editingNoteId] ?? []).length})
                    </h3>
                    <p className="text-xs text-muted">
                      {isFrench ? "Ajoutez ou retirez des fichiers lies a cette note." : "Add or remove files linked to this note."}
                    </p>
                  </header>

                  {(noteAttachments[editingNoteId] ?? []).length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {(noteAttachments[editingNoteId] ?? []).map((attachment) => (
                        <li key={attachment.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                              download={isDataUrl(attachment.url) ? attachment.name : undefined}
                            >
                              {isDataUrl(attachment.url) ? (isFrench ? "Ouvrir le fichier" : "Open file") : attachment.url}
                            </a>
                            {attachment.contentType || typeof attachment.sizeBytes === "number" ? (
                              <p className="mt-0.5 text-[11px] text-muted">
                                {[attachment.contentType ?? null, typeof attachment.sizeBytes === "number" ? formatFileSize(attachment.sizeBytes) : null].filter((value): value is string => Boolean(value)).join(" · ")}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-md px-2 py-1 text-xs text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-50"
                            disabled={pendingNoteAttachmentIds.includes(attachment.id)}
                            onClick={() => { void handleDeleteNoteAttachment(editingNoteId, attachment.id); }}
                          >
                            {pendingNoteAttachmentIds.includes(attachment.id) ? "…" : <TrashIcon />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 rounded-xl border border-dashed border-line bg-surface px-3 py-2 text-sm text-muted">
                      {isFrench ? "Aucun document pour le moment." : "No documents yet."}
                    </p>
                  )}

                  {noteAttachmentErrorMessage ? (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {noteAttachmentErrorMessage}
                    </p>
                  ) : null}

                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
                    <label className="block text-sm font-semibold text-foreground">
                      {isFrench ? "Nom" : "Name"}
                      <input
                        type="text"
                        value={noteAttachmentNameDraft}
                        onChange={(event) => setNoteAttachmentNameDraft(event.target.value)}
                        className={textFieldClass}
                        placeholder={isFrench ? "Nom du fichier" : "File name"}
                        disabled={isCreatingNoteAttachment}
                      />
                    </label>
                    <label className="block text-sm font-semibold text-foreground">
                      {isFrench ? "Fichier" : "File"}
                      <input
                        ref={noteAttachmentFileInputRef}
                        type="file"
                        onChange={(event) => setNoteAttachmentFileDraft(event.target.files?.[0] ?? null)}
                        className={textFieldClass}
                        disabled={isCreatingNoteAttachment}
                      />
                    </label>
                    <button
                      type="button"
                      className={controlButtonClass}
                      disabled={isCreatingNoteAttachment}
                      onClick={() => { void handleCreateNoteAttachment(editingNoteId); }}
                    >
                      <PlusIcon />
                      {isCreatingNoteAttachment ? "…" : isFrench ? "Ajouter" : "Add"}
                    </button>
                  </div>
                </section>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
                  onClick={closeNoteDialog}
                >
                  {isFrench ? "Annuler" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className={primaryButtonClass}
                  disabled={isSubmittingNote}
                >
                  <SaveIcon />
                  {noteDialogSubmitLabel}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isTaskDialogOpen ? (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
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
            className={`animate-scale-in flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6 ${taskDialogHeightClass}`}
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
                className={controlIconButtonClass}
                onClick={closeTaskDialog}
                disabled={isSubmittingTask}
                aria-label={isFrench ? "Fermer la fenetre de tache" : "Close task dialog"}
                title={isFrench ? "Fermer la fenetre de tache" : "Close task dialog"}
              >
                <CloseIcon />
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

              <div className="grid gap-3 sm:grid-cols-3">
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
                  {isFrench ? "Date d'echeance" : "End date"}
                  <input
                    type="date"
                    value={taskFormValues.dueDate}
                    onChange={(event) => updateTaskFormField("dueDate", event.target.value)}
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

              {googleCalendarConnections.length > 0 ? (
                <label className="block text-sm font-semibold text-foreground">
                  {isFrench ? "Evenement calendrier lie" : "Linked Calendar Event"}
                  <select
                    value={taskFormValues.calendarEventId ?? ""}
                    onChange={(event) =>
                      updateTaskFormField("calendarEventId", event.target.value || null)
                    }
                    className={textFieldClass}
                    disabled={isSubmittingTask}
                  >
                    <option value="">
                      {isFrench ? "Aucun evenement lie" : "No linked event"}
                    </option>
                    {taskFormValues.calendarEventId &&
                    !calendarEvents.some((calendarEvent) => calendarEvent.id === taskFormValues.calendarEventId) ? (
                      <option value={taskFormValues.calendarEventId}>
                        {isFrench ? "Evenement deja lie" : "Previously linked event"}
                      </option>
                    ) : null}
                    {calendarEvents.map((calendarEvent) => (
                      <option key={calendarEvent.id} value={calendarEvent.id}>
                        {calendarEvent.title} · {formatCalendarEventTimeLabel(calendarEvent, activeLocale, activeTimeZone)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

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
                    <TrashIcon />
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
                    <PlusIcon />
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
                            <RichTextContent
                              value={comment.body}
                              className="rich-text-render text-sm leading-6 text-foreground"
                            />
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <p className="text-xs text-muted">
                                {formatDateTime(comment.createdAt, activeLocale, activeTimeZone)}
                              </p>
                              <button
                                type="button"
                                className={`${iconButtonClass} h-7 w-7 rounded-lg px-0 text-[11px]`}
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={
                                  isSubmittingTask ||
                                  isTaskDetailsLoading ||
                                  pendingCommentIds.includes(comment.id)
                                }
                                aria-label={isFrench ? "Retirer le commentaire" : "Remove comment"}
                                title={isFrench ? "Retirer le commentaire" : "Remove comment"}
                              >
                                {pendingCommentIds.includes(comment.id)
                                  ? isFrench
                                    ? "Suppression..."
                                    : "Removing..."
                                  : <TrashIcon />}
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      <RichTextEditor
                        locale={activeLocale}
                        value={taskCommentDraft}
                        onChange={(nextValue) => setTaskCommentDraft(nextValue)}
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
                        <PlusIcon />
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
                                className={`${iconButtonClass} h-7 w-7 rounded-lg px-0 text-[11px]`}
                                onClick={() => handleDeleteAttachment(attachment.id)}
                                disabled={
                                  isSubmittingTask ||
                                  isTaskDetailsLoading ||
                                  pendingAttachmentIds.includes(attachment.id)
                                }
                                aria-label={isFrench ? "Retirer la piece jointe" : "Remove attachment"}
                                title={isFrench ? "Retirer la piece jointe" : "Remove attachment"}
                              >
                                {pendingAttachmentIds.includes(attachment.id)
                                  ? isFrench
                                    ? "Suppression..."
                                    : "Removing..."
                                  : <TrashIcon />}
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
                        <PlusIcon />
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
                    <CloseIcon />
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

      {reminderDialogMode ? (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeReminderDialog();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              reminderDialogMode === "edit"
                ? isFrench ? "Modifier le rappel" : "Edit Reminder"
                : isFrench ? "Ajouter un rappel" : "Add Reminder"
            }
            className="animate-scale-in flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6"
          >
            <header className="mb-3 flex shrink-0 items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {reminderDialogMode === "edit"
                    ? isFrench ? "Modifier le rappel" : "Edit Reminder"
                    : isFrench ? "Ajouter un rappel" : "Add Reminder"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {isFrench
                    ? "Definissez un titre, une description et l'heure du rappel."
                    : "Set a title, description, and the reminder time."}
                </p>
              </div>
              <button
                type="button"
                className={controlIconButtonClass}
                onClick={closeReminderDialog}
                disabled={isSubmittingReminder}
                aria-label={isFrench ? "Fermer" : "Close"}
                title={isFrench ? "Fermer" : "Close"}
              >
                <CloseIcon />
              </button>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleReminderFormSubmit}>
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Titre" : "Title"}
                <input
                  type="text"
                  value={reminderFormValues.title}
                  onChange={(event) => {
                    setReminderFormValues((v) => ({ ...v, title: event.target.value }));
                    setReminderErrorMessage(null);
                  }}
                  className={textFieldClass}
                  maxLength={200}
                  placeholder={isFrench ? "Titre du rappel" : "Reminder title"}
                  required
                  disabled={isSubmittingReminder}
                />
              </label>

              <div className="block text-sm font-semibold text-foreground">
                <span>{isFrench ? "Description (optionnel)" : "Description (optional)"}</span>
                <RichTextEditor
                  locale={activeLocale}
                  value={reminderFormValues.description}
                  onChange={(nextValue) => {
                    setReminderFormValues((v) => ({ ...v, description: nextValue }));
                  }}
                  disabled={isSubmittingReminder}
                />
              </div>

              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Projet (optionnel)" : "Project (optional)"}
                <select
                  value={reminderFormValues.project}
                  onChange={(event) => {
                    setReminderFormValues((v) => ({ ...v, project: event.target.value }));
                  }}
                  className={textFieldClass}
                  disabled={isSubmittingReminder}
                >
                  <option value="">{isFrench ? "Aucun projet" : "No project"}</option>
                  {projectSelectOptions.map((projectName) => (
                    <option key={projectName} value={projectName}>
                      {projectName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Assignes (optionnel)" : "Assignees (optional)"}
                <input
                  type="text"
                  value={reminderFormValues.assignees}
                  onChange={(event) => {
                    setReminderFormValues((v) => ({ ...v, assignees: event.target.value }));
                  }}
                  className={textFieldClass}
                  maxLength={500}
                  placeholder={isFrench ? "Noms ou emails, separes par des virgules" : "Names or emails, comma-separated"}
                  disabled={isSubmittingReminder}
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Date et heure" : "Date & Time"}
                <input
                  type="datetime-local"
                  value={reminderFormValues.remindAt}
                  onChange={(event) => {
                    setReminderFormValues((v) => ({ ...v, remindAt: event.target.value }));
                    setReminderErrorMessage(null);
                  }}
                  className={textFieldClass}
                  required
                  disabled={isSubmittingReminder}
                />
              </label>

              {reminderErrorMessage ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {reminderErrorMessage}
                </p>
              ) : null}

              {/* Attachment section — visible when editing an existing reminder */}
              {reminderDialogMode === "edit" && editingReminderId ? (
                <div className="border-t border-line pt-4">
                  <p className="mb-2 text-sm font-semibold text-foreground">
                    {isFrench ? "Documents" : "Documents"} ({(reminderAttachments[editingReminderId] ?? []).length})
                  </p>
                  {(reminderAttachments[editingReminderId] ?? []).length > 0 ? (
                    <ul className="mb-3 flex flex-col gap-1.5">
                      {(reminderAttachments[editingReminderId] ?? []).map((attachment) => (
                        <li key={attachment.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                              download={isDataUrl(attachment.url) ? attachment.name : undefined}
                            >
                              {isDataUrl(attachment.url) ? (isFrench ? "Ouvrir le fichier" : "Open file") : attachment.url}
                            </a>
                            {attachment.contentType || typeof attachment.sizeBytes === "number" ? (
                              <p className="mt-0.5 text-[11px] text-muted">
                                {[attachment.contentType ?? null, typeof attachment.sizeBytes === "number" ? formatFileSize(attachment.sizeBytes) : null].filter((v): v is string => Boolean(v)).join(" · ")}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-md px-2 py-1 text-xs text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-50"
                            disabled={pendingReminderAttachmentIds.includes(attachment.id)}
                            onClick={() => { void handleDeleteReminderAttachment(editingReminderId, attachment.id); }}
                          >
                            {pendingReminderAttachmentIds.includes(attachment.id) ? "…" : <TrashIcon />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mb-3 rounded-xl border border-dashed border-line bg-surface px-3 py-2 text-sm text-muted">
                      {isFrench ? "Aucun document pour le moment." : "No documents yet."}
                    </p>
                  )}
                  {reminderAttachmentErrorMessage ? (
                    <p className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{reminderAttachmentErrorMessage}</p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
                    <label className="block text-xs font-medium text-muted">
                      {isFrench ? "Nom" : "Name"}
                      <input
                        type="text"
                        value={reminderAttachmentNameDraft}
                        onChange={(e) => setReminderAttachmentNameDraft(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                        placeholder={isFrench ? "Nom du fichier" : "File name"}
                        disabled={isCreatingReminderAttachment}
                      />
                    </label>
                    <label className="block text-xs font-medium text-muted">
                      {isFrench ? "Fichier" : "File"}
                      <input
                        ref={reminderAttachmentFileInputRef}
                        type="file"
                        onChange={(e) => setReminderAttachmentFileDraft(e.target.files?.[0] ?? null)}
                        className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                        disabled={isCreatingReminderAttachment}
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                      disabled={isCreatingReminderAttachment}
                      onClick={() => { void handleCreateReminderAttachment(editingReminderId); }}
                    >
                      {isCreatingReminderAttachment ? "…" : isFrench ? "Ajouter" : "Add"}
                    </button>
                  </div>
                </div>
              ) : null}

            </div>
              <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line pt-3 mt-3">
                <button
                  type="button"
                  className={controlButtonClass}
                  onClick={closeReminderDialog}
                  disabled={isSubmittingReminder}
                >
                  <CloseIcon />
                  {isFrench ? "Annuler" : "Cancel"}
                </button>
                <button type="submit" className={primaryButtonClass} disabled={isSubmittingReminder}>
                  <SaveIcon />
                  {isSubmittingReminder
                    ? isFrench ? "Enregistrement..." : "Saving..."
                    : reminderDialogMode === "edit"
                    ? isFrench ? "Mettre a jour" : "Update"
                    : isFrench ? "Creer le rappel" : "Create Reminder"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {isProfileDialogOpen ? (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
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
            className="animate-scale-in w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6"
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
                <TimeZoneIcon />
                {isFrench ? "Utiliser le fuseau du navigateur" : "Use Browser Time Zone"}
              </button>

              <div className="border-t border-line pt-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Google Calendar
                </h4>
                {!isGoogleCalendarAvailable ? (
                  <p className="mt-2 text-sm text-muted">
                    {getGoogleCalendarUnavailableMessage(isFrench)}
                  </p>
                ) : isGoogleCalendarLoading ? (
                  <p className="mt-2 text-sm text-muted">
                    {isFrench ? "Chargement..." : "Loading..."}
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {googleCalendarConnections.map((conn) => (
                      <div key={conn.id} className="rounded-lg border border-line px-3 py-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={conn.color}
                              onChange={(e) => handleUpdateConnectionColor(conn.id, e.target.value)}
                              className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                              title={isFrench ? "Couleur du calendrier" : "Calendar color"}
                            />
                            <div>
                              <p className="text-sm font-medium text-foreground">{conn.email}</p>
                              {conn.lastSyncedAt ? (
                                <p className="text-xs text-muted">
                                  {isFrench ? "Derniere synchronisation :" : "Last synced:"}{" "}
                                  {new Date(conn.lastSyncedAt).toLocaleString()}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="text-xs text-muted hover:text-foreground"
                            onClick={() => handleDisconnectGoogleCalendar(conn.id)}
                          >
                            {isFrench ? "Deconnecter" : "Disconnect"}
                          </button>
                        </div>
                        <select
                          value={conn.calendarId}
                          onFocus={() => {
                            if (!connectionCalendarOptions[conn.id]) {
                              fetchConnectionCalendars(conn.id);
                            }
                          }}
                          onChange={(e) => handleUpdateCalendarId(conn.id, e.target.value)}
                          className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent/15"
                        >
                          {connectionCalendarOptions[conn.id] ? (
                            connectionCalendarOptions[conn.id].map((cal) => (
                              <option key={cal.id} value={cal.id}>
                                {cal.summary}{cal.primary ? (isFrench ? " (principal)" : " (primary)") : ""}
                              </option>
                            ))
                          ) : (
                            <option value={conn.calendarId}>
                              {conn.calendarId === "primary"
                                ? (isFrench ? "Calendrier principal" : "Primary calendar")
                                : conn.calendarId}
                            </option>
                          )}
                        </select>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={controlButtonClass}
                        onClick={handleConnectGoogleCalendar}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {isFrench
                          ? (googleCalendarConnections.length > 0 ? "Ajouter un compte Google" : "Connecter Google Calendar")
                          : (googleCalendarConnections.length > 0 ? "Add Google Account" : "Connect Google Calendar")}
                      </button>
                      {googleCalendarConnections.length > 0 ? (
                        <button
                          type="button"
                          className={controlButtonClass}
                          onClick={handleSyncGoogleCalendar}
                          disabled={isGoogleCalendarSyncing}
                        >
                          {isGoogleCalendarSyncing
                            ? (isFrench ? "Synchronisation..." : "Syncing...")
                            : (isFrench ? "Synchroniser" : "Sync")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
                {googleCalendarError ? (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {googleCalendarError}
                  </p>
                ) : null}
              </div>

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
                  <CloseIcon />
                  {isFrench ? "Fermer" : "Close"}
                </button>
                <button type="submit" className={primaryButtonClass} disabled={isProfileSaving}>
                  <SaveIcon />
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
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
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
            className="animate-scale-in w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6"
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
                <CloseIcon />
                {isFrench ? "Annuler" : "Cancel"}
              </button>
              <button
                type="button"
                className={dangerButtonClass}
                onClick={handleDeleteTask}
                disabled={isDeletingTask}
              >
                <TrashIcon />
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

      {isTaskAlertsPanelOpen ? (
        <section className="animate-scale-in fixed bottom-24 left-4 right-4 z-40 flex max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:left-auto sm:right-6 sm:w-[380px]">
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-700">
                <BellIcon />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isFrench ? "Alertes" : "Alerts"}
                </p>
                <p className="text-[11px] text-muted">
                  {alertsSummary.count > 0
                    ? isFrench
                      ? `${alertsSummary.overdueCount} en retard · ${alertsSummary.todayCount} aujourd'hui · ${alertsSummary.tomorrowCount} demain`
                      : `${alertsSummary.overdueCount} overdue · ${alertsSummary.todayCount} today · ${alertsSummary.tomorrowCount} tomorrow`
                    : isFrench
                    ? "Rappels et echeances non resolus"
                    : "Unresolved reminders and due dates"}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
              onClick={() => setIsTaskAlertsPanelOpen(false)}
              aria-label={isFrench ? "Fermer les alertes" : "Close alerts"}
            >
              <CloseIcon />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {isTaskAlertsLoading ? (
              <p className="rounded-xl border border-line bg-surface-soft px-3 py-2 text-sm text-muted">
                {isFrench ? "Chargement des alertes..." : "Loading alerts..."}
              </p>
            ) : null}

            {taskAlertsErrorMessage ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {taskAlertsErrorMessage}
              </p>
            ) : null}

            {!isTaskAlertsLoading && !taskAlertsErrorMessage && alertPanelItems.length ? (
              alertPanelItems.map((item) =>
                item.sourceType === "task" ? (
                  <button
                    key={item.task.id}
                    type="button"
                    className="w-full rounded-2xl border border-line bg-surface-soft/60 px-3.5 py-3 text-left transition-colors hover:border-accent/30 hover:bg-surface-soft"
                    onClick={() => {
                      setIsTaskAlertsPanelOpen(false);

                      if (item.task.targetDate === selectedDate) {
                        openEditTaskDialog(item.task);
                        return;
                      }

                      handleDateChange(item.task.targetDate);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${alertSourceChipClassByType.task}`}
                          >
                            {formatAlertSourceLabel("task", activeLocale)}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${alertUrgencyChipClassByUrgency[item.urgency]}`}
                          >
                            {formatAlertUrgencyLabel(item.urgency, activeLocale)}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold text-foreground">{item.task.title}</p>
                        <p className="mt-1 text-xs text-muted">
                          {item.task.dueDate
                            ? `${formatDateOnlyForLocale(item.task.dueDate, activeLocale)}`
                            : isFrench
                            ? "Aucune date d'echeance"
                            : "No due date"}
                        </p>
                        <p className="mt-1 text-[11px] text-muted">
                          {isFrench ? "Planifiee" : "Scheduled"} {formatDateOnlyForLocale(item.task.targetDate, activeLocale)}
                          {item.task.project ? ` · ${item.task.project}` : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${priorityChipClassByPriority[item.task.priority]}`}
                      >
                        {formatPriority(item.task.priority, activeLocale)}
                      </span>
                    </div>
                  </button>
                ) : (
                  <article
                    key={item.reminder.id}
                    className="rounded-2xl border border-line bg-surface-soft/60 px-3.5 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setIsTaskAlertsPanelOpen(false);
                          openEditReminderDialog(item.reminder);
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${alertSourceChipClassByType.reminder}`}
                          >
                            {formatAlertSourceLabel("reminder", activeLocale)}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${alertUrgencyChipClassByUrgency[item.urgency]}`}
                          >
                            {formatAlertUrgencyLabel(item.urgency, activeLocale)}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold text-foreground">{item.reminder.title}</p>
                        <p className="mt-1 text-xs text-muted">
                          {`${formatTaskAlertDueLabel(
                            formatDateInputForTimeZone(new Date(item.reminder.remindAt), activeTimeZone),
                            taskAlertsAnchorDate,
                            activeLocale
                          )} · ${formatDateTime(item.reminder.remindAt, activeLocale, activeTimeZone)}`}
                        </p>
                        <p className="mt-1 text-[11px] text-muted">
                          {[item.reminder.project, item.reminder.assignees].filter(Boolean).join(" · ") ||
                            (isFrench ? "Rappel actif" : "Active reminder")}
                        </p>
                      </button>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${reminderStatusChipClassByStatus[item.reminder.status]}`}
                      >
                        {formatReminderStatus(item.reminder.status, activeLocale)}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end gap-1.5">
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
                        onClick={() => { void handleCompleteReminder(item.reminder.id); }}
                      >
                        {isFrench ? "Traiter" : "Complete"}
                      </button>
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-surface hover:text-foreground"
                        onClick={() => { void handleCancelReminder(item.reminder.id); }}
                      >
                        {isFrench ? "Annuler" : "Cancel"}
                      </button>
                    </div>
                  </article>
                )
              )
            ) : null}

            {!isTaskAlertsLoading && !taskAlertsErrorMessage && alertPanelItems.length === 0 ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {isFrench
                  ? "Aucune alerte active en retard, aujourd'hui ou demain."
                  : "No active alerts overdue, today, or tomorrow."}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {isAssistantPanelOpen ? (
        <section className="animate-scale-in fixed bottom-24 left-4 right-4 z-40 flex max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:left-auto sm:right-6 sm:w-[400px]">
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2l1.5 3h3l-2.5 2.5.8 3L8 9l-2.8 1.5.8-3L3.5 5h3z"/></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isFrench ? "Assistant IA" : "AI Assistant"}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
              onClick={() => setIsAssistantPanelOpen(false)}
              disabled={isAssistantLoading}
              aria-label={isFrench ? "Fermer l'assistant IA" : "Close AI assistant"}
            >
              <CloseIcon />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {assistantMessages.length === 0 ? (
              <p className="text-center text-sm text-muted">
                {isFrench
                  ? "Posez vos questions sur vos taches, vos commentaires et vos priorites."
                  : "Ask about your tasks, comments, and priorities."}
              </p>
            ) : (
              <>
                {assistantMessages.map((message) => {
                  const isUserMessage = message.role === "user";
                  const hasAssistantMetadata =
                    !isUserMessage &&
                    (Boolean(message.source) ||
                      typeof message.usedTaskCount === "number" ||
                      typeof message.usedCommentCount === "number");

                  return (
                    <article
                      key={message.id}
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                        isUserMessage
                          ? "ml-auto bg-accent text-white rounded-br-md"
                          : "bg-surface-soft text-foreground rounded-bl-md"
                      }`}
                    >
                      {isUserMessage ? (
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      ) : (
                        <div className="space-y-2">
                          <RichTextContent
                            value={message.content}
                            className="text-sm leading-6 [&_p]:m-0 [&_p+p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-1 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-1 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-1 [&_h3]:mb-1 [&_code]:rounded [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2"
                          />

                          {message.warning ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                              {message.warning}
                            </div>
                          ) : null}

                          {hasAssistantMetadata ? (
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                              {message.source ? (
                                <span className="rounded-full border border-line bg-surface px-2 py-0.5 font-medium text-foreground">
                                  {formatAssistantSourceLabel(message.source, activeLocale)}
                                </span>
                              ) : null}
                              {typeof message.usedTaskCount === "number" ? (
                                <span className="rounded-full border border-line bg-surface px-2 py-0.5">
                                  {isFrench
                                    ? `${message.usedTaskCount} taches`
                                    : `${message.usedTaskCount} tasks`}
                                </span>
                              ) : null}
                              {typeof message.usedCommentCount === "number" ? (
                                <span className="rounded-full border border-line bg-surface px-2 py-0.5">
                                  {isFrench
                                    ? `${message.usedCommentCount} commentaires`
                                    : `${message.usedCommentCount} comments`}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )}

                      <p className={`mt-2 text-[10px] ${isUserMessage ? "text-white/60" : "text-muted"}`}>
                        {formatDateTime(message.timestamp, activeLocale, activeTimeZone)}
                      </p>
                    </article>
                  );
                })}
                <div ref={assistantMessagesEndRef} />
              </>
            )}
          </div>

          <div className="border-t border-line px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {assistantPromptSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1 text-[11px] text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                  onClick={() => {
                    setAssistantQuestion(prompt);
                    setAssistantErrorMessage(null);
                  }}
                  disabled={isAssistantLoading}
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 1l1 2.5h2.5l-2 1.5.8 2.5L6 6l-2.3 1.5.8-2.5-2-1.5H5z"/></svg>
                  {prompt.length > 40 ? prompt.slice(0, 40) + "..." : prompt}
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
                className="w-full rounded-lg border border-line bg-surface-soft px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15"
                maxLength={ASSISTANT_QUESTION_MAX_LENGTH}
                placeholder={isFrench ? "Posez une question..." : "Ask a question..."}
                disabled={isAssistantLoading}
              />
              <button
                type="submit"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-all hover:bg-accent-strong disabled:opacity-50"
                disabled={isAssistantLoading}
              >
                <SendIcon />
              </button>
            </form>

            {assistantErrorMessage ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {assistantErrorMessage}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="animate-pulse-soft fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        onClick={() => {
          setIsTaskAlertsPanelOpen(false);
          setIsAssistantPanelOpen((isOpen) => !isOpen);
        }}
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
        <ChatIcon />
      </button>

      {pendingReminders.length > 0 ? (
        <div className="fixed bottom-24 right-6 z-50 flex max-w-sm flex-col gap-2">
          {pendingReminders.map((reminder) => {
            const remindAtDate = new Date(reminder.remindAt);
            const timeStr = remindAtDate.toLocaleTimeString(isFrench ? "fr-FR" : "en-US", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: activeTimeZone ?? undefined,
            });
            return (
              <div
                key={reminder.id}
                className="animate-scale-in flex items-start gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3 shadow-lg"
              >
                <span className="mt-0.5 shrink-0 text-amber-500">
                  <BellIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{reminder.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{timeStr}</span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${reminderStatusChipClassByStatus[reminder.status]}`}
                    >
                      {formatReminderStatus(reminder.status, activeLocale)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
                    onClick={() => { void handleCompleteReminder(reminder.id); }}
                  >
                    {isFrench ? "Traiter" : "Complete"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-surface-soft hover:text-foreground"
                    onClick={() => { void handleCancelReminder(reminder.id); }}
                  >
                    {isFrench ? "Annuler" : "Cancel"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
    </div>
  );
}
