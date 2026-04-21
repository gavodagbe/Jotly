"use client";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type DragEvent as ReactDragEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_TAGLINE } from "@/lib/app-meta";
import { RichTextEditor, RichTextContent } from "@/components/ui/RichTextEditor";
import { isHtmlContent, isRichTextEmpty, getRichTextCharacterCount, sanitizeRichTextHtml, stripRichTextToPlainText } from "@/lib/rich-text";
import { controlButtonClass, primaryButtonClass, dangerButtonClass, textFieldClass, boardFilterFieldClass, sectionHeaderClass, iconButtonClass, controlIconButtonClass } from "@/components/ui/constants";
import { CollapseChevronIcon, DragHandleIcon, ArrowLeftIcon, ArrowRightIcon, CalendarIcon, CopyIcon, SearchIcon, PlusIcon, SaveIcon, PencilIcon, TrashIcon, CloseIcon, LayoutToggleIcon } from "@/components/ui/icons";
import { ReminderDialog } from "@/components/dialogs/ReminderDialog";
import { ProfileDialog } from "@/components/dialogs/ProfileDialog";
import { GlobalSearchModal } from "@/components/dialogs/GlobalSearchModal";
import { DeleteTaskDialog, NavigationBlockersDialog } from "@/components/dialogs/SystemDialogs";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { ActiveSectionIndicator, SectionIdentityPills, getMainContentSectionClass } from "@/components/layout/section-navigation";
import { AssistantFab, AssistantPanel } from "@/components/panels/AssistantPanel";
import { PendingReminderToasts } from "@/components/panels/PendingReminderToasts";
import { TaskAlertsPanel } from "@/components/panels/TaskAlertsPanel";
import { ProjectPlanningView } from "@/components/projects/ProjectPlanningView";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { TaskCard, TaskColumn } from "@/components/tasks/TaskBoardParts";

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
  assignees: string | null;
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
  assignees: string | null;
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

type WeeklyEntry = {
  id: string;
  year: number;
  isoWeek: number;
  objective: string | null;
  review: string | null;
  createdAt: string;
  updatedAt: string;
};

type MonthlyEntry = {
  id: string;
  year: number;
  month: number;
  objective: string | null;
  review: string | null;
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
  requireDailyAffirmation: boolean;
  requireDailyBilan: boolean;
  requireWeeklySynthesis: boolean;
  requireMonthlySynthesis: boolean;
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
  requireDailyAffirmation: boolean;
  requireDailyBilan: boolean;
  requireWeeklySynthesis: boolean;
  requireMonthlySynthesis: boolean;
};

type ProfileMutationInput = {
  displayName: string | null;
  preferredLocale: UserLocale;
  preferredTimeZone: string | null;
  requireDailyAffirmation: boolean;
  requireDailyBilan: boolean;
  requireWeeklySynthesis: boolean;
  requireMonthlySynthesis: boolean;
};

type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  targetDate: string;
  dueDate: string;
  priority: TaskPriority;
  project: string;
  assignees: string;
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
  | "noteAttachment"
  | "weeklyObjective"
  | "weeklyReview"
  | "monthlyObjective"
  | "monthlyReview";

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
const ASSIGNEE_OPTIONS_STORAGE_KEY = "jotly_assignee_options";
const MAX_ATTACHMENT_UPLOAD_BYTES = 5 * 1024 * 1024;
const ASSISTANT_QUESTION_MAX_LENGTH = 3000;
const DAY_AFFIRMATION_MAX_LENGTH = 5000;
const DAY_AFFIRMATION_RICH_TEXT_OPTIONS = {
  preserveTextColor: false,
  recoverPlainText: true,
};
const DAY_BILAN_FIELD_MAX_LENGTH = 10000;
const DASHBOARD_LAYOUT_STORAGE_KEY = "jotly_dashboard_layout_v2";
const DEFAULT_TASK_FILTER_VALUES: TaskFilterValues = {
  query: "",
  status: "all",
  priority: "all",
  project: "",
};
const DASHBOARD_BLOCK_IDS: ReadonlyArray<DashboardBlockId> = [
  "overview",
  "dailyControls",
  "affirmation",
  "reminders",
  "bilan",
  "board",
  "notes",
  "gamingTrack",
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

function getISOWeekYear(date: Date): { year: number; week: number } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() === 0 ? 7 : d.getDay(); // Mon=1 ... Sun=7
  d.setDate(d.getDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getFullYear(), week };
}

function isMonday(date: Date): boolean {
  return date.getDay() === 1;
}

function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

function isFirstDayOfMonth(date: Date): boolean {
  return date.getDate() === 1;
}

function isLastDayOfMonth(date: Date): boolean {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getDate() === 1;
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

function parseStoredAssigneeOptions(rawValue: string | null): string[] {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

function parseAssignees(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function formatAssignees(list: string[]): string {
  return list.join(", ");
}

function areStringListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}


function normalizeAffirmationText(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (!isHtmlContent(trimmed)) {
    return trimmed;
  }

  const sanitized = sanitizeRichTextHtml(trimmed, {
    preserveTextColor: false,
  });

  if (!isRichTextEmpty(sanitized)) {
    return sanitized;
  }

  return stripRichTextToPlainText(trimmed);
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
    assignees: "",
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
    assignees: task.assignees ?? "",
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
      assignees: normalizeOptionalTextInput(values.assignees),
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
    requireDailyAffirmation: false,
    requireDailyBilan: false,
    requireWeeklySynthesis: false,
    requireMonthlySynthesis: false,
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
    requireDailyAffirmation: user.requireDailyAffirmation ?? false,
    requireDailyBilan: user.requireDailyBilan ?? false,
    requireWeeklySynthesis: user.requireWeeklySynthesis ?? false,
    requireMonthlySynthesis: user.requireMonthlySynthesis ?? false,
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

async function compressImageDataUrl(
  dataUrl: string,
  maxDimension = 1024,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
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

async function extractAffirmationTextFromImage(
  imageDataUrl: string,
  locale: "en" | "fr",
  date: string,
  token: string
): Promise<{ text: string; status: string; warning: string | null }> {
  const response = await fetch("/backend-api/day-affirmation/extract-text", {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({ imageDataUrl, locale, date }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { text: string; status: string; warning: string | null }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to extract text from image"));
  }

  if (!payload?.data) {
    throw new Error("Invalid response from OCR endpoint");
  }

  return payload.data;
}

async function reformatAffirmationText(
  text: string,
  instruction: string | undefined,
  locale: "en" | "fr",
  date: string,
  token: string
): Promise<string> {
  const response = await fetch("/backend-api/day-affirmation/reformat", {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({ text, instruction: instruction || undefined, locale, date }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { text: string }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to reformat text"));
  }

  if (!payload?.data?.text) {
    throw new Error("AI returned an empty response");
  }

  return payload.data.text;
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

async function loadNotes(token: string, date?: string, signal?: AbortSignal): Promise<Note[]> {
  const url = date ? `/backend-api/notes?date=${encodeURIComponent(date)}` : "/backend-api/notes";
  const response = await fetch(url, {
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

async function loadRemoteAssignees(token: string): Promise<string[]> {
  try {
    const response = await fetch("/backend-api/assignees", {
      method: "GET",
      headers: createAuthHeaders(token, false),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | { data?: string[] }
      | null;
    return Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    return [];
  }
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

async function loadWeeklyEntry(
  year: number,
  week: number,
  token: string,
  signal?: AbortSignal
): Promise<WeeklyEntry | null> {
  const response = await fetch(
    `/backend-api/weekly-entry?year=${year}&week=${week}`,
    {
      method: "GET",
      headers: createAuthHeaders(token, false),
      signal,
      cache: "no-store",
    }
  );
  const payload = (await response.json().catch(() => null)) as
    | { data?: WeeklyEntry | null; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load weekly entry"));
  }
  return payload?.data ?? null;
}

async function upsertWeeklyEntry(
  input: { year: number; week: number; objective?: string | null; review?: string | null },
  token: string
): Promise<WeeklyEntry> {
  const response = await fetch("/backend-api/weekly-entry", {
    method: "PUT",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: WeeklyEntry; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to save weekly entry"));
  }
  if (!payload?.data) {
    throw new Error("Unable to save weekly entry.");
  }
  return payload.data;
}

async function loadMonthlyEntry(
  year: number,
  month: number,
  token: string,
  signal?: AbortSignal
): Promise<MonthlyEntry | null> {
  const response = await fetch(
    `/backend-api/monthly-entry?year=${year}&month=${month}`,
    {
      method: "GET",
      headers: createAuthHeaders(token, false),
      signal,
      cache: "no-store",
    }
  );
  const payload = (await response.json().catch(() => null)) as
    | { data?: MonthlyEntry | null; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load monthly entry"));
  }
  return payload?.data ?? null;
}

async function upsertMonthlyEntry(
  input: { year: number; month: number; objective?: string | null; review?: string | null },
  token: string
): Promise<MonthlyEntry> {
  const response = await fetch("/backend-api/monthly-entry", {
    method: "PUT",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: MonthlyEntry; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to save monthly entry"));
  }
  if (!payload?.data) {
    throw new Error("Unable to save monthly entry.");
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

export function AppShell() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [guestLocale, setGuestLocale] = useState<UserLocale>("en");
  const [activeSectionId, setActiveSectionId] = useState<string>("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("jotly-sidebar-collapsed") === "true"; } catch { return false; }
  });
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
  const [affirmationRefreshKey, setAffirmationRefreshKey] = useState(0);
  const [isDayAffirmationLoading, setIsDayAffirmationLoading] = useState(false);
  const [isDayAffirmationSaving, setIsDayAffirmationSaving] = useState(false);
  const [dayAffirmationErrorMessage, setDayAffirmationErrorMessage] = useState<string | null>(null);
  const [isAffirmationOcrPanelOpen, setIsAffirmationOcrPanelOpen] = useState(false);
  const [affirmationOcrImagePreview, setAffirmationOcrImagePreview] = useState<string | null>(null);
  const [affirmationOcrExtractedText, setAffirmationOcrExtractedText] = useState("");
  const [affirmationOcrReformattedText, setAffirmationOcrReformattedText] = useState("");
  const [affirmationOcrCustomInstruction, setAffirmationOcrCustomInstruction] = useState("");
  const [isAffirmationOcrExtracting, setIsAffirmationOcrExtracting] = useState(false);
  const [isAffirmationOcrReformatting, setIsAffirmationOcrReformatting] = useState(false);
  const [affirmationOcrError, setAffirmationOcrError] = useState<string | null>(null);
  const [dayBilan, setDayBilan] = useState<DayBilan | null>(null);
  const [dayBilanFormValues, setDayBilanFormValues] = useState<DayBilanFormValues>(
    getDefaultDayBilanFormValues
  );
  const [isDayBilanLoading, setIsDayBilanLoading] = useState(false);
  const [isDayBilanSaving, setIsDayBilanSaving] = useState(false);
  const [dayBilanErrorMessage, setDayBilanErrorMessage] = useState<string | null>(null);
  const [dayBilanSuccessMessage, setDayBilanSuccessMessage] = useState<string | null>(null);
  const [weeklyEntry, setWeeklyEntry] = useState<WeeklyEntry | null>(null);
  const [weeklyObjective, setWeeklyObjective] = useState<string>("");
  const [weeklyReview, setWeeklyReview] = useState<string>("");
  const [weeklyEntryErrorMessage, setWeeklyEntryErrorMessage] = useState<string | null>(null);
  const [monthlyEntry, setMonthlyEntry] = useState<MonthlyEntry | null>(null);
  const [monthlyObjective, setMonthlyObjective] = useState<string>("");
  const [monthlyReview, setMonthlyReview] = useState<string>("");
  const [monthlyEntryErrorMessage, setMonthlyEntryErrorMessage] = useState<string | null>(null);
  const [navigationBlockers, setNavigationBlockers] = useState<string[]>([]);
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
    const normalizedAffirmation = nextAffirmation
      ? {
          ...nextAffirmation,
          text: normalizeAffirmationText(nextAffirmation.text),
        }
      : null;

    setDayAffirmation(normalizedAffirmation);
    updateDayAffirmationDraft(normalizedAffirmation?.text ?? "");
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

  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [newAssigneeDraft, setNewAssigneeDraft] = useState("");

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

  const selectedTaskAssignees = useMemo(
    () => parseAssignees(taskFormValues.assignees),
    [taskFormValues.assignees]
  );

  const selectedReminderAssignees = useMemo(
    () => parseAssignees(reminderFormValues.assignees),
    [reminderFormValues.assignees]
  );

  const taskDialogHeightClass = taskDialogMode === "edit" ? "max-h-[76vh]" : "max-h-[82vh]";
  const noteDialogHeightClass = noteDialogMode === "edit" ? "max-h-[82vh]" : "max-h-[76vh]";

  const saveProjectOptions = useCallback((values: string[]) => {
    const nextOptions = getUniqueSortedProjectNames(values);
    setProjectOptions(nextOptions);
    window.localStorage.setItem(PROJECT_OPTIONS_STORAGE_KEY, JSON.stringify(nextOptions));
    return nextOptions;
  }, []);

  const saveAssigneeOptions = useCallback((values: string[]) => {
    const nextOptions = [...new Set(values.filter((v) => v.trim().length > 0))].sort((a, b) =>
      a.localeCompare(b)
    );
    setAssigneeOptions(nextOptions);
    try {
      window.localStorage.setItem(ASSIGNEE_OPTIONS_STORAGE_KEY, JSON.stringify(nextOptions));
    } catch {
      // localStorage quota exceeded — in-memory state still updated
    }
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
          requireDailyAffirmation: profileFormValues.requireDailyAffirmation,
          requireDailyBilan: profileFormValues.requireDailyBilan,
          requireWeeklySynthesis: profileFormValues.requireWeeklySynthesis,
          requireMonthlySynthesis: profileFormValues.requireMonthlySynthesis,
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
    const defaultAssignee = (authUser?.displayName || authUser?.email || "").trim();
    setTaskDialogMode("create");
    setEditingTaskId(null);
    setTaskFormValues({
      ...getDefaultTaskFormValues(selectedDate),
      status: initialStatus,
      assignees: defaultAssignee,
      ...overrides,
    });
    setRecurrenceFormValues(getDefaultRecurrenceFormValues());
    setTaskFormErrorMessage(null);
    setProjectFormErrorMessage(null);
    setNewProjectDraft("");
    setNewAssigneeDraft("");
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

  function getDateChangeBlockers(date: string): string[] {
    const dateObj = parseDateInput(date);
    const blockers: string[] = [];

    if (authUser?.requireDailyAffirmation && !dayAffirmation?.isCompleted) {
      blockers.push(isFrench ? "Affirmation du jour non complétée" : "Daily affirmation not completed");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPastDay = dateObj < today;
    if (authUser?.requireDailyBilan && isPastDay) {
      const bilanFilled =
        dayBilan &&
        (dayBilan.mood !== null ||
          (dayBilan.wins ? !isRichTextEmpty(dayBilan.wins) : false) ||
          (dayBilan.blockers ? !isRichTextEmpty(dayBilan.blockers) : false) ||
          (dayBilan.lessonsLearned ? !isRichTextEmpty(dayBilan.lessonsLearned) : false) ||
          (dayBilan.tomorrowTop3 ? !isRichTextEmpty(dayBilan.tomorrowTop3) : false));
      if (!bilanFilled) {
        blockers.push(isFrench ? "Bilan du jour non renseigné" : "Daily review not filled");
      }
    }

    if (authUser?.requireWeeklySynthesis && isMonday(dateObj) && (!weeklyObjective || isRichTextEmpty(weeklyObjective))) {
      blockers.push(isFrench ? "Objectif de la semaine non renseigné" : "Weekly objective not set");
    }

    if (authUser?.requireWeeklySynthesis && isSunday(dateObj) && (!weeklyReview || isRichTextEmpty(weeklyReview))) {
      blockers.push(isFrench ? "Bilan de la semaine non renseigné" : "Weekly review not filled");
    }

    if (authUser?.requireMonthlySynthesis && isLastDayOfMonth(dateObj) && (!monthlyReview || isRichTextEmpty(monthlyReview))) {
      blockers.push(isFrench ? "Bilan du mois non renseigné" : "Monthly review not filled");
    }

    return blockers;
  }

  function handleDateChange(nextDate: string) {
    if (nextDate === selectedDate) {
      return;
    }

    const blockers = getDateChangeBlockers(selectedDate);
    if (blockers.length > 0) {
      setNavigationBlockers(blockers);
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
    setWeeklyEntry(null);
    setWeeklyObjective("");
    setWeeklyReview("");
    setWeeklyEntryErrorMessage(null);
    setMonthlyEntry(null);
    setMonthlyObjective("");
    setMonthlyReview("");
    setMonthlyEntryErrorMessage(null);
    setNavigationBlockers([]);
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
    const normalizedText = normalizeAffirmationText(nextTextCandidate);
    const affirmationCharacterCount = getRichTextCharacterCount(normalizedText);
    const nextCompletion = options?.isCompleted ?? dayAffirmation?.isCompleted ?? false;

    if (affirmationCharacterCount === 0) {
      setDayAffirmationErrorMessage(
        isFrench
          ? "Veuillez saisir votre affirmation avant d'enregistrer."
          : "Enter your affirmation before saving."
      );
      return;
    }

    if (affirmationCharacterCount > DAY_AFFIRMATION_MAX_LENGTH) {
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

  async function handleSaveWeeklyObjective() {
    if (!authToken) return;
    const dateObj = parseDateInput(selectedDate);
    const { year, week } = getISOWeekYear(dateObj);
    try {
      const saved = await upsertWeeklyEntry({ year, week, objective: weeklyObjective }, authToken);
      setWeeklyEntry(saved);
      setWeeklyObjective(saved.objective ?? "");
    } catch (error) {
      setWeeklyEntryErrorMessage(
        error instanceof Error ? error.message : isFrench ? "Impossible d'enregistrer l'objectif hebdomadaire." : "Unable to save weekly objective."
      );
    }
  }

  async function handleSaveWeeklyReview() {
    if (!authToken) return;
    const dateObj = parseDateInput(selectedDate);
    const { year, week } = getISOWeekYear(dateObj);
    try {
      const saved = await upsertWeeklyEntry({ year, week, review: weeklyReview }, authToken);
      setWeeklyEntry(saved);
      setWeeklyReview(saved.review ?? "");
    } catch (error) {
      setWeeklyEntryErrorMessage(
        error instanceof Error ? error.message : isFrench ? "Impossible d'enregistrer le bilan hebdomadaire." : "Unable to save weekly review."
      );
    }
  }

  async function handleSaveMonthlyObjective() {
    if (!authToken) return;
    const dateObj = parseDateInput(selectedDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    try {
      const saved = await upsertMonthlyEntry({ year, month, objective: monthlyObjective }, authToken);
      setMonthlyEntry(saved);
      setMonthlyObjective(saved.objective ?? "");
    } catch (error) {
      setMonthlyEntryErrorMessage(
        error instanceof Error ? error.message : isFrench ? "Impossible d'enregistrer l'objectif mensuel." : "Unable to save monthly objective."
      );
    }
  }

  async function handleSaveMonthlyReview() {
    if (!authToken) return;
    const dateObj = parseDateInput(selectedDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    try {
      const saved = await upsertMonthlyEntry({ year, month, review: monthlyReview }, authToken);
      setMonthlyEntry(saved);
      setMonthlyReview(saved.review ?? "");
    } catch (error) {
      setMonthlyEntryErrorMessage(
        error instanceof Error ? error.message : isFrench ? "Impossible d'enregistrer le bilan mensuel." : "Unable to save monthly review."
      );
    }
  }

  function getDefaultReminderFormValues(): ReminderFormValues {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const defaultAssignee = (authUser?.displayName || authUser?.email || "").trim();
    return { title: "", description: "", project: "", assignees: defaultAssignee, remindAt: localIso };
  }

  function openCreateReminderDialog() {
    setReminderDialogMode("create");
    setEditingReminderId(null);
    setReminderFormValues(getDefaultReminderFormValues());
    setReminderErrorMessage(null);
    setNewAssigneeDraft("");
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

  function handleAddNewAssigneeToTask() {
    const normalized = newAssigneeDraft.trim();
    if (!normalized) return;
    if (!assigneeOptions.includes(normalized)) {
      saveAssigneeOptions([...assigneeOptions, normalized]);
    }
    if (!selectedTaskAssignees.includes(normalized)) {
      updateTaskFormField("assignees", formatAssignees([...selectedTaskAssignees, normalized]));
    }
    setNewAssigneeDraft("");
  }

  function handleAddNewAssigneeToReminder() {
    const normalized = newAssigneeDraft.trim();
    if (!normalized) return;
    if (!assigneeOptions.includes(normalized)) {
      saveAssigneeOptions([...assigneeOptions, normalized]);
    }
    if (!selectedReminderAssignees.includes(normalized)) {
      setReminderFormValues((v) => ({
        ...v,
        assignees: formatAssignees([...selectedReminderAssignees, normalized]),
      }));
    }
    setNewAssigneeDraft("");
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

      if (isProjectPlanningOpen) {
        await fetchAllProjectTasks();
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
    const sectionIds = [
      "overview", "board", "dailyControls", "affirmation", "reminders",
      "bilan", "monthlyObjective", "monthlyReview", "weeklyObjective", "weeklyReview",
      "notes", "gaming",
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio that is actually intersecting
        const mostVisible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (mostVisible) {
          setActiveSectionId(mostVisible.target.id);
        }
      },
      { threshold: [0.1, 0.25, 0.5, 0.75, 0.9], rootMargin: "-80px 0px -20% 0px" }
    );
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [authUser]);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const storedProjectOptions = parseStoredProjectOptions(
      window.localStorage.getItem(PROJECT_OPTIONS_STORAGE_KEY)
    );
    const storedAssigneeOptions = parseStoredAssigneeOptions(
      window.localStorage.getItem(ASSIGNEE_OPTIONS_STORAGE_KEY)
    );

    setAuthToken(storedToken);
    setProjectOptions(storedProjectOptions);
    setAssigneeOptions(storedAssigneeOptions);
    setIsAuthReady(true);
  }, []);

  useEffect(() => {
    if (!authUser || !authToken) return;
    const label = (authUser.displayName || authUser.email).trim();

    // Ensure current user is always in the list
    if (label) {
      setAssigneeOptions((current) => {
        if (current.includes(label)) return current;
        const next = [...new Set([...current, label])].sort((a, b) => a.localeCompare(b));
        try { window.localStorage.setItem(ASSIGNEE_OPTIONS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    }

    // Seed from existing tasks & reminders in the database
    void loadRemoteAssignees(authToken).then((serverAssignees) => {
      if (serverAssignees.length === 0) return;
      setAssigneeOptions((current) => {
        const merged = [...new Set([...current, ...serverAssignees])].sort((a, b) => a.localeCompare(b));
        if (merged.length === current.length && merged.every((v, i) => v === current[i])) return current;
        try { window.localStorage.setItem(ASSIGNEE_OPTIONS_STORAGE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
        return merged;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

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

    loadNotes(authToken, selectedDate, controller.signal)
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
  }, [authToken, authUser, isAuthReady, selectedDate]);

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

  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        delete dayAffirmationCacheRef.current[selectedDateRef.current];
        setAffirmationRefreshKey((k) => k + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

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
  }, [affirmationRefreshKey, applyDayAffirmationState, authToken, authUser, isAuthReady, isFrench, selectedDate]);

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
    if (!authToken || !authUser || !isAuthReady) {
      return;
    }

    const dateObj = parseDateInput(selectedDate);
    const { year, week } = getISOWeekYear(dateObj);
    const controller = new AbortController();

    setWeeklyEntryErrorMessage(null);
    loadWeeklyEntry(year, week, authToken, controller.signal)
      .then((entry) => {
        if (controller.signal.aborted) return;
        setWeeklyEntry(entry);
        setWeeklyObjective(entry?.objective ?? "");
        setWeeklyReview(entry?.review ?? "");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setWeeklyEntryErrorMessage(
          error instanceof Error ? error.message : isFrench ? "Impossible de charger l'entrée hebdomadaire." : "Unable to load weekly entry."
        );
      });

    return () => controller.abort();
  }, [authToken, authUser, isAuthReady, isFrench, selectedDate]);

  useEffect(() => {
    if (!authToken || !authUser || !isAuthReady) {
      return;
    }

    const dateObj = parseDateInput(selectedDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const controller = new AbortController();

    setMonthlyEntryErrorMessage(null);
    loadMonthlyEntry(year, month, authToken, controller.signal)
      .then((entry) => {
        if (controller.signal.aborted) return;
        setMonthlyEntry(entry);
        setMonthlyObjective(entry?.objective ?? "");
        setMonthlyReview(entry?.review ?? "");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setMonthlyEntryErrorMessage(
          error instanceof Error ? error.message : isFrench ? "Impossible de charger l'entrée mensuelle." : "Unable to load monthly entry."
        );
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
  const dayAffirmationCharacterCount = getRichTextCharacterCount(dayAffirmationDraft);
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
      case "weeklyObjective": {
        const targetDate = meta?.targetDate as string | undefined;
        navigateToSearchDate(targetDate);
        setTimeout(() => document.getElementById("weeklyObjective")?.scrollIntoView({ behavior: "smooth" }), 300);
        break;
      }
      case "weeklyReview": {
        const targetDate = meta?.targetDate as string | undefined;
        navigateToSearchDate(targetDate);
        setTimeout(() => document.getElementById("weeklyReview")?.scrollIntoView({ behavior: "smooth" }), 300);
        break;
      }
      case "monthlyObjective": {
        const targetDate = meta?.targetDate as string | undefined;
        navigateToSearchDate(targetDate);
        setTimeout(() => document.getElementById("monthlyObjective")?.scrollIntoView({ behavior: "smooth" }), 300);
        break;
      }
      case "monthlyReview": {
        const targetDate = meta?.targetDate as string | undefined;
        navigateToSearchDate(targetDate);
        setTimeout(() => document.getElementById("monthlyReview")?.scrollIntoView({ behavior: "smooth" }), 300);
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
        showMonthlyReview={isLastDayOfMonth(parseDateInput(selectedDate))}
        showWeeklyReview={isSunday(parseDateInput(selectedDate))}
        activeSectionId={activeSectionId}
        onSectionChange={setActiveSectionId}
        isProfileDialogOpen={isProfileDialogOpen}
        isAssistantPanelOpen={isAssistantPanelOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => {
          setIsSidebarCollapsed((prev) => {
            const next = !prev;
            try { localStorage.setItem("jotly-sidebar-collapsed", String(next)); } catch {}
            return next;
          });
        }}
      />

    {isProjectPlanningOpen ? (
      <ProjectPlanningView
        locale={activeLocale}
        tasks={allProjectTasks}
        isLoading={isLoadingAllTasks}
        isBusy={isMutationPending}
        errorMessage={allTasksErrorMessage}
        filters={projectPlanningFilters}
        sort={projectPlanningSort}
        viewMode={projectPlanningViewMode}
        projectOptions={projectOptions}
        onFilterChange={handleProjectPlanningFilterChange}
        onSortChange={handleProjectPlanningSort}
        onViewModeChange={setProjectPlanningViewMode}
        onClose={closeProjectPlanning}
        onCreateTask={() =>
          openCreateTaskDialog(
            isTaskStatus(projectPlanningFilters.status) ? projectPlanningFilters.status : "todo",
            {
              project: projectPlanningFilters.project,
            }
          )
        }
        onEditTask={(task) => {
          closeProjectPlanning();
          handleDateChange(task.targetDate);
          setTimeout(() => openEditTaskDialog(task), 100);
        }}
      />
    ) : null}

    <div className={`flex min-h-screen flex-col gap-6 px-4 py-6 pb-24 sm:px-8 lg:pb-8 lg:px-10 lg:py-8 ${isSidebarCollapsed ? "lg:ml-[56px]" : "lg:ml-[260px]"} transition-[margin] duration-200`}>
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

      <ActiveSectionIndicator activeSectionId={activeSectionId} locale={activeLocale} />

      <header
        id="overview"
        className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getMainContentSectionClass("overview", activeSectionId)} ${getDashboardDropClassName("overview")}`}
        style={{ order: getDashboardBlockVisualOrder("overview") }}
        onDragOver={(event) => handleDashboardBlockDragOver("overview", event)}
        onDrop={(event) => handleDashboardBlockDrop("overview", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionIdentityPills sectionId="overview" locale={activeLocale} isActive={activeSectionId === "overview"} />
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
        id="board"
        className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getMainContentSectionClass("board", activeSectionId)} ${getDashboardDropClassName("board")}`}
        style={{ order: getDashboardBlockVisualOrder("board"), animationDelay: "0.2s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("board", event)}
        onDrop={(event) => handleDashboardBlockDrop("board", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionIdentityPills sectionId="board" locale={activeLocale} isActive={activeSectionId === "board"} />
            <h2 className={sectionHeaderClass}>{isFrench ? "Tableau Kanban" : "Kanban Board"}</h2>
          </div>
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
                      className={`flex h-[480px] flex-col rounded-xl border-t-2 bg-surface-soft/50 px-3 py-3 ${statusColumnClassByStatus[column.status]}`}
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
                                formatPriority={formatPriority}
                                formatDateOnlyForLocale={formatDateOnlyForLocale}
                                formatPlannedTime={formatPlannedTime}
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

      <section id="dailyControls"
        className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getMainContentSectionClass("dailyControls", activeSectionId)} ${getDashboardDropClassName("dailyControls")}`}
        style={{ order: getDashboardBlockVisualOrder("dailyControls"), animationDelay: "0.1s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("dailyControls", event)}
        onDrop={(event) => handleDashboardBlockDrop("dailyControls", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionIdentityPills sectionId="dailyControls" locale={activeLocale} isActive={activeSectionId === "dailyControls"} />
            <h2 className={sectionHeaderClass}>
              {isFrench ? "Pilotage du jour" : "Day Controls"}
            </h2>
          </div>
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

      <section
        id="affirmation"
        className={`animate-fade-in-up overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50/50 via-surface to-violet-50/30 p-6 shadow-sm ${getMainContentSectionClass("affirmation", activeSectionId)} ${getDashboardDropClassName("affirmation")}`}
        style={{ order: getDashboardBlockVisualOrder("affirmation"), animationDelay: "0.15s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("affirmation", event)}
        onDrop={(event) => handleDashboardBlockDrop("affirmation", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionIdentityPills sectionId="affirmation" locale={activeLocale} isActive={activeSectionId === "affirmation"} />
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
            {!dashboardBlockCollapsed.affirmation ? (
              <button
                type="button"
                className={`${dashboardIconButtonClass} ${isAffirmationOcrPanelOpen ? "bg-indigo-100 text-indigo-600" : ""}`}
                onClick={() => {
                  setIsAffirmationOcrPanelOpen((prev) => !prev);
                  setAffirmationOcrError(null);
                  if (isAffirmationOcrPanelOpen) {
                    setAffirmationOcrImagePreview(null);
                    setAffirmationOcrExtractedText("");
                    setAffirmationOcrReformattedText("");
                    setAffirmationOcrCustomInstruction("");
                  }
                }}
                aria-label={isFrench ? "Photo vers affirmation" : "Photo to affirmation"}
                title={isFrench ? "Photo vers affirmation" : "Photo to affirmation"}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                  <path d="M2 7a2 2 0 012-2h1.5l1-2h7l1 2H16a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" strokeLinejoin="round"/>
                  <circle cx="10" cy="11" r="2.5"/>
                </svg>
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
            {isAffirmationOcrPanelOpen ? (
              <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  {isFrench ? "Photo → Texte → Affirmation" : "Photo → Text → Affirmation"}
                </p>

                {/* Step 1 — Image capture */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    {isFrench ? "1. Choisir une image" : "1. Choose an image"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label className={`${controlButtonClass} cursor-pointer`}>
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                        <path d="M2 7a2 2 0 012-2h1.5l1-2h7l1 2H16a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" strokeLinejoin="round"/>
                        <circle cx="10" cy="11" r="2.5"/>
                      </svg>
                      {isFrench ? "Prendre une photo" : "Take a photo"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setAffirmationOcrError(null);
                          setAffirmationOcrExtractedText("");
                          setAffirmationOcrReformattedText("");
                          const dataUrl = await readFileAsDataUrl(file);
                          setAffirmationOcrImagePreview(dataUrl);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <label className={`${controlButtonClass} cursor-pointer`}>
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                        <path d="M4 4h12v12H4z" strokeLinejoin="round"/>
                        <circle cx="7.5" cy="7.5" r="1.5"/>
                        <path d="M4 14l4-4 3 3 2-2 3 3" strokeLinejoin="round"/>
                      </svg>
                      {isFrench ? "Choisir un fichier" : "Choose a file"}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setAffirmationOcrError(null);
                          setAffirmationOcrExtractedText("");
                          setAffirmationOcrReformattedText("");
                          const dataUrl = await readFileAsDataUrl(file);
                          setAffirmationOcrImagePreview(dataUrl);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {affirmationOcrImagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={affirmationOcrImagePreview}
                        alt={isFrench ? "Aperçu" : "Preview"}
                        className="max-h-40 rounded-lg border border-indigo-200 object-contain shadow-sm"
                      />
                      <button
                        type="button"
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-line text-muted hover:bg-rose-100 hover:text-rose-600"
                        onClick={() => {
                          setAffirmationOcrImagePreview(null);
                          setAffirmationOcrExtractedText("");
                          setAffirmationOcrReformattedText("");
                          setAffirmationOcrError(null);
                        }}
                        aria-label={isFrench ? "Supprimer l'image" : "Remove image"}
                      >
                        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3">
                          <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Step 2 — OCR extract */}
                {affirmationOcrImagePreview ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-foreground">
                        {isFrench ? "2. Analyser avec l'IA" : "2. Analyze with AI"}
                      </p>
                      <button
                        type="button"
                        className={controlButtonClass}
                        disabled={isAffirmationOcrExtracting}
                        onClick={async () => {
                          if (!authToken || !affirmationOcrImagePreview) return;
                          setIsAffirmationOcrExtracting(true);
                          setAffirmationOcrError(null);
                          setAffirmationOcrReformattedText("");
                          try {
                            const compressedImage = await compressImageDataUrl(affirmationOcrImagePreview);
                            const result = await extractAffirmationTextFromImage(compressedImage, activeLocale, selectedDate, authToken);
                            if (result.status === "empty" || result.text.trim().length === 0) {
                              setAffirmationOcrError(
                                isFrench
                                  ? "Impossible d'analyser l'image. Essayez avec une image plus nette."
                                  : "Unable to analyze the image. Try a clearer image."
                              );
                            } else {
                              setAffirmationOcrExtractedText(result.text);
                              if (result.warning) setAffirmationOcrError(result.warning);
                            }
                          } catch (err) {
                            setAffirmationOcrError(
                              err instanceof Error ? err.message : (isFrench ? "Erreur OCR." : "OCR error.")
                            );
                          } finally {
                            setIsAffirmationOcrExtracting(false);
                          }
                        }}
                      >
                        {isAffirmationOcrExtracting ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                            </svg>
                            {isFrench ? "Analyse en cours..." : "Analyzing..."}
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                              <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zM7 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {isFrench ? "Analyser l'image" : "Analyze image"}
                          </>
                        )}
                      </button>
                    </div>
                    {affirmationOcrExtractedText ? (
                      <textarea
                        className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y min-h-[80px]"
                        value={affirmationOcrExtractedText}
                        onChange={(e) => {
                          setAffirmationOcrExtractedText(e.target.value);
                          setAffirmationOcrReformattedText("");
                        }}
                        placeholder={isFrench ? "Contenu structuré généré (modifiable)..." : "Generated structured content (editable)..."}
                      />
                    ) : null}
                  </div>
                ) : null}

                {/* Step 3 — AI reformat */}
                {affirmationOcrExtractedText ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">
                      {isFrench ? "3. Structurer avec l'IA" : "3. Structure with AI"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(isFrench
                        ? [
                            "Générer les 3 sections (citation / enseignements / exercices)",
                            "En faire une affirmation positive au présent",
                            "Reformuler en une phrase percutante",
                          ]
                        : [
                            "Generate the 3 sections (quote / lessons / exercises)",
                            "Turn into a positive present-tense affirmation",
                            "Rewrite as one impactful sentence",
                          ]
                      ).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            affirmationOcrCustomInstruction === preset
                              ? "border-indigo-400 bg-indigo-100 text-indigo-700"
                              : "border-line bg-surface text-muted hover:border-indigo-300 hover:text-indigo-600"
                          }`}
                          onClick={() =>
                            setAffirmationOcrCustomInstruction((prev) => (prev === preset ? "" : preset))
                          }
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      placeholder={
                        isFrench
                          ? "Ou saisissez une instruction personnalisee..."
                          : "Or type a custom instruction..."
                      }
                      value={affirmationOcrCustomInstruction}
                      onChange={(e) => setAffirmationOcrCustomInstruction(e.target.value)}
                    />
                    <button
                      type="button"
                      className={controlButtonClass}
                      disabled={isAffirmationOcrReformatting}
                      onClick={async () => {
                        if (!authToken || !affirmationOcrExtractedText.trim()) return;
                        setIsAffirmationOcrReformatting(true);
                        setAffirmationOcrError(null);
                        try {
                          const result = await reformatAffirmationText(
                            affirmationOcrExtractedText,
                            affirmationOcrCustomInstruction.trim() || undefined,
                            activeLocale,
                            selectedDate,
                            authToken
                          );
                          setAffirmationOcrReformattedText(result);
                        } catch (err) {
                          setAffirmationOcrError(
                            err instanceof Error ? err.message : (isFrench ? "Erreur IA." : "AI error.")
                          );
                        } finally {
                          setIsAffirmationOcrReformatting(false);
                        }
                      }}
                    >
                      {isAffirmationOcrReformatting ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                          </svg>
                          {isFrench ? "Traitement IA..." : "AI processing..."}
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                            <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" strokeLinejoin="round"/>
                          </svg>
                          {isFrench ? "Traiter avec l'IA" : "Process with AI"}
                        </>
                      )}
                    </button>
                    {affirmationOcrReformattedText ? (
                      <div className="rounded-lg border border-indigo-200 bg-white p-3 text-sm text-foreground">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
                          {isFrench ? "Résultat IA" : "AI result"}
                        </p>
                        <p className="whitespace-pre-wrap">{affirmationOcrReformattedText}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Error */}
                {affirmationOcrError ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {affirmationOcrError}
                  </p>
                ) : null}

                {/* Step 4 — Insert */}
                {(affirmationOcrExtractedText || affirmationOcrReformattedText) ? (
                  <div className="flex flex-wrap gap-2 border-t border-indigo-100 pt-3">
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => {
                        const textToInsert = affirmationOcrReformattedText || affirmationOcrExtractedText;
                        updateDayAffirmationDraft(textToInsert);
                        setDayAffirmationErrorMessage(null);
                        setIsAffirmationOcrPanelOpen(false);
                        setAffirmationOcrImagePreview(null);
                        setAffirmationOcrExtractedText("");
                        setAffirmationOcrReformattedText("");
                        setAffirmationOcrCustomInstruction("");
                        setAffirmationOcrError(null);
                      }}
                    >
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                        <path d="M4 10h12M10 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {isFrench ? "Insérer (remplacer)" : "Insert (replace)"}
                    </button>
                    <button
                      type="button"
                      className={controlButtonClass}
                      onClick={() => {
                        const textToAppend = affirmationOcrReformattedText || affirmationOcrExtractedText;
                        const current = dayAffirmationDraftRef.current.trim();
                        updateDayAffirmationDraft(current ? `${current}\n\n${textToAppend}` : textToAppend);
                        setDayAffirmationErrorMessage(null);
                        setIsAffirmationOcrPanelOpen(false);
                        setAffirmationOcrImagePreview(null);
                        setAffirmationOcrExtractedText("");
                        setAffirmationOcrReformattedText("");
                        setAffirmationOcrCustomInstruction("");
                        setAffirmationOcrError(null);
                      }}
                    >
                      {isFrench ? "Ajouter a la fin" : "Append to end"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <div className="block text-sm font-semibold text-foreground">
                <span>{isFrench ? "Phrase du jour" : "Today statement"}</span>
                <RichTextEditor
                  key={dayAffirmation?.id ?? selectedDate}
                  locale={activeLocale}
                  value={dayAffirmationDraft}
                  onChange={(nextValue) => {
                    updateDayAffirmationDraft(nextValue);
                    setDayAffirmationErrorMessage(null);
                  }}
                  disabled={isDayAffirmationLoading || isDayAffirmationSaving}
                  allowTextColor={false}
                  renderOptions={DAY_AFFIRMATION_RICH_TEXT_OPTIONS}
                  contentClassName="max-h-[200px] overflow-y-auto"
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
                {dayAffirmationCharacterCount}/{DAY_AFFIRMATION_MAX_LENGTH}
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
        className={`animate-fade-in-up overflow-hidden rounded-xl bg-gradient-to-br from-amber-50/40 via-surface to-orange-50/30 p-6 shadow-sm ${getMainContentSectionClass("reminders", activeSectionId)} ${getDashboardDropClassName("reminders")}`}
        style={{ order: getDashboardBlockVisualOrder("reminders"), animationDelay: "0.18s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("reminders", event)}
        onDrop={(event) => handleDashboardBlockDrop("reminders", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionIdentityPills sectionId="reminders" locale={activeLocale} isActive={activeSectionId === "reminders"} />
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

      <section
        id="bilan"
        className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getMainContentSectionClass("bilan", activeSectionId)} ${getDashboardDropClassName("bilan")}`}
        style={{ order: getDashboardBlockVisualOrder("bilan"), animationDelay: "0.25s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("bilan", event)}
        onDrop={(event) => handleDashboardBlockDrop("bilan", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionIdentityPills sectionId="bilan" locale={activeLocale} isActive={activeSectionId === "bilan"} />
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
                      contentClassName="max-h-[160px] overflow-y-auto"
                    />
                  </div>
                  <div className="block text-sm font-semibold text-foreground">
                    <span>{isFrench ? "Blocages" : "Blockers"}</span>
                    <RichTextEditor
                      locale={activeLocale}
                      value={dayBilanFormValues.blockers}
                      onChange={(nextValue) => updateDayBilanField("blockers", nextValue)}
                      disabled={isDayBilanSaving}
                      contentClassName="max-h-[160px] overflow-y-auto"
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
                      contentClassName="max-h-[160px] overflow-y-auto"
                    />
                  </div>
                  <div className="block text-sm font-semibold text-foreground">
                    <span>{isFrench ? "Top 3 de demain" : "Tomorrow top 3"}</span>
                    <RichTextEditor
                      locale={activeLocale}
                      value={dayBilanFormValues.tomorrowTop3}
                      onChange={(nextValue) => updateDayBilanField("tomorrowTop3", nextValue)}
                      disabled={isDayBilanSaving}
                      contentClassName="max-h-[160px] overflow-y-auto"
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

      {(() => {
        const selectedDateObj = parseDateInput(selectedDate);
        const showMonthlyObjective = true;
        const showMonthlyReview = isLastDayOfMonth(selectedDateObj);
        const showWeeklyObjective = true;
        const showWeeklyReview = isSunday(selectedDateObj);
        const monthNames = isFrench
          ? ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]
          : ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const monthLabel = monthNames[selectedDateObj.getMonth()];

        return (
          <>
            {showMonthlyObjective ? (
              <section
                id="monthlyObjective"
                className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getMainContentSectionClass("monthlyObjective", activeSectionId)}`}
                style={{ order: 43 }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <SectionIdentityPills sectionId="monthlyObjective" locale={activeLocale} isActive={activeSectionId === "monthlyObjective"} />
                    <h2 className={sectionHeaderClass}>
                      {isFrench ? `Objectif de ${monthLabel}` : `${monthLabel} Objective`}
                    </h2>
                    <p className="text-sm text-muted">
                      {isFrench
                        ? `Definissez l'objectif principal pour le mois de ${monthLabel}.`
                        : `Set the main goal for ${monthLabel}.`}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <RichTextEditor
                    locale={activeLocale}
                    value={monthlyObjective}
                    onChange={setMonthlyObjective}
                    disabled={false}
                    contentClassName="max-h-[200px] overflow-y-auto"
                  />
                </div>
                {monthlyEntry?.updatedAt ? (
                  <p className="mt-2 text-xs text-muted">
                    {isFrench ? "Derniere mise a jour" : "Last update"}:{" "}
                    {formatDateTime(monthlyEntry.updatedAt, activeLocale, activeTimeZone)}
                  </p>
                ) : null}
                {monthlyEntryErrorMessage ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {monthlyEntryErrorMessage}
                  </p>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => void handleSaveMonthlyObjective()}
                  >
                    {isFrench ? "Enregistrer" : "Save"}
                  </button>
                </div>
              </section>
            ) : null}

            {showMonthlyReview ? (
              <section
                id="monthlyReview"
                className={`animate-fade-in-up rounded-xl border-2 border-amber-300 bg-amber-50/50 p-6 shadow-sm ${getMainContentSectionClass("monthlyReview", activeSectionId)}`}
                style={{ order: 44 }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <SectionIdentityPills sectionId="monthlyReview" locale={activeLocale} isActive={activeSectionId === "monthlyReview"} />
                    <h2 className={sectionHeaderClass}>
                      {isFrench ? `Bilan de ${monthLabel}` : `${monthLabel} Review`}
                    </h2>
                    <p className="text-sm text-muted">
                      {isFrench
                        ? "Dernier jour du mois — faites le bilan avant de passer a la suite."
                        : "Last day of the month — complete your review before moving on."}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    {isFrench ? "Requis" : "Required"}
                  </span>
                </div>
                <div className="mt-4">
                  <RichTextEditor
                    locale={activeLocale}
                    value={monthlyReview}
                    onChange={setMonthlyReview}
                    disabled={false}
                    contentClassName="max-h-[200px] overflow-y-auto"
                  />
                </div>
                {monthlyEntryErrorMessage ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {monthlyEntryErrorMessage}
                  </p>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => void handleSaveMonthlyReview()}
                  >
                    {isFrench ? "Enregistrer" : "Save"}
                  </button>
                </div>
              </section>
            ) : null}

            {showWeeklyObjective ? (
              <section
                id="weeklyObjective"
                className={`animate-fade-in-up rounded-xl border-2 border-indigo-300 bg-indigo-50/50 p-6 shadow-sm ${getMainContentSectionClass("weeklyObjective", activeSectionId)}`}
                style={{ order: 41 }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <SectionIdentityPills sectionId="weeklyObjective" locale={activeLocale} isActive={activeSectionId === "weeklyObjective"} />
                    <h2 className={sectionHeaderClass}>
                      {isFrench ? "Objectif de la semaine" : "Weekly Objective"}
                    </h2>
                    <p className="text-sm text-muted">
                      {isFrench
                        ? "Debut de semaine — definissez votre objectif avant de continuer."
                        : "Start of week — set your objective before continuing."}
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800">
                    {isFrench ? "Requis" : "Required"}
                  </span>
                </div>
                <div className="mt-4">
                  <RichTextEditor
                    locale={activeLocale}
                    value={weeklyObjective}
                    onChange={setWeeklyObjective}
                    disabled={false}
                    contentClassName="max-h-[200px] overflow-y-auto"
                  />
                </div>
                {weeklyEntry?.updatedAt ? (
                  <p className="mt-2 text-xs text-muted">
                    {isFrench ? "Derniere mise a jour" : "Last update"}:{" "}
                    {formatDateTime(weeklyEntry.updatedAt, activeLocale, activeTimeZone)}
                  </p>
                ) : null}
                {weeklyEntryErrorMessage ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {weeklyEntryErrorMessage}
                  </p>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => void handleSaveWeeklyObjective()}
                  >
                    {isFrench ? "Enregistrer" : "Save"}
                  </button>
                </div>
              </section>
            ) : null}

            {showWeeklyReview ? (
              <section
                id="weeklyReview"
                className={`animate-fade-in-up rounded-xl border-2 border-violet-300 bg-violet-50/50 p-6 shadow-sm ${getMainContentSectionClass("weeklyReview", activeSectionId)}`}
                style={{ order: 42 }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <SectionIdentityPills sectionId="weeklyReview" locale={activeLocale} isActive={activeSectionId === "weeklyReview"} />
                    <h2 className={sectionHeaderClass}>
                      {isFrench ? "Bilan de la semaine" : "Weekly Review"}
                    </h2>
                    <p className="text-sm text-muted">
                      {isFrench
                        ? "Fin de semaine — faites le bilan avant de passer a la semaine suivante."
                        : "End of week — complete your review before moving to next week."}
                    </p>
                  </div>
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-800">
                    {isFrench ? "Requis" : "Required"}
                  </span>
                </div>
                <div className="mt-4">
                  <RichTextEditor
                    locale={activeLocale}
                    value={weeklyReview}
                    onChange={setWeeklyReview}
                    disabled={false}
                    contentClassName="max-h-[200px] overflow-y-auto"
                  />
                </div>
                {weeklyEntry?.updatedAt ? (
                  <p className="mt-2 text-xs text-muted">
                    {isFrench ? "Derniere mise a jour" : "Last update"}:{" "}
                    {formatDateTime(weeklyEntry.updatedAt, activeLocale, activeTimeZone)}
                  </p>
                ) : null}
                {weeklyEntryErrorMessage ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {weeklyEntryErrorMessage}
                  </p>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => void handleSaveWeeklyReview()}
                  >
                    {isFrench ? "Enregistrer" : "Save"}
                  </button>
                </div>
              </section>
            ) : null}
          </>
        );
      })()}

      <section
        id="notes"
        className={`animate-fade-in-up overflow-hidden rounded-xl bg-gradient-to-br from-violet-50/40 via-surface to-indigo-50/30 p-6 shadow-sm ${getMainContentSectionClass("notes", activeSectionId)} ${getDashboardDropClassName("notes")}`}
        style={{ order: getDashboardBlockVisualOrder("notes"), animationDelay: "0.19s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("notes", event)}
        onDrop={(event) => handleDashboardBlockDrop("notes", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionIdentityPills sectionId="notes" locale={activeLocale} isActive={activeSectionId === "notes"} />
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
              onClick={() => openCreateNoteDialog({ targetDate: selectedDate })}
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

      <section
        id="gaming"
        className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getMainContentSectionClass("gaming", activeSectionId)} ${getDashboardDropClassName("gamingTrack")}`}
        style={{ order: getDashboardBlockVisualOrder("gamingTrack"), animationDelay: "0.05s" }}
        onDragOver={(event) => handleDashboardBlockDragOver("gamingTrack", event)}
        onDrop={(event) => handleDashboardBlockDrop("gamingTrack", event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SectionIdentityPills sectionId="gaming" locale={activeLocale} isActive={activeSectionId === "gaming"} />
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

          </>
        ) : null}

        {!dashboardBlockCollapsed.gamingTrack && gamingTrackErrorMessage ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {gamingTrackErrorMessage}
          </p>
        ) : null}
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

              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isFrench ? "Assignes" : "Assignees"}
                </p>
                {selectedTaskAssignees.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedTaskAssignees.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
                      >
                        {name}
                        <button
                          type="button"
                          aria-label={isFrench ? `Retirer ${name}` : `Remove ${name}`}
                          onClick={() => {
                            updateTaskFormField("assignees", formatAssignees(selectedTaskAssignees.filter((n) => n !== name)));
                          }}
                          disabled={isSubmittingTask}
                          className="ml-0.5 rounded-full text-accent/70 hover:text-accent disabled:cursor-not-allowed"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <select
                  value=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    if (!selectedTaskAssignees.includes(event.target.value)) {
                      updateTaskFormField(
                        "assignees",
                        formatAssignees([...selectedTaskAssignees, event.target.value])
                      );
                    }
                    event.target.value = "";
                  }}
                  className={textFieldClass}
                  disabled={isSubmittingTask}
                >
                  <option value="">
                    {isFrench ? "— Ajouter une personne —" : "— Add a person —"}
                  </option>
                  {assigneeOptions
                    .filter((name) => !selectedTaskAssignees.includes(name))
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
                <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input
                    type="text"
                    value={newAssigneeDraft}
                    onChange={(event) => setNewAssigneeDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddNewAssigneeToTask();
                      }
                    }}
                    placeholder={isFrench ? "Nouveau nom ou email" : "New name or email"}
                    className={textFieldClass}
                    disabled={isSubmittingTask}
                    maxLength={200}
                  />
                  <button
                    type="button"
                    className={controlButtonClass}
                    onClick={handleAddNewAssigneeToTask}
                    disabled={isSubmittingTask}
                  >
                    <PlusIcon />
                    {isFrench ? "Ajouter" : "Add"}
                  </button>
                </div>
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

      <ReminderDialog
        reminderDialogMode={reminderDialogMode}
        reminderFormValues={reminderFormValues}
        setReminderFormValues={setReminderFormValues}
        editingReminderId={editingReminderId}
        isSubmittingReminder={isSubmittingReminder}
        reminderErrorMessage={reminderErrorMessage}
        setReminderErrorMessage={setReminderErrorMessage}
        reminderAttachments={reminderAttachments}
        pendingReminderAttachmentIds={pendingReminderAttachmentIds}
        reminderAttachmentNameDraft={reminderAttachmentNameDraft}
        setReminderAttachmentNameDraft={setReminderAttachmentNameDraft}
        setReminderAttachmentFileDraft={setReminderAttachmentFileDraft}
        reminderAttachmentFileInputRef={reminderAttachmentFileInputRef}
        isCreatingReminderAttachment={isCreatingReminderAttachment}
        reminderAttachmentErrorMessage={reminderAttachmentErrorMessage}
        projectSelectOptions={projectSelectOptions}
        assigneeOptions={assigneeOptions}
        selectedReminderAssignees={selectedReminderAssignees}
        newAssigneeDraft={newAssigneeDraft}
        setNewAssigneeDraft={setNewAssigneeDraft}
        handleAddNewAssigneeToReminder={handleAddNewAssigneeToReminder}
        handleReminderFormSubmit={handleReminderFormSubmit}
        closeReminderDialog={closeReminderDialog}
        handleDeleteReminderAttachment={handleDeleteReminderAttachment}
        handleCreateReminderAttachment={handleCreateReminderAttachment}
        isFrench={isFrench}
        activeLocale={activeLocale}
        isDataUrl={isDataUrl}
        formatFileSize={formatFileSize}
        formatAssignees={formatAssignees}
      />

      <ProfileDialog
        isProfileDialogOpen={isProfileDialogOpen}
        profileFormValues={profileFormValues}
        handleProfileFieldChange={handleProfileFieldChange}
        handleProfileSubmit={handleProfileSubmit}
        closeProfileDialog={closeProfileDialog}
        isProfileSaving={isProfileSaving}
        profileErrorMessage={profileErrorMessage}
        profileSuccessMessage={profileSuccessMessage}
        userLocaleOptions={userLocaleOptions}
        isFrench={isFrench}
        isGoogleCalendarAvailable={isGoogleCalendarAvailable}
        isGoogleCalendarLoading={isGoogleCalendarLoading}
        googleCalendarConnections={googleCalendarConnections}
        connectionCalendarOptions={connectionCalendarOptions}
        googleCalendarError={googleCalendarError}
        isGoogleCalendarSyncing={isGoogleCalendarSyncing}
        handleConnectGoogleCalendar={handleConnectGoogleCalendar}
        handleDisconnectGoogleCalendar={handleDisconnectGoogleCalendar}
        handleSyncGoogleCalendar={handleSyncGoogleCalendar}
        handleUpdateConnectionColor={handleUpdateConnectionColor}
        handleUpdateCalendarId={handleUpdateCalendarId}
        fetchConnectionCalendars={fetchConnectionCalendars}
        getPreferredLocale={getPreferredLocale}
        getBrowserTimeZone={getBrowserTimeZone}
        getGoogleCalendarUnavailableMessage={getGoogleCalendarUnavailableMessage}
      />

      <NavigationBlockersDialog
        blockers={navigationBlockers}
        locale={activeLocale}
        onDismiss={() => setNavigationBlockers([])}
      />

      <DeleteTaskDialog
        task={taskToDelete}
        locale={activeLocale}
        errorMessage={deleteErrorMessage}
        isDeleting={isDeletingTask}
        onCancel={closeDeleteDialog}
        onConfirm={handleDeleteTask}
      />

      <TaskAlertsPanel
        isOpen={isTaskAlertsPanelOpen}
        locale={activeLocale}
        activeTimeZone={activeTimeZone}
        summary={alertsSummary}
        items={alertPanelItems}
        isLoading={isTaskAlertsLoading}
        errorMessage={taskAlertsErrorMessage}
        anchorDate={taskAlertsAnchorDate}
        onClose={() => setIsTaskAlertsPanelOpen(false)}
        onTaskClick={(task) => {
          setIsTaskAlertsPanelOpen(false);

          if (task.targetDate === selectedDate) {
            openEditTaskDialog(task);
            return;
          }

          handleDateChange(task.targetDate);
        }}
        onReminderClick={(reminder) => {
          setIsTaskAlertsPanelOpen(false);
          openEditReminderDialog(reminder);
        }}
        onCompleteReminder={(reminderId) => { void handleCompleteReminder(reminderId); }}
        onCancelReminder={(reminderId) => { void handleCancelReminder(reminderId); }}
        formatDateOnlyForLocale={formatDateOnlyForLocale}
        formatDateTime={formatDateTime}
        formatDateInputForTimeZone={formatDateInputForTimeZone}
        formatTaskAlertDueLabel={formatTaskAlertDueLabel}
        formatAlertUrgencyLabel={formatAlertUrgencyLabel}
        formatAlertSourceLabel={formatAlertSourceLabel}
        formatPriority={formatPriority}
        formatReminderStatus={formatReminderStatus}
      />

      <AssistantPanel
        isOpen={isAssistantPanelOpen}
        locale={activeLocale}
        activeTimeZone={activeTimeZone}
        messages={assistantMessages}
        isLoading={isAssistantLoading}
        question={assistantQuestion}
        errorMessage={assistantErrorMessage}
        promptSuggestions={assistantPromptSuggestions}
        maxQuestionLength={ASSISTANT_QUESTION_MAX_LENGTH}
        messagesEndRef={assistantMessagesEndRef}
        onClose={() => setIsAssistantPanelOpen(false)}
        onSubmit={handleAssistantSubmit}
        onQuestionChange={(value) => {
          setAssistantQuestion(value);
          setAssistantErrorMessage(null);
        }}
        onPromptSelect={(prompt) => {
          setAssistantQuestion(prompt);
          setAssistantErrorMessage(null);
        }}
        formatAssistantSourceLabel={formatAssistantSourceLabel}
        formatDateTime={formatDateTime}
      />

      <AssistantFab
        isOpen={isAssistantPanelOpen}
        locale={activeLocale}
        onToggle={() => {
          setIsTaskAlertsPanelOpen(false);
          setIsAssistantPanelOpen((isOpen) => !isOpen);
        }}
      />

      <PendingReminderToasts
        reminders={pendingReminders}
        locale={activeLocale}
        activeTimeZone={activeTimeZone}
        onComplete={(reminderId) => { void handleCompleteReminder(reminderId); }}
        onCancel={(reminderId) => { void handleCancelReminder(reminderId); }}
        formatReminderStatus={formatReminderStatus}
      />
    </div>
    </div>
  );
}
