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
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { AppNavbar } from "./app-navbar";
import { AuthPanel } from "./auth-panel";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BellIcon,
  CalendarIcon,
  ChatIcon,
  CloseIcon,
  CollapseChevronIcon,
  CopyIcon,
  LightningIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  SendIcon,
  TimeZoneIcon,
  TrashIcon,
} from "./app-shell.icons";
import { GlobalSearchModal } from "./global-search-modal";
import {
  alertSourceChipClassByType,
  alertUrgencyChipClassByUrgency,
  boardFilterFieldClass,
  controlButtonClass,
  controlIconButtonClass,
  dangerButtonClass,
  dashboardEmptyStateClass,
  dashboardInsetPanelClass,
  dashboardMetricCardClass,
  dashboardSectionClass,
  dialogOverlayClass,
  dialogSectionClass,
  dialogShellClass,
  floatingPanelClass,
  iconButtonClass,
  kanbanColumnShellClass,
  primaryButtonClass,
  priorityChipClassByPriority,
  reflectionBadgeClass,
  reflectionMetaCardClass,
  reflectionPanelClass,
  reminderStatusChipClassByStatus,
  sectionHeaderClass,
  segmentedControlClass,
  statusColumnClassByStatus,
  statusDropClassByStatus,
  textFieldClass,
  toolbarSurfaceClass,
  workspaceHeaderClass,
  workspaceShellClass,
  workspaceStatCardClass,
} from "./app-shell.styles";
import type {
  AlertUrgency,
  AuthFormValues,
  AuthMode,
  GlobalSearchState,
  ReminderStatus,
  SearchResult,
  SearchSourceType,
  TaskPriority,
  TaskStatus,
  UserLocale,
} from "./app-shell.types";

type RecurrenceFrequency = "daily" | "weekly" | "monthly";

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

type ApiErrorPayload = { error?: { code?: string; message?: string } } | null;

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
const DAY_AFFIRMATION_RICH_TEXT_OPTIONS = {
  preserveTextColor: false,
  recoverPlainText: true,
};
const DEFAULT_TASK_FILTER_VALUES: TaskFilterValues = {
  query: "",
  status: "all",
  priority: "all",
  project: "",
};
const VISIBLE_DASHBOARD_BLOCKS = {
  overview: false,
  gamingTrack: false,
  dailyControls: false,
  affirmation: false,
  reminders: false,
  notes: false,
  board: false,
  bilan: false,
} as const;
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

function parseAssigneeNames(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[;,]/)
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function getMonogram(value: string): string {
  const parts = value
    .split(/\s+/)
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "•";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
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

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

type RichTextSanitizationOptions = {
  preserveTextColor?: boolean;
};

type RichTextRenderOptions = RichTextSanitizationOptions & {
  recoverPlainText?: boolean;
};

const allowedRichTextTags = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "hr",
  "img",
  "input",
  "label",
  "li",
  "mark",
  "ol",
  "p",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
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

function sanitizeRichTextTag(tag: string, options: RichTextSanitizationOptions = {}): string {
  const match = /^<\s*(\/?)\s*([a-z0-9-]+)([^>]*)>/i.exec(tag);

  if (!match) {
    return "";
  }

  const preserveTextColor = options.preserveTextColor ?? true;
  const [, closingSlash, rawTagName, rawAttributes] = match;
  const tagName = rawTagName.toLowerCase();

  if (!allowedRichTextTags.has(tagName)) {
    return "";
  }

  const isClosingTag = closingSlash === "/";
  if (isClosingTag) {
    return tagName === "br" || tagName === "hr" || tagName === "input" || tagName === "img" || tagName === "col" ? "" : `</${tagName}>`;
  }

  if (tagName === "br" || tagName === "hr" || tagName === "col") {
    return `<${tagName}>`;
  }

  if (tagName === "img") {
    const src = getHtmlAttributeValue(rawAttributes, "src");
    const alt = getHtmlAttributeValue(rawAttributes, "alt") ?? "";
    if (!src) return "";
    const trimmed = src.trim();
    const isSafeUrl = /^https?:\/\//i.test(trimmed);
    const isSafeDataUri = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed);
    if (!isSafeUrl && !isSafeDataUri) return "";
    return `<img src="${escapeHtml(trimmed)}" alt="${escapeHtml(alt)}">`;
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

  if (tagName === "span") {
    const style = preserveTextColor ? getHtmlAttributeValue(rawAttributes, "style") : null;
    if (style) {
      const colorMatch = /color:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|[a-z]+)/i.exec(style);
      if (colorMatch) {
        return `<span style="color:${escapeHtml(colorMatch[1])}">`;
      }
    }
    return "<span>";
  }

  if (tagName === "td" || tagName === "th") {
    const colspan = getHtmlAttributeValue(rawAttributes, "colspan");
    const rowspan = getHtmlAttributeValue(rawAttributes, "rowspan");
    let attrs = "";
    if (colspan && /^\d+$/.test(colspan)) attrs += ` colspan="${colspan}"`;
    if (rowspan && /^\d+$/.test(rowspan)) attrs += ` rowspan="${rowspan}"`;
    return `<${tagName}${attrs}>`;
  }

  return `<${tagName}>`;
}

function sanitizeRichTextHtml(value: string, options: RichTextSanitizationOptions = {}): string {
  return value.replace(/<[^>]+>/g, (tag) => sanitizeRichTextTag(tag, options));
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

function stripRichTextToPlainText(value: string): string {
  const normalized = value
    .replace(/<input\b[^>]*type=["']checkbox["'][^>]*checked[^>]*>/gi, "[x] ")
    .replace(/<input\b[^>]*type=["']checkbox["'][^>]*>/gi, "[ ] ")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|blockquote|li|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(normalized)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function getRichTextCharacterCount(value: string): number {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  return isHtmlContent(trimmed) ? stripRichTextToPlainText(trimmed).length : trimmed.length;
}

function renderPlainTextDescriptionHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
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

function renderDescriptionHtml(markdown: string, options: RichTextRenderOptions = {}): string {
  const trimmed = markdown.trim();

  if (!trimmed) {
    return "";
  }

  if (isHtmlContent(trimmed)) {
    const sanitized = sanitizeRichTextHtml(trimmed, options);

    if (!options.recoverPlainText || !isRichTextEmpty(sanitized)) {
      return sanitized;
    }

    const plainText = stripRichTextToPlainText(trimmed);
    return plainText ? renderPlainTextDescriptionHtml(plainText) : "";
  }

  return renderPlainTextDescriptionHtml(trimmed);
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

// ─── Project Planning View ───────────────────────────────────────────────────

type ProjectPlanningViewProps = {
  locale: UserLocale;
  tasks: Task[];
  isLoading: boolean;
  isBusy: boolean;
  errorMessage: string | null;
  filters: { project: string; status: string; dateFrom: string; dateTo: string };
  sort: { column: string; dir: "asc" | "desc" };
  viewMode: "table" | "gantt";
  projectOptions: string[];
  onFilterChange: (key: "project" | "status" | "dateFrom" | "dateTo", value: string) => void;
  onSortChange: (column: string) => void;
  onViewModeChange: (mode: "table" | "gantt") => void;
  onClose: () => void;
  onCreateTask: () => void;
  onEditTask: (task: Task) => void;
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-600 border border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
  done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled: "bg-red-50 text-red-500 border border-red-100",
};

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
  cancelled: "bg-red-400",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "text-slate-400",
  medium: "text-amber-500",
  high: "text-rose-500",
};

const PRIORITY_BG: Record<TaskPriority, string> = {
  low: "bg-slate-50 text-slate-500 border border-slate-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  high: "bg-rose-50 text-rose-600 border border-rose-200",
};

const GANTT_STATUS_BAR: Record<TaskStatus, { from: string; to: string }> = {
  todo: { from: "from-slate-300", to: "to-slate-400" },
  in_progress: { from: "from-blue-400", to: "to-blue-500" },
  done: { from: "from-emerald-400", to: "to-emerald-500" },
  cancelled: { from: "from-red-300", to: "to-red-400" },
};

function sortTasks(tasks: Task[], column: string, dir: "asc" | "desc"): Task[] {
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case "title": cmp = a.title.localeCompare(b.title); break;
      case "project": cmp = (a.project ?? "").localeCompare(b.project ?? ""); break;
      case "status": cmp = a.status.localeCompare(b.status); break;
      case "priority": {
        const rank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
        cmp = rank[a.priority] - rank[b.priority];
        break;
      }
      case "targetDate": cmp = a.targetDate.localeCompare(b.targetDate); break;
      case "dueDate": cmp = (a.dueDate ?? "").localeCompare(b.dueDate ?? ""); break;
      case "plannedTime": cmp = (a.plannedTime ?? 0) - (b.plannedTime ?? 0); break;
      default: cmp = a.targetDate.localeCompare(b.targetDate);
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function formatMinutes(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function formatShortDate(dateStr: string, locale: UserLocale): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric", month: "short", timeZone: "UTC",
  });
}

function ProjectPlanningView({
  locale,
  tasks,
  isLoading,
  isBusy,
  errorMessage,
  filters,
  sort,
  viewMode,
  projectOptions,
  onFilterChange,
  onSortChange,
  onViewModeChange,
  onClose,
  onCreateTask,
  onEditTask,
}: ProjectPlanningViewProps) {
  const isFrench = locale === "fr";
  const today = new Date().toISOString().slice(0, 10);

  const sorted = useMemo(() => sortTasks(tasks, sort.column, sort.dir), [tasks, sort]);

  // ── Gantt chart computation ──────────────────────────────────────────────
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

    const months: { label: string; left: number; width: number }[] = [];
    let cursor = new Date(start);
    while (cursor < end) {
      const monthStart = new Date(cursor);
      const nextMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      const clampedEnd = nextMonth < end ? nextMonth : end;
      const left = ((monthStart.getTime() - start.getTime()) / 86400000 / totalDays) * 100;
      const width = ((clampedEnd.getTime() - monthStart.getTime()) / 86400000 / totalDays) * 100;
      months.push({
        label: monthStart.toLocaleDateString(isFrench ? "fr-FR" : "en-US", { month: "long", year: "numeric" }),
        left,
        width,
      });
      cursor = nextMonth;
    }

    const days: { label: string; left: number; isWeekend: boolean }[] = [];
    if (totalDays <= 60) {
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start);
        d.setUTCDate(d.getUTCDate() + i);
        const dow = d.getUTCDay();
        days.push({
          label: String(d.getUTCDate()),
          left: (i / totalDays) * 100,
          isWeekend: dow === 0 || dow === 6,
        });
      }
    }

    const todayOffset = dayOffset(today);
    const todayLeft = totalDays > 0 ? (todayOffset / totalDays) * 100 : -1;
    const showTodayMarker = todayLeft >= 0 && todayLeft <= 100;

    const bars = sorted.map((task) => {
      const startOffset = dayOffset(task.targetDate);
      const endOffset = task.dueDate ? dayOffset(task.dueDate) + 1 : startOffset + 1;
      const left = (startOffset / totalDays) * 100;
      const width = Math.max(0.8, ((endOffset - startOffset) / totalDays) * 100);
      return { task, left, width };
    });

    return { totalDays, months, days, bars, todayLeft, showTodayMarker };
  }, [sorted, isFrench, today]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const statsDone = tasks.filter((t) => t.status === "done").length;
  const statsInProgress = tasks.filter((t) => t.status === "in_progress").length;
  const statsTodo = tasks.filter((t) => t.status === "todo").length;
  const statsCancelled = tasks.filter((t) => t.status === "cancelled").length;
  const totalPlanned = tasks.reduce((s, t) => s + (t.plannedTime ?? 0), 0);
  const completionRate = tasks.length > 0 ? Math.round((statsDone / tasks.length) * 100) : 0;

  const hasActiveFilters = filters.project || filters.status !== "all" || filters.dateFrom || filters.dateTo;
  const overdueCount = tasks.filter((task) => task.dueDate && task.dueDate < today && task.status !== "done" && task.status !== "cancelled").length;
  const upcomingCount = tasks.filter((task) => task.dueDate && task.dueDate >= today && task.status !== "done" && task.status !== "cancelled").length;
  const activeProjectCount = new Set(tasks.flatMap((task) => (task.project ? [task.project] : []))).size;
  const resultCountLabel = `${sorted.length} ${isFrench ? "résultat" : "result"}${sorted.length !== 1 ? "s" : ""}`;
  const statusScopeLabel = filters.status === "all"
    ? (isFrench ? "Tous les statuts" : "All statuses")
    : isTaskStatus(filters.status)
    ? formatStatusLabel(filters.status)
    : filters.status;
  const viewModeLabel = viewMode === "table"
    ? (isFrench ? "Vue tableau" : "Table view")
    : (isFrench ? "Vue Gantt" : "Gantt view");
  const openStartLabel = isFrench ? "début libre" : "open start";
  const openEndLabel = isFrench ? "fin libre" : "open end";
  const timelineLabel = filters.dateFrom || filters.dateTo
    ? `${filters.dateFrom ? formatShortDate(filters.dateFrom, locale) : openStartLabel} → ${filters.dateTo ? formatShortDate(filters.dateTo, locale) : openEndLabel}`
    : ganttData?.months.length
    ? ganttData.months.length === 1
      ? (ganttData.months[0]?.label ?? (isFrench ? "Planification active" : "Timeline active"))
      : `${ganttData.months[0]?.label ?? ""} · ${ganttData.months.length} ${isFrench ? "mois" : "months"}`
    : isFrench
    ? "Toutes les échéances"
    : "All schedules";

  function resetFilters() {
    onFilterChange("project", "");
    onFilterChange("status", "all");
    onFilterChange("dateFrom", "");
    onFilterChange("dateTo", "");
  }

  function SortIcon({ column }: { column: string }) {
    if (sort.column !== column) {
      return (
        <svg viewBox="0 0 10 12" className="ml-1 inline h-2.5 w-2.5 opacity-25" fill="currentColor">
          <path d="M5 1l3 4H2zM5 11l-3-4h6z" />
        </svg>
      );
    }
    return sort.dir === "asc" ? (
      <svg viewBox="0 0 10 6" className="ml-1 inline h-2.5 w-2.5 text-accent" fill="currentColor">
        <path d="M5 0l5 6H0z" />
      </svg>
    ) : (
      <svg viewBox="0 0 10 6" className="ml-1 inline h-2.5 w-2.5 text-accent" fill="currentColor">
        <path d="M5 6L0 0h10z" />
      </svg>
    );
  }

  function formatStatusLabel(status: TaskStatus): string {
    const labels: Record<TaskStatus, { fr: string; en: string }> = {
      todo: { fr: "À faire", en: "To do" },
      in_progress: { fr: "En cours", en: "In progress" },
      done: { fr: "Terminé", en: "Done" },
      cancelled: { fr: "Annulé", en: "Cancelled" },
    };
    return isFrench ? labels[status].fr : labels[status].en;
  }

  function formatPriorityLabel(priority: TaskPriority): string {
    const labels: Record<TaskPriority, { fr: string; en: string }> = {
      low: { fr: "Faible", en: "Low" },
      medium: { fr: "Moyen", en: "Medium" },
      high: { fr: "Élevée", en: "High" },
    };
    return isFrench ? labels[priority].fr : labels[priority].en;
  }

  function PriorityIcon({ priority }: { priority: TaskPriority }) {
    const bars = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
    return (
      <span className={`inline-flex items-end gap-[2px] ${PRIORITY_COLORS[priority]}`}>
        {[1, 2, 3].map((b) => (
          <span
            key={b}
            className={`inline-block w-[3px] rounded-sm ${b <= bars ? "opacity-100" : "opacity-20"}`}
            style={{ height: b === 1 ? "6px" : b === 2 ? "9px" : "12px", backgroundColor: "currentColor" }}
          />
        ))}
      </span>
    );
  }

  const thBase = "cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-foreground";

  return (
    <div className={workspaceShellClass}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(136,86,229,0.22),transparent_58%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-0 top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(145,219,42,0.18),transparent_68%)] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(53,37,205,0.14),transparent_72%)] blur-3xl" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`${workspaceHeaderClass} gap-4`}>
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-accent-soft via-white to-secondary-soft text-accent shadow-[0_18px_38px_rgba(53,37,205,0.16)]">
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="4" width="16" height="2.5" rx="1" />
              <rect x="2" y="8.75" width="11" height="2.5" rx="1" />
              <rect x="2" y="13.5" width="14" height="2.5" rx="1" />
            </svg>
          </div>
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-accent/10 bg-accent-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                {isFrench ? "Espace projet" : "Project workspace"}
              </span>
              <span className="rounded-full border border-white/60 bg-white/75 px-3 py-1 text-[11px] font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                {viewModeLabel}
              </span>
              {hasActiveFilters ? (
                <span className="rounded-full border border-[#cfe8a8] bg-[#edf8d6] px-3 py-1 text-[11px] font-semibold text-[#304f00]">
                  {isFrench ? "Filtres actifs" : "Active filters"}
                </span>
              ) : null}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-foreground sm:text-[1.35rem]">
                {isFrench ? "Planification projet" : "Project Planning"}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-muted">
                {isFrench
                  ? "Pilotez les charges, les échéances et la cadence du projet dans le langage visuel Stitch déjà en place."
                  : "Track workload, deadlines, and delivery rhythm inside the Stitch workspace language already used across the app."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="dialog-section-shell rounded-full px-3 py-1.5 text-muted">
                {timelineLabel}
              </span>
              <span className="dialog-section-shell rounded-full px-3 py-1.5 text-muted">
                {activeProjectCount} {isFrench ? "projet(s)" : "project(s)"}
              </span>
              <span className="dialog-section-shell rounded-full px-3 py-1.5 text-muted">
                {tasks.length} {isFrench ? "tâches" : "tasks"} · {completionRate}% {isFrench ? "complétées" : "complete"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
          <div className={`${segmentedControlClass} shrink-0`}>
            <button
              type="button"
              title={isFrench ? "Vue tableau" : "Table view"}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${
                viewMode === "table"
                  ? "bg-surface-elevated text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
              onClick={() => onViewModeChange("table")}
            >
              <svg viewBox="0 0 16 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="14" height="10" rx="1.5" />
                <path d="M1 4.5h14M1 8h14M5.5 1v10M11 1v10" />
              </svg>
              <span className="hidden sm:inline">{isFrench ? "Tableau" : "Table"}</span>
            </button>
            <button
              type="button"
              title={isFrench ? "Vue Gantt" : "Gantt view"}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${
                viewMode === "gantt"
                  ? "bg-surface-elevated text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
              onClick={() => onViewModeChange("gantt")}
            >
              <svg viewBox="0 0 16 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1.5" width="8" height="2" rx="1" fill="currentColor" stroke="none" />
                <rect x="4" y="5" width="7" height="2" rx="1" fill="currentColor" stroke="none" />
                <rect x="1" y="8.5" width="11" height="2" rx="1" fill="currentColor" stroke="none" />
              </svg>
              <span className="hidden sm:inline">Gantt</span>
            </button>
          </div>
          <button
            type="button"
            className={`${primaryButtonClass} shrink-0 px-5`}
            onClick={onCreateTask}
            disabled={isBusy}
          >
            <PlusIcon />
            {isFrench ? "Nouvelle tache" : "New Task"}
          </button>
          <button
            type="button"
            className={`${iconButtonClass} h-10 w-10 shrink-0 rounded-2xl px-0`}
            onClick={onClose}
            aria-label={isFrench ? "Fermer" : "Close"}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Stats cards ────────────────────────────────────────────────────── */}
      {!isLoading && tasks.length > 0 && (
        <div className="shrink-0 px-4 pb-3 sm:px-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {/* Completion rate */}
            <div className={`${workspaceStatCardClass} min-w-0 gap-3`}>
              <div className="relative h-9 w-9 shrink-0">
                <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-line" />
                  <circle
                    cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3"
                    strokeDasharray={`${completionRate * 0.88} 88`}
                    strokeLinecap="round"
                    className="text-reward transition-all duration-500"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                  {completionRate}%
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{isFrench ? "Avancement" : "Progress"}</p>
                <p className="text-[11px] text-muted">{statsDone}/{tasks.length} {isFrench ? "tâches" : "tasks"}</p>
              </div>
            </div>
            {/* Done */}
            <div className={`${workspaceStatCardClass} min-w-0 border-[#cfe8a8] bg-[#edf8d6]/90`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#dff1bd]">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#426b00]" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-[#304f00]">{statsDone}</p>
                <p className="text-[11px] text-[#426b00]">{isFrench ? "Terminées" : "Done"}</p>
              </div>
            </div>
            {/* In progress */}
            <div className={`${workspaceStatCardClass} min-w-0 border-[#d3bbff] bg-[#f5edff]/90`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#ebddff]">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#581db3]" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="8" cy="8" r="5.5"/>
                  <path d="M8 5v3.5l2 1.5" strokeLinecap="round"/>
                </svg>
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-[#581db3]">{statsInProgress}</p>
                <p className="text-[11px] text-[#6e3aca]">{isFrench ? "En cours" : "In progress"}</p>
              </div>
            </div>
            {/* Todo */}
            <div className={`${workspaceStatCardClass} min-w-0 border-[#c7c4d8] bg-[#f2efff]/90`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e3dfff]">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#464555]" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="10" height="10" rx="2"/>
                </svg>
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-[#100069]">{statsTodo}</p>
                <p className="text-[11px] text-[#464555]">{isFrench ? "À faire" : "To do"}</p>
              </div>
            </div>
            {/* Time */}
            {totalPlanned > 0 && (
              <div className={`${workspaceStatCardClass} min-w-0 border-[#c3c0ff] bg-[#f2efff]/90`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e2dfff]">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#4f46e5]" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="8" cy="8" r="5.5"/>
                    <path d="M8 5v3.5l2.5 1" strokeLinecap="round"/>
                  </svg>
                </span>
                <div>
                  <p className="text-lg font-bold leading-none text-[#3323cc]">{formatMinutes(totalPlanned)}</p>
                  <p className="text-[11px] text-[#4f46e5]">{isFrench ? "Planifiées" : "Planned"}</p>
                </div>
              </div>
            )}
            {overdueCount > 0 && (
              <div className={`${workspaceStatCardClass} min-w-0 border-rose-200 bg-rose-50/90`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-rose-500" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M8 3v4l2.5 1.5" strokeLinecap="round" />
                    <circle cx="8" cy="8" r="5.5" />
                  </svg>
                </span>
                <div>
                  <p className="text-lg font-bold leading-none text-rose-600">{overdueCount}</p>
                  <p className="text-[11px] text-rose-500">{isFrench ? "En retard" : "Overdue"}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-4 sm:px-6">
        <div className={`${toolbarSurfaceClass} flex flex-col gap-3 rounded-[28px]`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className={sectionHeaderClass}>{isFrench ? "Focus planning" : "Planning focus"}</p>
              <p className="mt-1 text-sm text-muted">
                {isFrench
                  ? "Filtrez le projet, l’état et la fenêtre de dates sans sortir du shell Stitch."
                  : "Filter project, status, and date window without leaving the Stitch shell."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-white/60 bg-white/80 px-3 py-1.5 font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                {resultCountLabel}
              </span>
              <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1.5 font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                {statusScopeLabel}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="dialog-section-shell flex items-center gap-1.5 rounded-full px-3 py-2 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20">
              <svg viewBox="0 0 14 14" className="h-3 w-3 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="1" y="1" width="5" height="5" rx="1.2" />
                <rect x="8" y="1" width="5" height="5" rx="1.2" />
                <rect x="1" y="8" width="5" height="5" rx="1.2" />
                <rect x="8" y="8" width="5" height="5" rx="1.2" />
              </svg>
              <select
                className="border-0 bg-transparent text-xs text-foreground outline-none"
                value={filters.project}
                onChange={(e) => onFilterChange("project", e.target.value)}
              >
                <option value="">{isFrench ? "Tous les projets" : "All projects"}</option>
                {projectOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className={`${segmentedControlClass} flex-wrap`}>
              {(["all", "todo", "in_progress", "done", "cancelled"] as const).map((s) => {
                const label = s === "all"
                  ? (isFrench ? "Tous" : "All")
                  : s === "todo" ? (isFrench ? "À faire" : "To do")
                  : s === "in_progress" ? (isFrench ? "En cours" : "In progress")
                  : s === "done" ? (isFrench ? "Terminé" : "Done")
                  : (isFrench ? "Annulé" : "Cancelled");
                const isActive = filters.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onFilterChange("status", s)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                      isActive
                        ? "bg-accent text-white shadow-sm"
                        : "border border-line bg-surface-elevated text-muted hover:border-accent/30 hover:text-foreground"
                    }`}
                  >
                    {s !== "all" ? (
                      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white/80" : STATUS_DOT[s]}`} />
                    ) : null}
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="dialog-section-shell flex items-center gap-1 rounded-full px-3 py-2 focus-within:border-accent/50">
              <svg viewBox="0 0 14 14" className="h-3 w-3 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="1" y="2" width="12" height="11" rx="1.5" />
                <path d="M1 5.5h12M4.5 1v3M9.5 1v3" />
              </svg>
              <input
                type="date"
                className="border-0 bg-transparent text-xs text-foreground outline-none"
                value={filters.dateFrom}
                onChange={(e) => onFilterChange("dateFrom", e.target.value)}
              />
              <span className="text-xs text-muted">→</span>
              <input
                type="date"
                className="border-0 bg-transparent text-xs text-foreground outline-none"
                value={filters.dateTo}
                onChange={(e) => onFilterChange("dateTo", e.target.value)}
              />
            </div>

            {hasActiveFilters ? (
              <button
                type="button"
                className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20"
                onClick={resetFilters}
              >
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 2l6 6M8 2L2 8" strokeLinecap="round" />
                </svg>
                {isFrench ? "Effacer" : "Clear"}
              </button>
            ) : null}

            <span className="ml-auto rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]">
              {timelineLabel}
            </span>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 px-4 pb-4 sm:px-6 sm:pb-6">
        {isLoading ? (
          <div className="app-panel-soft h-full overflow-hidden rounded-[30px] border border-white/60">
            <div className="workspace-header-shell px-5 py-4 sm:px-6">
              <div>
                <p className={sectionHeaderClass}>{isFrench ? "Chargement" : "Loading"}</p>
                <p className="mt-1 text-sm text-muted">
                  {isFrench ? "Préparation de la vue projet..." : "Preparing the project view..."}
                </p>
              </div>
            </div>
            <div className="divide-y divide-line/70">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="h-7 w-7 animate-pulse rounded-full bg-line" />
                  <div className="h-3 flex-1 animate-pulse rounded bg-line" style={{ animationDelay: `${i * 80}ms` }} />
                  <div className="h-3 w-16 animate-pulse rounded bg-line" style={{ animationDelay: `${i * 80 + 40}ms` }} />
                  <div className="h-8 w-24 animate-pulse rounded-full bg-line" style={{ animationDelay: `${i * 80 + 80}ms` }} />
                  <div className="h-3 w-20 animate-pulse rounded bg-line" />
                </div>
              ))}
            </div>
          </div>
        ) : errorMessage ? (
          <div className="flex h-full items-center justify-center">
            <div className="dialog-section-shell flex max-w-md flex-col items-center gap-4 rounded-[30px] px-8 py-10 text-center shadow-[0_24px_60px_rgba(16,0,105,0.1)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-rose-500">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isFrench ? "Impossible de charger la planification" : "Unable to load planning"}
                </p>
                <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>
              </div>
              <button
                type="button"
                className={controlButtonClass}
                onClick={onClose}
              >
                {isFrench ? "Retourner au tableau" : "Back to workspace"}
              </button>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="dialog-section-shell flex max-w-md flex-col items-center gap-4 rounded-[30px] px-8 py-10 text-center shadow-[0_24px_60px_rgba(16,0,105,0.08)]">
              <div className="flex h-16 w-16 items-center justify-center rounded-[26px] bg-gradient-to-br from-accent-soft via-white to-secondary-soft text-accent">
                <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="8" y="8" width="32" height="32" rx="4" />
                  <path d="M16 20h16M16 26h10M16 32h13" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">
                  {isFrench ? "Aucune tâche trouvée" : "No tasks found"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {hasActiveFilters
                    ? (isFrench ? "Essayez d’élargir vos filtres pour récupérer une vue projet complète." : "Try widening your filters to restore the full project view.")
                    : (isFrench ? "Les tâches planifiées apparaîtront ici avec le même langage visuel que le dashboard Stitch." : "Scheduled tasks will appear here with the same Stitch visual language as the dashboard.")}
                </p>
              </div>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className={`${controlButtonClass} px-4 py-2 text-sm`}
                  onClick={resetFilters}
                >
                  {isFrench ? "Réinitialiser les filtres" : "Reset filters"}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${primaryButtonClass} px-5`}
                  onClick={onCreateTask}
                  disabled={isBusy}
                >
                  <PlusIcon />
                  {isFrench ? "Créer une tâche" : "Create task"}
                </button>
              )}
            </div>
          </div>
        ) : viewMode === "table" ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="app-panel-soft flex flex-wrap items-center justify-between gap-3 rounded-[26px] px-4 py-3">
              <div>
                <p className={sectionHeaderClass}>{isFrench ? "Vue détaillée" : "Detailed view"}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {isFrench
                    ? "Priorités, dates et durée regroupées dans une table de pilotage."
                    : "Priorities, dates, and duration grouped in a control-table view."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full border border-[#c3c0ff] bg-[#f2efff] px-3 py-1.5 font-semibold text-[#3323cc]">
                  {statusScopeLabel}
                </span>
                <span className="rounded-full border border-white/60 bg-white/80 px-3 py-1.5 font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                  {overdueCount > 0
                    ? `${overdueCount} ${isFrench ? "en retard" : "overdue"}`
                    : `${upcomingCount} ${isFrench ? "à venir" : "up next"}`}
                </span>
              </div>
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-[30px] border border-white/60 bg-[rgba(255,255,255,0.76)] shadow-[0_24px_60px_rgba(16,0,105,0.1)] backdrop-blur">
              <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-[rgba(252,248,255,0.92)] backdrop-blur shadow-[0_1px_0_0_var(--color-line)]">
                  <tr>
                    <th className="w-14 px-4 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">#</th>
                    <th className={thBase} onClick={() => onSortChange("title")}>
                      {isFrench ? "Titre" : "Title"}<SortIcon column="title" />
                    </th>
                    <th className={thBase} onClick={() => onSortChange("project")}>
                      {isFrench ? "Projet" : "Project"}<SortIcon column="project" />
                    </th>
                    <th className={thBase} onClick={() => onSortChange("status")}>
                      {isFrench ? "Statut" : "Status"}<SortIcon column="status" />
                    </th>
                    <th className={thBase} onClick={() => onSortChange("priority")}>
                      {isFrench ? "Priorité" : "Priority"}<SortIcon column="priority" />
                    </th>
                    <th className={thBase} onClick={() => onSortChange("targetDate")}>
                      {isFrench ? "Planifiée" : "Planned"}<SortIcon column="targetDate" />
                    </th>
                    <th className={thBase} onClick={() => onSortChange("dueDate")}>
                      {isFrench ? "Échéance" : "Due"}<SortIcon column="dueDate" />
                    </th>
                    <th className={thBase} onClick={() => onSortChange("plannedTime")}>
                      {isFrench ? "Durée" : "Duration"}<SortIcon column="plannedTime" />
                    </th>
                    <th className="w-20 px-4 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((task, index) => {
                    const isDone = task.status === "done";
                    const isOverdue = task.dueDate && task.dueDate < today && task.status !== "done" && task.status !== "cancelled";
                    return (
                      <tr
                        key={task.id}
                        className={`group cursor-pointer border-b border-line/70 transition-all duration-200 hover:bg-accent/[0.05] ${
                          index % 2 === 0 ? "bg-white/55" : "bg-surface-soft/45"
                        }`}
                        onClick={() => onEditTask(task)}
                      >
                        <td className="w-14 px-4 py-4 text-center text-xs text-muted/50 tabular-nums">
                          <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-white/60 bg-white/70 px-2 py-1 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                            {index + 1}
                          </span>
                        </td>
                        <td className="max-w-[280px] px-4 py-4">
                          <div className="flex items-center gap-2.5">
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[task.status]}`} />
                            <span className={`line-clamp-1 text-sm font-medium ${isDone ? "text-muted line-through decoration-muted/40" : "text-foreground"}`}>
                              {task.title}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {task.project ? (
                            <span className="rounded-full border border-accent/10 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                              {task.project}
                            </span>
                          ) : (
                            <span className="text-xs text-muted/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
                            {formatStatusLabel(task.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_BG[task.priority]}`}>
                            <PriorityIcon priority={task.priority} />
                            {formatPriorityLabel(task.priority)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted">
                          {formatShortDate(task.targetDate, locale)}
                        </td>
                        <td className="px-4 py-4">
                          {task.dueDate ? (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              isOverdue
                                ? "border-rose-200 bg-rose-50 text-rose-600"
                                : "border-white/60 bg-white/75 text-muted"
                            }`}>
                              {isOverdue ? (
                                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-rose-400" fill="currentColor">
                                  <path d="M5 1l4 8H1z" />
                                </svg>
                              ) : null}
                              {formatShortDate(task.dueDate, locale)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs font-medium text-muted">
                          {formatMinutes(task.plannedTime)}
                        </td>
                        <td className="w-20 px-4 py-4">
                          <button
                            type="button"
                            className="rounded-full border border-transparent bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-muted opacity-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-all hover:border-accent/20 hover:bg-accent-soft hover:text-accent sm:opacity-0 group-hover:sm:opacity-100"
                            onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                          >
                            {isFrench ? "Ouvrir" : "Open"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          ganttData ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="app-panel-soft flex flex-wrap items-center justify-between gap-3 rounded-[26px] px-4 py-3">
                <div>
                  <p className={sectionHeaderClass}>{isFrench ? "Calendrier opérationnel" : "Operational timeline"}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {isFrench
                      ? "Vue macro pour arbitrer les charges, les dates et les chevauchements."
                      : "Macro view for balancing workload, dates, and overlaps."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full border border-[#c3c0ff] bg-[#f2efff] px-3 py-1.5 font-semibold text-[#3323cc]">
                    {ganttData.totalDays} {isFrench ? "jours visibles" : "days visible"}
                  </span>
                  {ganttData.showTodayMarker ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 font-semibold text-rose-600">
                      {isFrench ? "Repère aujourd’hui" : "Today marker"}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-[30px] border border-white/60 bg-[rgba(255,255,255,0.76)] shadow-[0_24px_60px_rgba(16,0,105,0.1)] backdrop-blur">
                <div className="flex min-h-full min-w-[760px]">
                  <div className="flex w-60 shrink-0 flex-col border-r border-line/60 bg-[rgba(246,242,255,0.82)]">
                    <div className="flex h-[68px] items-end justify-between border-b border-line/60 px-4 pb-3">
                      <div>
                        <p className={sectionHeaderClass}>{isFrench ? "Tâches" : "Tasks"}</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{resultCountLabel}</p>
                      </div>
                      <span className="rounded-full border border-white/60 bg-white/80 px-3 py-1 text-[11px] font-semibold text-muted">
                        {statusScopeLabel}
                      </span>
                    </div>

                    {ganttData.bars.map(({ task }, index) => (
                      <div
                        key={task.id}
                        className={`flex h-14 cursor-pointer items-center gap-2.5 border-b border-line/60 px-4 transition-colors hover:bg-accent/[0.04] ${
                          index % 2 === 0 ? "bg-white/45" : "bg-surface-soft/45"
                        }`}
                        onClick={() => onEditTask(task)}
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[task.status]}`} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground" title={task.title}>
                            {task.title}
                          </p>
                          <p className="truncate text-[10px] text-muted">
                            {formatShortDate(task.targetDate, locale)}
                            {task.dueDate ? ` → ${formatShortDate(task.dueDate, locale)}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}

                    <div className="mt-auto border-t border-line/60 p-4">
                      <div className="dialog-section-shell rounded-[22px] px-3 py-3">
                        <p className={sectionHeaderClass}>{isFrench ? "Légende" : "Legend"}</p>
                        <div className="mt-3 space-y-2">
                          {(["todo", "in_progress", "done", "cancelled"] as TaskStatus[]).map((s) => (
                            <div key={s} className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`} />
                              <span className="text-[11px] text-muted">{formatStatusLabel(s)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-x-auto overflow-y-hidden">
                    <div className="relative min-h-full" style={{ minWidth: "640px" }}>
                      <div className="sticky top-0 z-10 h-[68px] border-b border-line/60 bg-[rgba(252,248,255,0.92)] backdrop-blur">
                        <div className="relative h-full">
                          {ganttData.months.map((month, index) => (
                            <div
                              key={index}
                              className="absolute flex h-full flex-col justify-center border-r border-line/50 px-4"
                              style={{ left: `${month.left}%`, width: `${month.width}%` }}
                            >
                              <span className="truncate text-xs font-semibold text-foreground">{month.label}</span>
                              {ganttData.days.length === 0 ? (
                                <span className="text-[10px] text-muted">{isFrench ? "vue mensuelle" : "monthly view"}</span>
                              ) : null}
                            </div>
                          ))}
                          {ganttData.days.length > 0 ? (
                            <div className="absolute bottom-0 left-0 right-0 flex h-6 border-t border-line/30">
                              {ganttData.days.map((day, index) => (
                                <div
                                  key={index}
                                  className={`absolute flex h-full items-center justify-center text-[9px] ${
                                    day.isWeekend ? "text-muted/40" : "text-muted/70"
                                  }`}
                                  style={{ left: `${day.left}%`, width: `${100 / ganttData.totalDays}%` }}
                                >
                                  {day.label}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {ganttData.bars.map(({ task, left, width }, index) => (
                        <div
                          key={task.id}
                          className={`relative h-14 border-b border-line/60 ${
                            index % 2 === 0 ? "bg-white/45" : "bg-surface-soft/45"
                          }`}
                        >
                          {ganttData.days.map((day, dayIndex) =>
                            day.isWeekend ? (
                              <div
                                key={dayIndex}
                                className="absolute inset-y-0 bg-[#f6f2ff]/70"
                                style={{ left: `${day.left}%`, width: `${100 / ganttData.totalDays}%` }}
                              />
                            ) : null
                          )}

                          {ganttData.months.map((month, monthIndex) => (
                            <div
                              key={monthIndex}
                              className="absolute inset-y-0 w-px bg-line/50"
                              style={{ left: `${month.left}%` }}
                            />
                          ))}

                          {ganttData.showTodayMarker ? (
                            <div
                              className="absolute inset-y-0 z-10 w-0.5 bg-rose-400/70"
                              style={{ left: `${ganttData.todayLeft}%` }}
                            />
                          ) : null}

                          <div
                            className={`absolute top-3 h-8 cursor-pointer rounded-full bg-gradient-to-r shadow-[0_14px_26px_rgba(16,0,105,0.16)] transition-all hover:-translate-y-0.5 hover:brightness-95 hover:shadow-[0_18px_34px_rgba(16,0,105,0.2)] ${GANTT_STATUS_BAR[task.status].from} ${GANTT_STATUS_BAR[task.status].to}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${task.title} · ${formatShortDate(task.targetDate, locale)}${task.dueDate ? ` → ${formatShortDate(task.dueDate, locale)}` : ""}`}
                            onClick={() => onEditTask(task)}
                          >
                            {width > 4 ? (
                              <span className="absolute inset-0 flex items-center truncate px-3 text-[10px] font-semibold text-white/95 drop-shadow-sm">
                                {task.title}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}

                      {ganttData.showTodayMarker ? (
                        <div
                          className="sticky bottom-0 z-20"
                          style={{ marginLeft: `${ganttData.todayLeft}%` }}
                        >
                          <span className="rounded-full bg-rose-500 px-2 py-1 text-[9px] font-bold text-white shadow-[0_10px_22px_rgba(244,63,94,0.22)]">
                            {isFrench ? "Auj." : "Today"}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null
        )}
      </div>

      {/* ── Cancelled count footnote ─────────────────────────────────────── */}
      {!isLoading && statsCancelled > 0 ? (
        <div className="shrink-0 px-4 pb-4 sm:px-6">
          <div className="dialog-section-shell flex items-center gap-2 rounded-[22px] px-4 py-3 text-[11px] text-muted">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-elevated text-muted">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
              </svg>
            </span>
            <p>
              + {statsCancelled} {isFrench ? "tâche(s) annulée(s) non affichée(s) dans le Gantt" : "cancelled task(s)"}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type RichTextEditorProps = {
  locale: UserLocale;
  value: string;
  disabled: boolean;
  onChange: (nextValue: string) => void;
  allowTextColor?: boolean;
  renderOptions?: RichTextRenderOptions;
  contentClassName?: string;
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
  allowTextColor,
}: {
  editor: Editor | null;
  disabled: boolean;
  locale: UserLocale;
  allowTextColor: boolean;
}) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) editor?.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
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

      {allowTextColor ? (
        <>
          <div className="mx-1 h-4 w-px bg-line" />

          <TiptapToolbarButton
            onClick={() => colorInputRef.current?.click()}
            disabled={disabled}
            title={isFrench ? "Couleur du texte" : "Text color"}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M8 1.5L3 13h2l1-2.5h4L11 13h2L8 1.5zm0 3l1.5 4h-3L8 4.5z"/>
              <rect x="3" y="14" width="10" height="1.5" fill={editor.getAttributes("textStyle").color ?? "currentColor"}/>
            </svg>
          </TiptapToolbarButton>
          <input
            ref={colorInputRef}
            type="color"
            className="sr-only"
            defaultValue="#000000"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </>
      ) : null}

      <TiptapToolbarButton
        onClick={() => imageInputRef.current?.click()}
        disabled={disabled}
        title={isFrench ? "Image" : "Image"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="2.5" width="13" height="11" rx="1.2"/><circle cx="5.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><path d="M1.5 11l3.5-3.5 3 3 2-2 4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </TiptapToolbarButton>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFile(file);
          e.target.value = "";
        }}
      />

      <TiptapToolbarButton
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        disabled={disabled}
        title={isFrench ? "Inserer un tableau" : "Insert table"}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="13" height="13" rx="1"/><line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/><line x1="1.5" y1="9.5" x2="14.5" y2="9.5"/><line x1="5.5" y1="5.5" x2="5.5" y2="14.5"/><line x1="10.5" y1="5.5" x2="10.5" y2="14.5"/></svg>
      </TiptapToolbarButton>

      {editor.isActive("table") && (
        <>
          <div className="mx-1 h-4 w-px bg-line" />
          <TiptapToolbarButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            disabled={disabled}
            title={isFrench ? "Ajouter une ligne" : "Add row"}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="13" height="7" rx="1"/><line x1="1.5" y1="5" x2="14.5" y2="5"/><line x1="8" y1="11" x2="8" y2="15"/><line x1="6" y1="13" x2="10" y2="13"/></svg>
          </TiptapToolbarButton>
          <TiptapToolbarButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            disabled={disabled}
            title={isFrench ? "Ajouter une colonne" : "Add column"}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="7" height="13" rx="1"/><line x1="5" y1="1.5" x2="5" y2="14.5"/><line x1="11" y1="6" x2="15" y2="6"/><line x1="13" y1="4" x2="13" y2="8"/></svg>
          </TiptapToolbarButton>
          <TiptapToolbarButton
            onClick={() => editor.chain().focus().deleteRow().run()}
            disabled={disabled}
            title={isFrench ? "Supprimer la ligne" : "Delete row"}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="13" height="7" rx="1"/><line x1="1.5" y1="5" x2="14.5" y2="5"/><line x1="6" y1="13" x2="10" y2="13"/></svg>
          </TiptapToolbarButton>
          <TiptapToolbarButton
            onClick={() => editor.chain().focus().deleteColumn().run()}
            disabled={disabled}
            title={isFrench ? "Supprimer la colonne" : "Delete column"}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="7" height="13" rx="1"/><line x1="5" y1="1.5" x2="5" y2="14.5"/><line x1="6" y1="13" x2="10" y2="13"/></svg>
          </TiptapToolbarButton>
          <TiptapToolbarButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            disabled={disabled}
            title={isFrench ? "Supprimer le tableau" : "Delete table"}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="13" height="13" rx="1"/><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
          </TiptapToolbarButton>
        </>
      )}
    </div>
  );
}

function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

function convertMarkdownToHtml(markdown: string, options: RichTextRenderOptions = {}): string {
  if (!markdown.trim()) return "";
  if (
    isHtmlContent(markdown)
    && options.preserveTextColor === undefined
    && options.recoverPlainText === undefined
  ) {
    return markdown;
  }
  return renderDescriptionHtml(markdown, options);
}

function RichTextEditor({
  locale,
  value,
  disabled,
  onChange,
  allowTextColor = true,
  renderOptions,
  contentClassName,
}: RichTextEditorProps) {
  const isFrench = locale === "fr";
  const lastExternalValueRef = useRef(value);
  const editorRef = useRef<Editor | null>(null);

  function insertImageFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) editorRef.current?.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  }

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
      TextStyle,
      Color,
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: convertMarkdownToHtml(value, renderOptions),
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
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
        if (!imageFiles.length) return false;
        event.preventDefault();
        imageFiles.forEach(insertImageFromFile);
        return true;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imageItems = Array.from(items).filter((item) => item.type.startsWith("image/"));
        if (!imageItems.length) return false;
        imageItems.forEach((item) => {
          const file = item.getAsFile();
          if (file) insertImageFromFile(file);
        });
        return imageItems.length > 0;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    if (value === lastExternalValueRef.current) return;
    lastExternalValueRef.current = value;
    const htmlContent = convertMarkdownToHtml(value, renderOptions);
    editor.commands.setContent(htmlContent, { emitUpdate: false });
  }, [editor, renderOptions, value]);

  return (
    <div className={`mt-1 overflow-x-hidden rounded-lg border border-line bg-surface transition-all duration-200 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 ${disabled ? "opacity-50" : ""}`}>
      <TiptapToolbar editor={editor} disabled={disabled} locale={locale} allowTextColor={allowTextColor} />
      <div className={contentClassName ?? ""}>
        <EditorContent editor={editor} />
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
  const assigneeNames = parseAssigneeNames(task.assignees);
  const descriptionPreview = task.description ? getRichTextPreviewText(task.description) : "";
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
      className={`task-card-shell group relative overflow-hidden rounded-[28px] px-5 py-5 transition-all duration-200 ${
        isDragging ? "scale-[0.97] opacity-70 shadow-lg ring-2 ring-accent/20" : "hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(16,0,105,0.12)]"
      } ${isSaving ? "cursor-wait opacity-80" : "cursor-grab active:cursor-grabbing"}`}
      aria-busy={isSaving}
      {...attributes}
      {...listeners}
    >
      <div className={`absolute inset-y-6 left-0 w-1 rounded-r-full ${
        task.priority === "high" ? "bg-red-400" : task.priority === "medium" ? "bg-[#4f46e5]" : "bg-[#c7c4d8]"
      }`} />

      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            task.project
              ? "bg-[#f2efff] text-[#4f46e5]"
              : task.priority === "high"
                ? "bg-red-50 text-red-600"
                : task.priority === "medium"
                  ? "bg-[#f5edff] text-[#581db3]"
                  : "bg-[#f2efff] text-[#464555]"
          }`}>
            {task.project ?? formatPriority(task.priority, locale)}
          </span>
          {task.recurrenceSourceTaskId ? (
            <span className="rounded-full bg-[#edf8d6] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#304f00]">
              {isFrench ? "Recurrente" : "Recurring"}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover:opacity-100">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-500"
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

      <div className="pl-2 pt-3">
        <h3 className="text-base font-semibold leading-6 text-foreground">{task.title}</h3>
        {descriptionPreview ? (
          <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted">
            {descriptionPreview}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 pl-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          {assigneeNames.length > 0 ? (
            <div className="flex -space-x-2">
              {assigneeNames.map((name) => (
                <span
                  key={name}
                  title={name}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#e9e5ff] text-[10px] font-semibold text-[#3323cc]"
                >
                  {getMonogram(name)}
                </span>
              ))}
            </div>
          ) : null}
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${priorityChipClassByPriority[task.priority]}`}
          >
            {formatPriority(task.priority, locale)}
          </span>
          {task.dueDate ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#f5edff] px-2 py-0.5 text-[11px] text-[#581db3]">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2.25" y="3" width="11.5" height="10.5" rx="2" />
                <path d="M5 1.75V4M11 1.75V4M2.25 6.25h11.5" strokeLinecap="round" />
              </svg>
              {formatDateOnlyForLocale(task.dueDate, locale)}
            </span>
          ) : null}
          {typeof task.plannedTime === "number" ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-soft px-2 py-0.5 text-[11px] text-muted">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="8" cy="8" r="5.75" />
                <path d="M8 4.5V8l2.75 1.5" strokeLinecap="round" />
              </svg>
              {formatPlannedTime(task.plannedTime)}
            </span>
          ) : null}
          {task.calendarEventId ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#edf8d6] px-2 py-0.5 text-[11px] font-medium text-[#304f00]">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 8h10M8 3v10" strokeLinecap="round" />
              </svg>
              {isFrench ? "Liee" : "Linked"}
            </span>
          ) : null}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {formatTaskStatus(task.status, locale)}
        </span>
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
      className={`mt-3 flex-1 space-y-4 overflow-y-auto rounded-[24px] pt-1 transition ${
        isOver ? statusDropClassByStatus[status] : "bg-transparent"
      }`}
    >
      {children}
    </div>
  );
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
  const dashboardBlockCollapsed = VISIBLE_DASHBOARD_BLOCKS;
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
  const [weeklyEntrySuccessMessage, setWeeklyEntrySuccessMessage] = useState<string | null>(null);
  const [monthlyEntry, setMonthlyEntry] = useState<MonthlyEntry | null>(null);
  const [monthlyObjective, setMonthlyObjective] = useState<string>("");
  const [monthlyReview, setMonthlyReview] = useState<string>("");
  const [monthlyEntryErrorMessage, setMonthlyEntryErrorMessage] = useState<string | null>(null);
  const [monthlyEntrySuccessMessage, setMonthlyEntrySuccessMessage] = useState<string | null>(null);
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
  const dashboardIconButtonClass = `${iconButtonClass} h-10 w-10 rounded-2xl px-0`;
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
        setExpandedCalendarEventId(null);
      } else {
        setCalendarEvents([]);
        setExpandedCalendarEventId(null);
      }
    } catch {
      setCalendarEvents([]);
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
    setWeeklyEntrySuccessMessage(null);
    setMonthlyEntry(null);
    setMonthlyObjective("");
    setMonthlyReview("");
    setMonthlyEntryErrorMessage(null);
    setMonthlyEntrySuccessMessage(null);
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
    setWeeklyEntryErrorMessage(null);
    setWeeklyEntrySuccessMessage(null);
    try {
      const saved = await upsertWeeklyEntry({ year, week, objective: weeklyObjective }, authToken);
      setWeeklyEntry(saved);
      setWeeklyObjective(saved.objective ?? "");
      setWeeklyEntrySuccessMessage(isFrench ? "Objectif hebdomadaire enregistré." : "Weekly objective saved.");
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
    setWeeklyEntryErrorMessage(null);
    setWeeklyEntrySuccessMessage(null);
    try {
      const saved = await upsertWeeklyEntry({ year, week, review: weeklyReview }, authToken);
      setWeeklyEntry(saved);
      setWeeklyReview(saved.review ?? "");
      setWeeklyEntrySuccessMessage(isFrench ? "Bilan hebdomadaire enregistré." : "Weekly review saved.");
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
    setMonthlyEntryErrorMessage(null);
    setMonthlyEntrySuccessMessage(null);
    try {
      const saved = await upsertMonthlyEntry({ year, month, objective: monthlyObjective }, authToken);
      setMonthlyEntry(saved);
      setMonthlyObjective(saved.objective ?? "");
      setMonthlyEntrySuccessMessage(isFrench ? "Objectif mensuel enregistré." : "Monthly objective saved.");
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
    setMonthlyEntryErrorMessage(null);
    setMonthlyEntrySuccessMessage(null);
    try {
      const saved = await upsertMonthlyEntry({ year, month, review: monthlyReview }, authToken);
      setMonthlyEntry(saved);
      setMonthlyReview(saved.review ?? "");
      setMonthlyEntrySuccessMessage(isFrench ? "Bilan mensuel enregistré." : "Monthly review saved.");
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
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id);
            break;
          }
        }
      },
      { threshold: 0.15, rootMargin: "-80px 0px -55% 0px" }
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
  const unresolvedReminders = reminders.filter((reminder) => !isReminderResolvedStatus(reminder.status));
  const reminderPastDueCount = unresolvedReminders.filter(
    (reminder) => new Date(reminder.remindAt).getTime() < Date.now()
  ).length;
  const reminderUpcomingCount = unresolvedReminders.length - reminderPastDueCount;
  const nextActiveReminder = sortRemindersByRemindAt(unresolvedReminders)[0] ?? null;
  const reminderPeoplePreview = Array.from(
    new Set(unresolvedReminders.flatMap((reminder) => parseAssigneeNames(reminder.assignees)))
  ).slice(0, 4);
  const noteStandaloneCount = notes.filter((note) => !note.linkedCalendarEvent).length;
  const noteLinkedCount = notes.length - noteStandaloneCount;
  const noteScheduledCount = notes.filter((note) => note.targetDate).length;
  const latestUpdatedNote = notes.reduce<Note | null>((latest, note) => {
    if (!latest) {
      return note;
    }

    return new Date(note.updatedAt).getTime() > new Date(latest.updatedAt).getTime() ? note : latest;
  }, null);
  const noteDialogAttachmentCount =
    noteDialogMode === "edit" && editingNoteId ? (noteAttachments[editingNoteId] ?? []).length : 0;
  const selectedNoteCalendarEventTitle =
    noteCalendarEventOptions.find((eventOption) => eventOption.id === noteFormValues.calendarEventId)?.title ??
    editingNote?.linkedCalendarEvent?.title ??
    null;
  const noteDialogPreview = getRichTextPreviewText(noteFormValues.body);
  const reminderDialogAttachmentCount =
    reminderDialogMode === "edit" && editingReminderId ? (reminderAttachments[editingReminderId] ?? []).length : 0;
  const reminderDialogAssigneePreview = parseAssigneeNames(reminderFormValues.assignees).slice(0, 4);
  const reminderDialogScheduleLabel = reminderFormValues.remindAt
    ? formatDateTime(reminderFormValues.remindAt, activeLocale, activeTimeZone)
    : null;
  const totalPlannedMinutes = tasks.reduce((total, task) => total + (task.plannedTime ?? 0), 0);
  const actionableTaskCount = tasksByStatus.todo.length + tasksByStatus.in_progress.length;
  const isAffirmationCompleted = dayAffirmation?.isCompleted ?? false;
  const dayAffirmationCharacterCount = getRichTextCharacterCount(dayAffirmationDraft);
  const completionItemCount = tasks.length + 1;
  const completedItemCount = tasksByStatus.done.length + (isAffirmationCompleted ? 1 : 0);
  const completionRate =
    completionItemCount === 0 ? 0 : Math.round((completedItemCount / completionItemCount) * 100);
  const dashboardAlertPreviewItems = alertPanelItems.slice(0, 3);
  const dashboardCalendarPreviewEvents = calendarEvents.slice(0, 4);
  const dashboardAffirmationPreview = getRichTextPreviewText(dayAffirmationDraft);
  const dashboardBilanWinsPreview = getRichTextPreviewText(dayBilanFormValues.wins);
  const dashboardBilanBlockersPreview = getRichTextPreviewText(dayBilanFormValues.blockers);
  const dashboardBilanLessonsPreview = getRichTextPreviewText(dayBilanFormValues.lessonsLearned);
  const dashboardBilanTomorrowPreview = getRichTextPreviewText(dayBilanFormValues.tomorrowTop3);
  const boardPeoplePreview = Array.from(
    new Set(filteredTasks.flatMap((task) => parseAssigneeNames(task.assignees)))
  ).slice(0, 4);
  const boardActiveFilterCount =
    Number(taskFilterValues.query.trim().length > 0) +
    Number(taskFilterValues.status !== "all") +
    Number(taskFilterValues.priority !== "all") +
    Number(taskFilterValues.project.length > 0);
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

  const selectedDateObj = parseDateInput(selectedDate);
  const showWeeklyObjectiveSurface =
    Boolean(authUser?.requireWeeklySynthesis) || !isRichTextEmpty(weeklyObjective);
  const showWeeklyReviewSurface =
    (Boolean(authUser?.requireWeeklySynthesis) || !isRichTextEmpty(weeklyReview)) &&
    isSunday(selectedDateObj);
  const showMonthlyObjectiveSurface =
    Boolean(authUser?.requireMonthlySynthesis) || !isRichTextEmpty(monthlyObjective);
  const showMonthlyReviewSurface =
    (Boolean(authUser?.requireMonthlySynthesis) || !isRichTextEmpty(monthlyReview)) &&
    isLastDayOfMonth(selectedDateObj);

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
        onCreateTask={() => openCreateTaskDialog()}
        showMonthlyObjective={showMonthlyObjectiveSurface}
        showMonthlyReview={showMonthlyReviewSurface}
        showWeeklyObjective={showWeeklyObjectiveSurface}
        showWeeklyReview={showWeeklyReviewSurface}
        activeSectionId={activeSectionId}
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

    <div className={`fixed right-0 top-0 z-20 hidden h-[78px] items-center justify-between border-b border-line/40 bg-surface-soft/88 px-8 shadow-[0_20px_44px_rgba(16,0,105,0.06)] backdrop-blur-xl transition-[left] duration-200 lg:flex ${isSidebarCollapsed ? "left-[56px]" : "left-[260px]"}`}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className={controlIconButtonClass}
          onClick={() => handleDateChange(shiftDate(selectedDate, -1))}
          disabled={isMutationPending}
          aria-label={isFrench ? "Jour precedent" : "Previous day"}
        >
          <ArrowLeftIcon />
        </button>
        <div className="min-w-[180px] text-center">
          <h1 className="text-2xl font-black tracking-[-0.04em] text-accent">
            {getDateHeading(selectedDate, activeLocale)}
          </h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
            {isFrench ? "Contexte actif" : "Active context"}
          </p>
        </div>
        <button
          type="button"
          className={controlIconButtonClass}
          onClick={() => handleDateChange(shiftDate(selectedDate, 1))}
          disabled={isMutationPending}
          aria-label={isFrench ? "Jour suivant" : "Next day"}
        >
          <ArrowRightIcon />
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => {
            if (event.target.value) {
              handleDateChange(event.target.value);
            }
          }}
          disabled={isMutationPending}
          className="ml-2 hidden rounded-full border border-line bg-white/84 px-4 py-2.5 text-sm text-foreground outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15 xl:block"
        />
        <button
          type="button"
          className={`${controlButtonClass} hidden xl:inline-flex`}
          onClick={() => handleDateChange(toDateInputValue(new Date()))}
          disabled={isMutationPending}
        >
          {isFrench ? "Aujourd'hui" : "Today"}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="segmented-surface hidden w-56 items-center gap-2.5 rounded-full px-4 py-2.5 text-sm text-muted transition-colors hover:text-accent xl:flex 2xl:w-80"
          onClick={() => setIsSearchModalOpen(true)}
        >
          <SearchIcon />
          <span className="flex-1 text-left">{isFrench ? "Rechercher dans Jotly..." : "Search workspace..."}</span>
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">⌘K</kbd>
        </button>
        <button
          type="button"
          className={`${controlIconButtonClass} xl:hidden`}
          onClick={() => setIsSearchModalOpen(true)}
          aria-label={isFrench ? "Rechercher" : "Search"}
        >
          <SearchIcon />
        </button>
        <button
          type="button"
          className={`${controlIconButtonClass} hidden xl:inline-flex 2xl:hidden`}
          onClick={handleCarryOverYesterday}
          disabled={isMutationPending || isLoading || isDayAffirmationSaving}
          aria-label={isFrench ? "Copier hier" : "Carry over"}
          title={isFrench ? "Copier hier" : "Carry over"}
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          className={`${controlButtonClass} hidden 2xl:inline-flex`}
          onClick={handleCarryOverYesterday}
          disabled={isMutationPending || isLoading || isDayAffirmationSaving}
        >
          <CopyIcon />
          {isCarryingOverYesterday
            ? isFrench
              ? "Copie..."
              : "Carrying..."
            : isFrench
            ? "Copier hier"
            : "Carry over"}
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => openCreateTaskDialog()}
          disabled={isMutationPending}
        >
          <PlusIcon />
          {isFrench ? "Nouvelle entree" : "New Entry"}
        </button>
        <button
          type="button"
          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isTaskAlertsPanelOpen ? "bg-accent-soft text-accent" : "bg-white/72 text-muted hover:bg-surface-elevated hover:text-accent"}`}
          onClick={toggleTaskAlertsPanel}
          disabled={isMutationPending || isLoading}
          aria-label={isFrench ? "Alertes" : "Alerts"}
        >
          <BellIcon />
          {alertsSummary.count > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
              {alertsSummary.count > 9 ? "9+" : alertsSummary.count}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-accent-soft text-xs font-black text-accent shadow-[0_12px_24px_rgba(16,0,105,0.08)]"
          onClick={openProfileDialog}
          disabled={isMutationPending || isLoading}
          aria-label={authUser?.displayName ?? authUser?.email ?? (isFrench ? "Profil" : "Profile")}
          title={authUser?.displayName ?? authUser?.email ?? (isFrench ? "Profil" : "Profile")}
        >
          {(authUser?.displayName ?? authUser?.email ?? "J").slice(0, 2).toUpperCase()}
        </button>
      </div>
    </div>

    <div className={`app-shell-page flex min-h-screen flex-col gap-6 px-4 py-6 pb-24 sm:px-8 lg:pb-8 lg:px-10 lg:pt-28 ${isSidebarCollapsed ? "lg:ml-[56px]" : "lg:ml-[260px]"} transition-[margin] duration-200`}>
      <header
        id="overview"
        className={`${dashboardSectionClass} overflow-hidden`}
      >
        <div className="hidden items-end justify-between gap-4 lg:flex">
          <div>
            <p className={sectionHeaderClass}>{isFrench ? "Dashboard" : "Dashboard"}</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-foreground">
              {isFrench ? "Workspace quotidien" : "Daily Workspace"}
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              {isFrench
                ? "Vue operationnelle des taches, du contexte calendrier et des alertes du jour."
                : "Operational view for tasks, calendar context, and today's active alerts."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 lg:hidden">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className={controlIconButtonClass}
              onClick={() => handleDateChange(shiftDate(selectedDate, -1))}
              disabled={isMutationPending}
              aria-label={isFrench ? "Jour precedent" : "Previous day"}
            >
              <ArrowLeftIcon />
            </button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">
                {isFrench ? "Contexte du jour" : "Day context"}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-accent sm:text-3xl">
                {getDateHeading(selectedDate, activeLocale)}
              </h1>
            </div>
            <button
              type="button"
              className={controlIconButtonClass}
              onClick={() => handleDateChange(shiftDate(selectedDate, 1))}
              disabled={isMutationPending}
              aria-label={isFrench ? "Jour suivant" : "Next day"}
            >
              <ArrowRightIcon />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={controlButtonClass}
              onClick={() => handleDateChange(toDateInputValue(new Date()))}
              disabled={isMutationPending}
            >
              {isFrench ? "Aujourd'hui" : "Today"}
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                if (event.target.value) {
                  handleDateChange(event.target.value);
                }
              }}
              disabled={isMutationPending}
              className="hidden rounded-full border border-line bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15 sm:block"
            />
            <button
              type="button"
              className={`${controlButtonClass} hidden sm:inline-flex`}
              onClick={handleCarryOverYesterday}
              disabled={isMutationPending || isLoading || isDayAffirmationSaving}
            >
              <CopyIcon />
              {isCarryingOverYesterday
                ? isFrench
                  ? "Copie..."
                  : "Carrying..."
                : isFrench
                ? "Copier hier"
                : "Carry over"}
            </button>
            <button
              type="button"
              className={`${primaryButtonClass} hidden sm:inline-flex`}
              onClick={() => openCreateTaskDialog()}
              disabled={isMutationPending}
            >
              <PlusIcon />
              {isFrench ? "Nouvelle tache" : "New Task"}
            </button>
          </div>
        </div>

        {carryOverMessage ? (
          <p className="mt-4 rounded-[22px] border border-[#cfe8a8] bg-[#edf8d6] px-4 py-3 text-sm text-[#304f00]">
            {carryOverMessage}
          </p>
        ) : null}
        {carryOverErrorMessage ? (
          <p className="mt-4 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {carryOverErrorMessage}
          </p>
        ) : null}

        {dashboardBlockCollapsed.overview ? (
          <p className="mt-3 text-xs text-muted">{collapsedHintLabel}</p>
        ) : (
          <>
            <div className="mt-6 grid gap-4 lg:grid-cols-12">
              <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
                <div className={`${dashboardMetricCardClass} min-h-[118px]`}>
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="14" height="11" rx="2"/><path d="M7 3v4M13 3v4M3 9h14" strokeLinecap="round"/></svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{isFrench ? "Total taches" : "Total Tasks"}</p>
                    <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">{tasks.length}</p>
                  </div>
                </div>
                <div className={`${dashboardMetricCardClass} min-h-[118px]`}>
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f5edff] text-[#581db3]">
                    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 3v14M5 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{isFrench ? "Actionnables" : "Actionable"}</p>
                    <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">{actionableTaskCount}</p>
                  </div>
                </div>
                <div className={`${dashboardMetricCardClass} min-h-[118px]`}>
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#edf8d6] text-[#426b00]">
                    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="7"/><path d="M10 6v4.5l2.8 1.7" strokeLinecap="round"/></svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{isFrench ? "Temps planifie" : "Planned Time"}</p>
                    <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">{formatPlannedTime(totalPlannedMinutes)}</p>
                  </div>
                </div>
              </div>

              <section className="order-first overflow-hidden rounded-[28px] bg-gradient-to-br from-accent via-[#4338ca] to-accent-strong p-5 text-white shadow-[0_24px_56px_rgba(53,37,205,0.24)] lg:order-none lg:col-span-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white/72">{isFrench ? "Flux quotidien" : "Daily Flow"}</p>
                    <h2 className="mt-2 text-5xl font-black tracking-[-0.06em]">{completionRate}%</h2>
                  </div>
                  <div className="relative h-20 w-20 shrink-0">
                    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/20" />
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray="213.6"
                        strokeDashoffset={213.6 - (213.6 * completionRate) / 100}
                        className="text-reward"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-reward">
                      <LightningIcon />
                    </span>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/12 pt-5 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/58">{isFrench ? "Total" : "Total"}</p>
                    <p className="mt-1 font-bold">{tasks.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/58">{isFrench ? "Actives" : "Active"}</p>
                    <p className="mt-1 font-bold">{actionableTaskCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/58">{isFrench ? "Plan" : "Plan"}</p>
                    <p className="mt-1 font-bold">{formatPlannedTime(totalPlannedMinutes)}</p>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3 sm:hidden">
                <button
                  type="button"
                  className="metric-card flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[28px] p-4 text-center"
                  onClick={handleCarryOverYesterday}
                  disabled={isMutationPending || isLoading || isDayAffirmationSaving}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                    <CopyIcon />
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {isFrench ? "Copier les taches d'hier" : "Carry Over Tasks"}
                  </span>
                </button>
                <button
                  type="button"
                  className="metric-card flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[28px] p-4 text-center"
                  onClick={() => openCreateTaskDialog()}
                  disabled={isMutationPending}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                    <PlusIcon />
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {isFrench ? "Nouvelle tache" : "New Task"}
                  </span>
                </button>
              </div>

              <div className="hidden gap-4 sm:grid lg:hidden">
                <section className="rounded-[28px] bg-gradient-to-br from-[#6e3aca] via-accent-strong to-accent p-5 text-white shadow-[0_24px_56px_rgba(53,37,205,0.16)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/62">
                    {isFrench ? "Ancre quotidienne" : "Daily Anchor"}
                  </p>
                  <p className="mt-4 text-lg font-semibold leading-8">
                    &quot;{dashboardAffirmationPreview || (isFrench ? "Ecrivez votre intention du jour pour garder le cap." : "Write your daily intention to keep momentum.")}&quot;
                  </p>
                </section>

                <section className="app-panel-soft rounded-[28px] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-foreground">{isFrench ? "Alertes actives" : "Active Alerts"}</h3>
                      <p className="text-xs text-muted">
                        {alertsSummary.count > 0
                          ? isFrench
                            ? `${alertsSummary.count} element(s) a surveiller.`
                            : `${alertsSummary.count} item(s) need attention.`
                          : isFrench
                          ? "Aucune alerte critique pour le moment."
                          : "No critical alerts right now."}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-accent transition-colors hover:text-accent-strong"
                      onClick={toggleTaskAlertsPanel}
                    >
                      {isFrench ? "Ouvrir" : "Open"}
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {dashboardAlertPreviewItems.length > 0 ? dashboardAlertPreviewItems.map((item) => (
                      <div key={`${item.sourceType}-${item.sourceType === "task" ? item.task.id : item.reminder.id}`} className="flex items-start gap-3 rounded-[20px] bg-white/78 px-4 py-3">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${
                          item.urgency === "overdue"
                            ? "bg-red-500"
                            : item.urgency === "today"
                              ? "bg-[#8856e5]"
                              : "bg-[#4f46e5]"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.sourceType === "task" ? item.task.title : item.reminder.title}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {item.sourceType === "task"
                              ? `${formatDateOnlyForLocale(item.task.dueDate ?? selectedDate, activeLocale)} · ${item.task.project ?? (isFrench ? "Tache" : "Task")}`
                              : `${formatDateTime(item.reminder.remindAt, activeLocale, activeTimeZone)} · ${item.reminder.project ?? (isFrench ? "Rappel" : "Reminder")}`}
                          </p>
                        </div>
                      </div>
                    )) : (
                      <div className={dashboardEmptyStateClass}>
                        {isFrench ? "Aucune alerte active." : "No active alerts."}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>

            <div className="mt-4 hidden gap-4 lg:grid lg:grid-cols-12">
              <section className="app-panel-soft rounded-[28px] p-5 lg:col-span-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      {isFrench ? "Google Calendar" : "Google Calendar"}
                    </p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-foreground">
                      {isFrench ? "Contexte calendrier" : "Calendar Context"}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {isFrench
                        ? "Evenements synchronises et actions liees pour la journee."
                        : "Synced events and linked actions for the day."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={controlButtonClass}
                    onClick={() => document.getElementById("dailyControls")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    <CalendarIcon />
                    {isFrench ? "Calendrier" : "Calendar"}
                  </button>
                </div>

                {googleCalendarConnections.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between rounded-[22px] bg-white/74 px-4 py-3">
                      <span className="text-sm font-semibold text-foreground">
                        {isCalendarEventsLoading
                          ? isFrench
                            ? "Synchronisation..."
                            : "Syncing..."
                          : `${calendarEvents.length} ${isFrench ? "evenement" : "event"}${calendarEvents.length === 1 ? "" : "s"}`}
                      </span>
                      <span className="rounded-full bg-accent-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                        {isFrench ? "Aujourd'hui" : "Today"}
                      </span>
                    </div>

                    {dashboardCalendarPreviewEvents.length > 0 ? (
                      dashboardCalendarPreviewEvents.map((event) => {
                        const eventAccentColor = connectionColorMap.get(event.connectionId) ?? "#6366f1";

                        return (
                          <article
                            key={event.id}
                            className="group flex items-center gap-4 rounded-[24px] border border-line/70 bg-white/84 px-4 py-3 transition-all hover:border-accent/20 hover:bg-surface-container-low"
                          >
                            <div className="min-w-[78px]">
                              <p className="text-sm font-black text-foreground">
                                {formatCalendarEventTimeLabel(event, activeLocale, activeTimeZone)}
                              </p>
                              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                                {event.isAllDay ? (isFrench ? "Jour" : "All day") : (isFrench ? "Event" : "Event")}
                              </p>
                            </div>
                            <span className="h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: eventAccentColor }} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-bold text-foreground">{event.title}</p>
                                {event.linkedTasks.length > 0 ? (
                                  <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                                    {event.linkedTasks.length}
                                  </span>
                                ) : null}
                                {event.note ? (
                                  <span className="shrink-0 text-accent" title={isFrench ? "Note interne" : "Internal note"}>
                                    <ChatIcon />
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 truncate text-xs text-muted">
                                {event.location ||
                                  event.description ||
                                  (isFrench ? "Evenement synchronise avec le contexte du jour." : "Event synced into today's context.")}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-line bg-white text-muted transition-colors hover:border-accent hover:text-accent"
                              onClick={() => {
                                setExpandedCalendarEventId(event.id);
                                document.getElementById("dailyControls")?.scrollIntoView({ behavior: "smooth" });
                              }}
                              aria-label={isFrench ? "Ouvrir l'evenement" : "Open event"}
                              title={isFrench ? "Ouvrir l'evenement" : "Open event"}
                            >
                              <ArrowRightIcon />
                            </button>
                          </article>
                        );
                      })
                    ) : (
                      <div className={dashboardEmptyStateClass}>
                        {isCalendarEventsLoading
                          ? isFrench
                            ? "Chargement des evenements..."
                            : "Loading events..."
                          : isFrench
                          ? "Aucun evenement pour cette date."
                          : "No events for this date."}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`${dashboardEmptyStateClass} mt-5`}>
                    {isFrench
                      ? "Aucun compte Google Calendar connecte. Ouvrez le profil pour synchroniser les evenements."
                      : "No Google Calendar account is connected. Open profile settings to sync events."}
                  </div>
                )}
              </section>

              <div className="grid gap-4 lg:col-span-5">
                <section className="rounded-[28px] bg-gradient-to-br from-[#6e3aca] via-accent-strong to-accent p-5 text-white shadow-[0_24px_56px_rgba(53,37,205,0.16)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/62">
                        {isFrench ? "Day Affirmation" : "Day Affirmation"}
                      </p>
                      <h3 className="mt-2 text-xl font-black tracking-[-0.04em]">
                        {isAffirmationCompleted
                          ? isFrench
                            ? "Ancre terminee"
                            : "Anchor completed"
                          : isFrench
                          ? "Ancre du jour"
                          : "Daily Anchor"}
                      </h3>
                    </div>
                    <span className="rounded-full bg-white/14 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/78">
                      {isAffirmationCompleted ? (isFrench ? "Done" : "Done") : (isFrench ? "Draft" : "Draft")}
                    </span>
                  </div>
                  <p className="mt-5 line-clamp-5 text-base font-semibold leading-8 text-white/94">
                    &quot;{dashboardAffirmationPreview || (isFrench ? "Ecrivez votre intention du jour pour garder le cap." : "Write your daily intention to keep momentum.")}&quot;
                  </p>
                  <button
                    type="button"
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/22"
                    onClick={() => document.getElementById("affirmation")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    <PencilIcon />
                    {isFrench ? "Modifier" : "Edit"}
                  </button>
                </section>

                <section className="app-panel-soft rounded-[28px] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        {isFrench ? "Active Alerts" : "Active Alerts"}
                      </p>
                      <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-foreground">
                        {alertsSummary.count > 0
                          ? isFrench
                            ? `${alertsSummary.count} signal${alertsSummary.count === 1 ? "" : "s"}`
                            : `${alertsSummary.count} signal${alertsSummary.count === 1 ? "" : "s"}`
                          : isFrench
                          ? "Aucune alerte"
                          : "No alerts"}
                      </h3>
                    </div>
                    <button
                      type="button"
                      className={controlIconButtonClass}
                      onClick={toggleTaskAlertsPanel}
                      aria-label={isFrench ? "Ouvrir les alertes" : "Open alerts"}
                      title={isFrench ? "Ouvrir les alertes" : "Open alerts"}
                    >
                      <BellIcon />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {dashboardAlertPreviewItems.length > 0 ? dashboardAlertPreviewItems.map((item) => (
                      <div key={`${item.sourceType}-${item.sourceType === "task" ? item.task.id : item.reminder.id}`} className="flex items-start gap-3 rounded-[20px] bg-white/78 px-4 py-3">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${
                          item.urgency === "overdue"
                            ? "bg-red-500"
                            : item.urgency === "today"
                              ? "bg-[#8856e5]"
                              : "bg-[#4f46e5]"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.sourceType === "task" ? item.task.title : item.reminder.title}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {item.sourceType === "task"
                              ? `${formatDateOnlyForLocale(item.task.dueDate ?? selectedDate, activeLocale)} - ${item.task.project ?? (isFrench ? "Tache" : "Task")}`
                              : `${formatDateTime(item.reminder.remindAt, activeLocale, activeTimeZone)} - ${item.reminder.project ?? (isFrench ? "Rappel" : "Reminder")}`}
                          </p>
                        </div>
                      </div>
                    )) : (
                      <div className={dashboardEmptyStateClass}>
                        {isFrench ? "Aucune alerte active." : "No active alerts."}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section className="app-panel-soft rounded-[28px] p-5 lg:col-span-12">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      {isFrench ? "Day Bilan" : "Day Bilan"}
                    </p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-foreground">
                      {isFrench ? "Revue complete du jour" : "Full Daily Review"}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {isFrench
                        ? "Humeur, victoire, blocages, apprentissages et top 3 de demain."
                        : "Mood, win, blockers, lessons, and tomorrow's top 3."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => document.getElementById("bilan")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    <PencilIcon />
                    {isFrench ? "Completer" : "Complete"}
                  </button>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-5">
                  <div className="rounded-[22px] bg-white/82 px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      {isFrench ? "Humeur" : "Daily Mood"}
                    </p>
                    <p className="mt-3 text-2xl font-extrabold text-foreground">
                      {dayBilanFormValues.mood || dayBilan?.mood ? `${dayBilanFormValues.mood || dayBilan?.mood}/5` : "-"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted">
                      {dayBilanFormValues.mood || dayBilan?.mood
                        ? isFrench ? "Energie capturee." : "Mood captured."
                        : isFrench ? "Ajoutez votre ressenti." : "Add your emotional pulse."}
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-white/82 px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      {isFrench ? "Big win" : "Big Win"}
                    </p>
                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-foreground">
                      {dashboardBilanWinsPreview
                        ? dashboardBilanWinsPreview.slice(0, 120)
                        : isFrench ? "Notez ce qui a vraiment avance." : "Capture what really moved forward."}
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-white/82 px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      {isFrench ? "Blocages" : "Blockers"}
                    </p>
                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-foreground">
                      {dashboardBilanBlockersPreview
                        ? dashboardBilanBlockersPreview.slice(0, 120)
                        : isFrench ? "Identifiez les frictions utiles." : "Identify useful friction points."}
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-white/82 px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      {isFrench ? "Lecons" : "Lessons"}
                    </p>
                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-foreground">
                      {dashboardBilanLessonsPreview
                        ? dashboardBilanLessonsPreview.slice(0, 120)
                        : isFrench ? "Gardez les apprentissages visibles." : "Keep useful learnings visible."}
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-gradient-to-br from-accent to-accent-strong px-4 py-4 text-white">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/68">
                      {isFrench ? "Demain" : "Tomorrow Top 3"}
                    </p>
                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-white">
                      {dashboardBilanTomorrowPreview
                        ? dashboardBilanTomorrowPreview.slice(0, 120)
                        : isFrench ? "Definir les 3 prochaines priorites." : "Define the next three focused moves."}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <section className="mt-4 hidden app-panel-soft rounded-[28px] p-5 sm:block lg:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{isFrench ? "Day Bilan" : "Day Bilan"}</h3>
                  <p className="text-xs text-muted">
                    {isFrench ? "Reflet de votre execution et des prochains leviers." : "A compact reflection of execution and next moves."}
                  </p>
                </div>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => document.getElementById("bilan")?.scrollIntoView({ behavior: "smooth" })}
                >
                  <ArrowRightIcon />
                  {isFrench ? "Voir le bilan" : "View Review"}
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-[22px] bg-white/82 px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{isFrench ? "Humeur" : "Daily Mood"}</p>
                  <p className="mt-3 text-2xl font-extrabold text-foreground">{dayBilan?.mood ? `${dayBilan.mood}/5` : "—"}</p>
                  <p className="mt-2 text-xs text-muted">
                    {dayBilan?.mood
                      ? isFrench ? "Energie capturée." : "Mood captured."
                      : isFrench ? "Ajoutez votre ressenti." : "Add your emotional pulse."}
                  </p>
                </div>
                <div className="rounded-[22px] bg-white/82 px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{isFrench ? "Wins" : "Wins"}</p>
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    {dayBilan?.wins ? getRichTextPreviewText(dayBilan.wins).slice(0, 96) || "—" : (isFrench ? "Notez vos victoires du jour." : "Capture what moved forward today.")}
                  </p>
                </div>
                <div className="rounded-[22px] bg-white/82 px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{isFrench ? "Blocages" : "Main Blockers"}</p>
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    {dayBilan?.blockers ? getRichTextPreviewText(dayBilan.blockers).slice(0, 96) || "—" : (isFrench ? "Aucun blocage renseigné." : "No blockers documented yet.")}
                  </p>
                </div>
                <div className="rounded-[22px] bg-gradient-to-br from-accent to-accent-strong px-4 py-4 text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/68">{isFrench ? "Demain" : "Tomorrow's Top 3"}</p>
                  <p className="mt-3 text-sm leading-6 text-white">
                    {dayBilan?.tomorrowTop3 ? getRichTextPreviewText(dayBilan.tomorrowTop3).slice(0, 96) || "—" : (isFrench ? "Definir les 3 prochaines priorites." : "Define the next three focused moves.")}
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </header>

      <section
        id="board"
        className={dashboardSectionClass}
        style={{ animationDelay: "0.2s" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={sectionHeaderClass}>{isFrench ? "Tableau Kanban" : "Kanban Board"}</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-foreground sm:text-4xl">
              {isFrench ? "Flux du jour" : "Task Flow"}
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              {isFrench
                ? "Visualisez les statuts actifs pour la date selectionnee et faites avancer les priorites."
                : "Visualize active statuses for the selected date and keep momentum visible."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {boardPeoplePreview.length > 0 ? (
              <div className="hidden items-center sm:flex">
                <div className="flex -space-x-3">
                  {boardPeoplePreview.map((name) => (
                    <span
                      key={name}
                      title={name}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border-4 border-background bg-[#e9e5ff] text-xs font-bold text-accent shadow-[0_10px_20px_rgba(16,0,105,0.08)]"
                    >
                      {getMonogram(name)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className={`${controlButtonClass} hidden sm:inline-flex`}
              onClick={() => document.getElementById("boardFilters")?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
            >
              <SearchIcon />
              {hasActiveTaskFilters
                ? isFrench
                  ? `${boardActiveFilterCount} filtre(s)`
                  : `${boardActiveFilterCount} filter(s)`
                : isFrench
                ? "Filtres"
                : "Filter"}
            </button>
          </div>
        </div>

        {dragErrorMessage ? (
          <p className="mt-4 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dragErrorMessage}
          </p>
        ) : null}

        {dashboardBlockCollapsed.board ? (
          <p className="mt-3 text-xs text-muted">{collapsedHintLabel}</p>
        ) : (
          <>
            <section id="boardFilters" className={`mt-5 hidden sm:block ${dashboardInsetPanelClass}`}>
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
              <main className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-4">
                {boardColumns.map((column) => {
                  const columnTasks = filteredTasksByStatus[column.status];
                  const totalColumnTasks = tasksByStatus[column.status];

                  return (
                    <section
                      key={column.status}
                      className={`${kanbanColumnShellClass} ${statusColumnClassByStatus[column.status]} min-w-[84vw] snap-center md:min-w-0`}
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

      <section id="dailyControls"
        className={dashboardSectionClass}
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={sectionHeaderClass}>
              {isFrench ? "Calendrier" : "Calendar"}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-foreground sm:text-4xl">
              {isFrench ? "Contexte calendrier" : "Calendar Context"}
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              {isFrench
                ? "Inspectez les evenements synchronises et transformez-les en actions Jotly."
                : "Inspect synced events and turn them into Jotly actions."}
            </p>
          </div>
        </div>

        {dashboardBlockCollapsed.dailyControls ? (
          <p className="mt-3 text-xs text-muted">{collapsedHintLabel}</p>
        ) : (
          <>
            {googleCalendarConnections.length > 0 ? (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {isFrench ? "Evenements du calendrier" : "Calendar Events"}
                    </h3>
                    <p className="text-xs text-muted">
                      {googleCalendarConnections.length > 0
                        ? isFrench
                          ? "Contexte synchronise avec vos comptes connectes."
                          : "Synchronized context across your connected accounts."
                        : null}
                    </p>
                  </div>
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                    {isCalendarEventsLoading
                      ? "Sync..."
                      : `${filteredCalendarEvents.length} ${isFrench ? "items" : "items"}`}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
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
                  <div className="mt-3 space-y-3">
                    {filteredCalendarEvents.map((event) => {
                      const isExpanded = expandedCalendarEventId === event.id;
                      const hasNote = Boolean(event.note);
                      const hasLinkedTasks = event.linkedTasks.length > 0;

                      return (
                        <div key={event.id} className={`overflow-hidden rounded-[26px] border transition-all ${
                          isExpanded
                            ? "border-accent/20 bg-surface-container shadow-[0_18px_40px_rgba(16,0,105,0.08)]"
                            : "border-line/70 bg-white/88 hover:border-accent/20 hover:bg-surface-container-low"
                        }`}>
                          {/* Compact row — always visible */}
                          <button
                            type="button"
                            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors"
                            onClick={() => setExpandedCalendarEventId(isExpanded ? null : event.id)}
                          >
                            <div className="min-w-[56px] text-center">
                              <p className="text-sm font-black text-foreground">
                                {formatCalendarEventTimeLabel(event, activeLocale, activeTimeZone)}
                              </p>
                              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                                {event.isAllDay ? (isFrench ? "Jour" : "All day") : (isFrench ? "Event" : "Event")}
                              </p>
                            </div>
                            <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: connectionColorMap.get(event.connectionId) ?? "#6366f1" }} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-bold text-foreground">
                                  {event.title}
                                </span>
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: connectionColorMap.get(event.connectionId) ?? "#6366f1" }} />
                              </div>
                              <p className="mt-1 truncate text-xs font-medium text-muted">
                                {event.location
                                  || event.description
                                  || (isFrench ? "Evenement synchronise avec votre contexte du jour." : "Event synchronized into your day context.")}
                              </p>
                            </div>
                            {hasNote ? (
                              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" title={isFrench ? "Note interne" : "Internal note"}>
                                <ChatIcon />
                              </span>
                            ) : null}
                            {hasLinkedTasks ? (
                              <span className="shrink-0 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent">
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
            ) : (
              <div className={`${dashboardEmptyStateClass} mt-5`}>
                {isFrench
                  ? "Aucun compte Google Calendar connecte. Ouvrez les parametres du profil pour synchroniser les evenements."
                  : "No Google Calendar account is connected. Open profile settings to sync events."}
              </div>
            )}
          </>
        )}
      </section>

      <section
        id="affirmation"
        className="animate-fade-in-up overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50/50 via-surface to-violet-50/30 p-6 shadow-sm"
        style={{ animationDelay: "0.15s" }}
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
        className={`${dashboardSectionClass} overflow-hidden`}
        style={{ animationDelay: "0.18s" }}
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
              <p className={`mt-4 ${dashboardEmptyStateClass}`}>
                {isFrench ? "Chargement..." : "Loading..."}
              </p>
            ) : reminders.length === 0 ? (
              <div className={`mt-4 ${dashboardEmptyStateClass} space-y-4`}>
                <p>{isFrench ? "Aucun rappel actif." : "No active reminders."}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={openCreateReminderDialog}
                    disabled={isLoadingReminders}
                  >
                    <PlusIcon />
                    {isFrench ? "Creer un rappel" : "Create reminder"}
                  </button>
                  <span className="text-xs text-muted">
                    {isFrench
                      ? "Planifiez un suivi précis pour garder le bon rythme."
                      : "Schedule a precise follow-up to keep the day on pace."}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)]">
                  <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#3525cd] via-[#6e3aca] to-[#91db2a] px-5 py-5 text-white shadow-[0_28px_56px_rgba(53,37,205,0.24)]">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/72">
                      <span>{isFrench ? "Fenetre active" : "Active window"}</span>
                      <span>•</span>
                      <span>{formatDateOnlyForLocale(selectedDate, activeLocale)}</span>
                    </div>
                    <p className="mt-4 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                      {nextActiveReminder?.title || (isFrench ? "Tout est sous controle" : "Everything is under control")}
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                      {nextActiveReminder
                        ? `${isFrench ? "Prochain point de vigilance" : "Next touchpoint"}: ${formatDateTime(
                            nextActiveReminder.remindAt,
                            activeLocale,
                            activeTimeZone
                          )}`
                        : isFrench
                        ? "Aucun rappel actionnable ne reste ouvert pour cette fenetre."
                        : "No actionable reminders remain open in this window."}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                          {isFrench ? "Actifs" : "Active"}
                        </p>
                        <p className="mt-2 text-xl font-bold">{unresolvedReminders.length}</p>
                      </div>
                      <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                          {isFrench ? "En retard" : "Past due"}
                        </p>
                        <p className="mt-2 text-xl font-bold">{reminderPastDueCount}</p>
                      </div>
                      <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                          {isFrench ? "A venir" : "Upcoming"}
                        </p>
                        <p className="mt-2 text-xl font-bold">{reminderUpcomingCount}</p>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    <article className={`${dashboardMetricCardClass} flex-col items-start`}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {isFrench ? "Cadence" : "Cadence"}
                      </p>
                      <p className="text-2xl font-black tracking-[-0.04em] text-foreground">
                        {reminders.length}
                      </p>
                      <p className="text-sm leading-6 text-muted">
                        {isFrench
                          ? "Rappels visibles dans la fenetre de travail courante."
                          : "Reminders visible in the current working window."}
                      </p>
                    </article>

                    <article className={`${dashboardMetricCardClass} flex-col items-start`}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {isFrench ? "Statut critique" : "Critical state"}
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        {reminderPastDueCount > 0
                          ? isFrench
                            ? `${reminderPastDueCount} a traiter`
                            : `${reminderPastDueCount} need action`
                          : isFrench
                          ? "Aucun retard"
                          : "No overdue items"}
                      </p>
                      <p className="text-sm leading-6 text-muted">
                        {reminderPastDueCount > 0
                          ? isFrench
                            ? "Traitez les rappels dépassés pour dégager la file."
                            : "Clear overdue reminders first to unblock the queue."
                          : isFrench
                          ? "La file reste propre sur la période sélectionnée."
                          : "The queue stays clean for the selected period."}
                      </p>
                    </article>

                    <article className={`${dashboardMetricCardClass} flex-col items-start`}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {isFrench ? "Personnes suivies" : "People in loop"}
                      </p>
                      {reminderPeoplePreview.length > 0 ? (
                        <>
                          <div className="flex -space-x-2">
                            {reminderPeoplePreview.map((name) => (
                              <span
                                key={name}
                                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-accent-soft text-xs font-black text-accent shadow-[0_10px_20px_rgba(53,37,205,0.12)]"
                              >
                                {getMonogram(name)}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm leading-6 text-muted">{reminderPeoplePreview.join(", ")}</p>
                        </>
                      ) : (
                        <p className="text-sm leading-6 text-muted">
                          {isFrench
                            ? "Aucun participant saisi sur les rappels visibles."
                            : "No assignee has been set on the visible reminders."}
                        </p>
                      )}
                    </article>
                  </div>
                </div>

                <ul className="mt-5 space-y-3">
                  {reminders.map((reminder) => {
                    const remindAtDate = new Date(reminder.remindAt);
                    const isReminderPastDue =
                      !isReminderResolvedStatus(reminder.status) && remindAtDate.getTime() < Date.now();
                    const reminderPreview = getRichTextPreviewText(reminder.description ?? "");
                    const reminderAssigneeNames = parseAssigneeNames(reminder.assignees);
                    const reminderAccentClass =
                      reminder.status === "completed"
                        ? "from-[#91db2a] via-[#b8ea76] to-[#e8f7cd]"
                        : reminder.status === "cancelled"
                        ? "from-[#c7c4d8] via-[#ddd8ee] to-[#f6f3ff]"
                        : reminder.status === "fired"
                        ? "from-[#6e3aca] via-[#8856e5] to-[#ddd3ff]"
                        : "from-[#4f46e5] via-[#8856e5] to-[#dff5b1]";

                    return (
                      <li key={reminder.id} className="metric-card relative overflow-hidden rounded-[28px] p-0">
                        <div className={`h-1.5 w-full bg-gradient-to-r ${reminderAccentClass}`} />
                        <div className="px-4 py-4 sm:px-5 sm:py-5">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${reminderStatusChipClassByStatus[reminder.status]}`}
                                >
                                  {formatReminderStatus(reminder.status, activeLocale)}
                                </span>
                                {reminder.project ? (
                                  <span className="rounded-full border border-accent/12 bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent">
                                    {reminder.project}
                                  </span>
                                ) : null}
                                {isReminderPastDue ? (
                                  <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700">
                                    {isFrench ? "En retard" : "Past due"}
                                  </span>
                                ) : null}
                              </div>

                              <p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-foreground">
                                {reminder.title}
                              </p>

                              {reminderPreview ? (
                                <div className={`mt-3 ${dashboardInsetPanelClass}`}>
                                  <p className="text-sm leading-6 text-foreground/82 line-clamp-3">{reminderPreview}</p>
                                </div>
                              ) : null}

                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                                <span className="rounded-full border border-line bg-surface-elevated px-3 py-1.5 font-semibold text-foreground/80">
                                  {formatDateTime(reminder.remindAt, activeLocale, activeTimeZone)}
                                </span>
                                {reminderAssigneeNames.length > 0 ? (
                                <span className="rounded-full border border-line bg-surface-elevated px-3 py-1.5">
                                    {isFrench ? "Participants" : "Assignees"}: {reminderAssigneeNames.join(", ")}
                                  </span>
                                ) : null}
                              </div>

                              {reminderAssigneeNames.length > 0 ? (
                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                  <div className="flex -space-x-2">
                                    {reminderAssigneeNames.slice(0, 4).map((name) => (
                                      <span
                                        key={`${reminder.id}-${name}`}
                                        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-white/90 text-[11px] font-black text-accent shadow-[0_10px_18px_rgba(16,0,105,0.1)]"
                                      >
                                        {getMonogram(name)}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-xs text-muted">
                                    {isFrench ? "Coordination" : "Coordination"} · {reminderAssigneeNames.length}
                                  </p>
                                </div>
                              ) : null}
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center gap-2 xl:max-w-[240px] xl:justify-end">
                              {!isReminderResolvedStatus(reminder.status) ? (
                                <button
                                  type="button"
                                  className={`${primaryButtonClass} px-3 py-2 text-xs`}
                                  onClick={() => {
                                    void handleCompleteReminder(reminder.id);
                                  }}
                                >
                                  <LightningIcon />
                                  {isFrench ? "Traiter" : "Complete"}
                                </button>
                              ) : null}
                              {!isReminderResolvedStatus(reminder.status) ? (
                                <button
                                  type="button"
                                  className={`${controlButtonClass} px-3 py-2 text-xs`}
                                  onClick={() => {
                                    void handleCancelReminder(reminder.id);
                                  }}
                                >
                                  {isFrench ? "Annuler" : "Cancel"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className={`${controlButtonClass} px-3 py-2 text-xs`}
                                onClick={() => openEditReminderDialog(reminder)}
                              >
                                <PencilIcon />
                                {isFrench ? "Modifier" : "Edit"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
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
        className={dashboardSectionClass}
        style={{ animationDelay: "0.25s" }}
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
        const monthNames = isFrench
          ? ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]
          : ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const monthLabel = monthNames[selectedDateObj.getMonth()];

        return (
          <>
            {showMonthlyObjectiveSurface ? (
              <section id="monthlyObjective" className={dashboardSectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className={sectionHeaderClass}>
                      {isFrench ? `Objectif de ${monthLabel}` : `${monthLabel} Objective`}
                    </h2>
                    <p className="text-sm text-muted">
                      {isFrench
                        ? `Definissez l'objectif principal pour le mois de ${monthLabel}.`
                        : `Set the main goal for ${monthLabel}.`}
                    </p>
                  </div>
                  <span className={reflectionBadgeClass}>
                    {isFrench ? "Cap mensuel" : "Monthly focus"}
                  </span>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                  <div className={reflectionPanelClass}>
                    <RichTextEditor
                      locale={activeLocale}
                      value={monthlyObjective}
                      onChange={(nextValue) => {
                        setMonthlyObjective(nextValue);
                        setMonthlyEntryErrorMessage(null);
                        setMonthlyEntrySuccessMessage(null);
                      }}
                      disabled={false}
                      contentClassName="max-h-[220px] overflow-y-auto"
                    />
                  </div>
                  <aside className={`${reflectionMetaCardClass} space-y-3`}>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {isFrench ? "Usage" : "Use"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground/85">
                        {isFrench
                          ? "Définissez la trajectoire dominante du mois et gardez-la visible sur le dashboard."
                          : "Set the month’s dominant trajectory and keep it visible from the dashboard."}
                      </p>
                    </div>
                    <div className="rounded-[20px] bg-surface-elevated px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        {isFrench ? "Statut" : "Status"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {monthlyEntry?.updatedAt
                          ? isFrench ? "Enregistré" : "Saved"
                          : isFrench ? "Brouillon" : "Draft"}
                      </p>
                      {monthlyEntry?.updatedAt ? (
                        <p className="mt-1 text-xs text-muted">
                          {formatDateTime(monthlyEntry.updatedAt, activeLocale, activeTimeZone)}
                        </p>
                      ) : null}
                    </div>
                  </aside>
                </div>
                {monthlyEntryErrorMessage ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {monthlyEntryErrorMessage}
                  </p>
                ) : null}
                {monthlyEntrySuccessMessage ? (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    {monthlyEntrySuccessMessage}
                  </p>
                ) : null}
                <div className="mt-4 flex justify-end">
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

            {showMonthlyReviewSurface ? (
              <section id="monthlyReview" className={dashboardSectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className={sectionHeaderClass}>
                      {isFrench ? `Bilan de ${monthLabel}` : `${monthLabel} Review`}
                    </h2>
                    <p className="text-sm text-muted">
                      {isFrench
                        ? "Dernier jour du mois — faites le bilan avant de passer a la suite."
                        : "Last day of the month — complete your review before moving on."}
                    </p>
                  </div>
                  <span className={reflectionBadgeClass}>
                    {isFrench ? "Requis" : "Required"}
                  </span>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                  <div className={reflectionPanelClass}>
                    <RichTextEditor
                      locale={activeLocale}
                      value={monthlyReview}
                      onChange={(nextValue) => {
                        setMonthlyReview(nextValue);
                        setMonthlyEntryErrorMessage(null);
                        setMonthlyEntrySuccessMessage(null);
                      }}
                      disabled={false}
                      contentClassName="max-h-[220px] overflow-y-auto"
                    />
                  </div>
                  <aside className={`${reflectionMetaCardClass} space-y-3`}>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {isFrench ? "Checkpoint" : "Checkpoint"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground/85">
                        {isFrench
                          ? "Clôturez le mois avec les gains, frictions et décisions pour le suivant."
                          : "Close the month with wins, friction points, and decisions for the next one."}
                      </p>
                    </div>
                    <div className="rounded-[20px] bg-surface-elevated px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        {isFrench ? "Fenêtre" : "Window"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {isFrench ? "Fin de mois" : "Month end"}
                      </p>
                    </div>
                  </aside>
                </div>
                {monthlyEntryErrorMessage ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {monthlyEntryErrorMessage}
                  </p>
                ) : null}
                {monthlyEntrySuccessMessage ? (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    {monthlyEntrySuccessMessage}
                  </p>
                ) : null}
                <div className="mt-4 flex justify-end">
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

            {showWeeklyObjectiveSurface ? (
              <section id="weeklyObjective" className={dashboardSectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className={sectionHeaderClass}>
                      {isFrench ? "Objectif de la semaine" : "Weekly Objective"}
                    </h2>
                    <p className="text-sm text-muted">
                      {isFrench
                        ? "Debut de semaine — definissez votre objectif avant de continuer."
                        : "Start of week — set your objective before continuing."}
                    </p>
                  </div>
                  <span className={reflectionBadgeClass}>
                    {isFrench ? "Requis" : "Required"}
                  </span>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                  <div className={reflectionPanelClass}>
                    <RichTextEditor
                      locale={activeLocale}
                      value={weeklyObjective}
                      onChange={(nextValue) => {
                        setWeeklyObjective(nextValue);
                        setWeeklyEntryErrorMessage(null);
                        setWeeklyEntrySuccessMessage(null);
                      }}
                      disabled={false}
                      contentClassName="max-h-[220px] overflow-y-auto"
                    />
                  </div>
                  <aside className={`${reflectionMetaCardClass} space-y-3`}>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {isFrench ? "Usage" : "Use"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground/85">
                        {isFrench
                          ? "Choisissez une intention simple qui sert de fil rouge à la semaine."
                          : "Choose one simple intention that acts as the week’s throughline."}
                      </p>
                    </div>
                    <div className="rounded-[20px] bg-surface-elevated px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        {isFrench ? "Statut" : "Status"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {weeklyEntry?.updatedAt
                          ? isFrench ? "Enregistré" : "Saved"
                          : isFrench ? "Brouillon" : "Draft"}
                      </p>
                      {weeklyEntry?.updatedAt ? (
                        <p className="mt-1 text-xs text-muted">
                          {formatDateTime(weeklyEntry.updatedAt, activeLocale, activeTimeZone)}
                        </p>
                      ) : null}
                    </div>
                  </aside>
                </div>
                {weeklyEntryErrorMessage ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {weeklyEntryErrorMessage}
                  </p>
                ) : null}
                {weeklyEntrySuccessMessage ? (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    {weeklyEntrySuccessMessage}
                  </p>
                ) : null}
                <div className="mt-4 flex justify-end">
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

            {showWeeklyReviewSurface ? (
              <section id="weeklyReview" className={dashboardSectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className={sectionHeaderClass}>
                      {isFrench ? "Bilan de la semaine" : "Weekly Review"}
                    </h2>
                    <p className="text-sm text-muted">
                      {isFrench
                        ? "Fin de semaine — faites le bilan avant de passer a la semaine suivante."
                        : "End of week — complete your review before moving to next week."}
                    </p>
                  </div>
                  <span className={reflectionBadgeClass}>
                    {isFrench ? "Requis" : "Required"}
                  </span>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                  <div className={reflectionPanelClass}>
                    <RichTextEditor
                      locale={activeLocale}
                      value={weeklyReview}
                      onChange={(nextValue) => {
                        setWeeklyReview(nextValue);
                        setWeeklyEntryErrorMessage(null);
                        setWeeklyEntrySuccessMessage(null);
                      }}
                      disabled={false}
                      contentClassName="max-h-[220px] overflow-y-auto"
                    />
                  </div>
                  <aside className={`${reflectionMetaCardClass} space-y-3`}>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {isFrench ? "Checkpoint" : "Checkpoint"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground/85">
                        {isFrench
                          ? "Clôturez la semaine avec les décisions, apprentissages et ajustements utiles."
                          : "Close the week with decisions, learnings, and useful adjustments."}
                      </p>
                    </div>
                    <div className="rounded-[20px] bg-surface-elevated px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        {isFrench ? "Fenêtre" : "Window"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {isFrench ? "Fin de semaine" : "Week end"}
                      </p>
                    </div>
                  </aside>
                </div>
                {weeklyEntryErrorMessage ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {weeklyEntryErrorMessage}
                  </p>
                ) : null}
                {weeklyEntrySuccessMessage ? (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    {weeklyEntrySuccessMessage}
                  </p>
                ) : null}
                <div className="mt-4 flex justify-end">
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
        className={`${dashboardSectionClass} overflow-hidden`}
        style={{ animationDelay: "0.19s" }}
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
              onClick={() => openCreateNoteDialog({ targetDate: selectedDate })}
              disabled={isLoadingNotes}
            >
              <PlusIcon />
              {isFrench ? "Ajouter une note" : "Add note"}
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
              <p className={`mt-4 ${dashboardEmptyStateClass}`}>
                {isFrench ? "Chargement..." : "Loading..."}
              </p>
            ) : notes.length === 0 && noteDialogMode === null ? (
              <div className={`mt-4 ${dashboardEmptyStateClass} space-y-4`}>
                <p>{isFrench ? "Aucune note. Créez votre première note." : "No notes yet. Create your first note."}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => openCreateNoteDialog({ targetDate: selectedDate })}
                    disabled={isLoadingNotes}
                  >
                    <PlusIcon />
                    {isFrench ? "Creer une note" : "Create note"}
                  </button>
                  <span className="text-xs text-muted">
                    {isFrench
                      ? "Captez vos idees, references et notes reliees au calendrier."
                      : "Capture ideas, references, and notes linked to your calendar."}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)]">
                  <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#100069] via-[#3525cd] to-[#8856e5] px-5 py-5 text-white shadow-[0_28px_56px_rgba(16,0,105,0.24)]">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/72">
                      <span>{isFrench ? "Atelier de notes" : "Notes studio"}</span>
                      <span>•</span>
                      <span>{formatDateOnlyForLocale(selectedDate, activeLocale)}</span>
                    </div>
                    <p className="mt-4 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                      {latestUpdatedNote?.title?.trim() ||
                        (isFrench ? "Gardez vos traces utiles a portee" : "Keep the useful signal close")}
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                      {latestUpdatedNote
                        ? `${isFrench ? "Derniere mise a jour" : "Latest update"}: ${formatDateTime(
                            latestUpdatedNote.updatedAt,
                            activeLocale,
                            activeTimeZone
                          )}`
                        : isFrench
                        ? "Centralisez vos notes libres et reliees aux evenements sans sortir du dashboard."
                        : "Keep standalone notes and event-linked context in one dashboard surface."}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                          {isFrench ? "Total" : "Total"}
                        </p>
                        <p className="mt-2 text-xl font-bold">{notes.length}</p>
                      </div>
                      <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                          {isFrench ? "Liees au calendrier" : "Calendar linked"}
                        </p>
                        <p className="mt-2 text-xl font-bold">{noteLinkedCount}</p>
                      </div>
                      <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                          {isFrench ? "Planifiees" : "Scheduled"}
                        </p>
                        <p className="mt-2 text-xl font-bold">{noteScheduledCount}</p>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    <article className={`${dashboardMetricCardClass} flex-col items-start`}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {isFrench ? "Notes libres" : "Standalone notes"}
                      </p>
                      <p className="text-2xl font-black tracking-[-0.04em] text-foreground">{noteStandaloneCount}</p>
                      <p className="text-sm leading-6 text-muted">
                        {isFrench
                          ? "Captures rapides sans dependance a un evenement."
                          : "Fast captures without depending on an event."}
                      </p>
                    </article>

                    <article className={`${dashboardMetricCardClass} flex-col items-start`}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {isFrench ? "Contextes relies" : "Linked context"}
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        {noteLinkedCount > 0
                          ? isFrench
                            ? `${noteLinkedCount} notes reliees`
                            : `${noteLinkedCount} linked notes`
                          : isFrench
                          ? "Aucune liaison active"
                          : "No active links"}
                      </p>
                      <p className="text-sm leading-6 text-muted">
                        {isFrench
                          ? "Les notes calendrier restent accessibles depuis le meme flux."
                          : "Calendar notes stay reachable from the same working flow."}
                      </p>
                    </article>

                    <article className={`${dashboardMetricCardClass} flex-col items-start`}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {isFrench ? "Rythme" : "Cadence"}
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        {latestUpdatedNote
                          ? formatDateTime(latestUpdatedNote.updatedAt, activeLocale, activeTimeZone)
                          : "—"}
                      </p>
                      <p className="text-sm leading-6 text-muted">
                        {isFrench
                          ? "Repere rapide pour voir si votre base de notes est encore vivante."
                          : "Quick signal to see whether your note base is still active."}
                      </p>
                    </article>
                  </div>
                </div>

                <ul className="mt-5 grid gap-4 md:grid-cols-2">
                  {notes.map((note) => {
                    const isExpanded = expandedNoteId === note.id;
                    const attachmentsForNote = noteAttachments[note.id] ?? [];
                    const hasLoadedAttachments = Object.prototype.hasOwnProperty.call(noteAttachments, note.id);
                    const previewText = getRichTextPreviewText(note.body);
                    const noteTitle = note.title?.trim() || (isFrench ? "Note sans titre" : "Untitled note");
                    const noteAccentClass = note.linkedCalendarEvent
                      ? "from-[#4f46e5] via-[#8856e5] to-[#dbe8ff]"
                      : note.targetDate
                      ? "from-[#91db2a] via-[#c2ee83] to-[#fff1d1]"
                      : "from-[#c7c4d8] via-[#ddd8ee] to-[#f7f4ff]";
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
                        className={`metric-card group relative overflow-hidden rounded-[28px] p-0 transition-all duration-200 hover:-translate-y-0.5 ${
                          isExpanded ? "md:col-span-2" : ""
                        }`}
                      >
                        <div className={`h-1.5 w-full bg-gradient-to-r ${noteAccentClass}`} />

                        <div className="px-4 py-4 sm:px-5 sm:py-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {note.linkedCalendarEvent ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-[#c3c0ff] bg-[#f2efff] px-3 py-1 text-[11px] font-semibold text-[#3323cc]">
                                    <CalendarIcon />
                                    <span className="truncate max-w-[220px]">{note.linkedCalendarEvent.title}</span>
                                  </span>
                                ) : null}
                                {note.targetDate ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-[#cfe8a8] bg-[#edf8d6] px-3 py-1 text-[11px] font-semibold text-[#304f00]">
                                    <CalendarIcon />
                                    {formatDateOnlyForLocale(note.targetDate, activeLocale)}
                                  </span>
                                ) : null}
                                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-elevated px-3 py-1 text-[11px] font-semibold text-muted">
                                  {attachmentLabel}
                                </span>
                              </div>

                              <div className="mt-3">
                                <p className="truncate text-lg font-semibold tracking-[-0.02em] text-foreground transition-colors group-hover:text-accent">
                                  {noteTitle}
                                </p>
                                <p className="mt-1 text-xs text-muted">
                                  {isFrench ? "Mis a jour" : "Updated"} {formatDateTime(note.updatedAt, activeLocale, activeTimeZone)}
                                </p>
                              </div>

                              <div className={`mt-3 ${dashboardInsetPanelClass}`}>
                                <p className="text-sm leading-6 text-foreground/85 line-clamp-4">
                                  {previewText || (isFrench ? "Note vide." : "Empty note.")}
                                </p>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                className={`${iconButtonClass} h-10 w-10 rounded-2xl border border-line/70 bg-surface-elevated px-0`}
                                onClick={() => {
                                  void handleExpandNote(note.id);
                                }}
                                title={
                                  isExpanded
                                    ? isFrench
                                      ? "Replier la note"
                                      : "Collapse note"
                                    : isFrench
                                    ? "Afficher les details"
                                    : "Show details"
                                }
                                aria-label={
                                  isExpanded
                                    ? isFrench
                                      ? "Replier la note"
                                      : "Collapse note"
                                    : isFrench
                                    ? "Afficher les details"
                                    : "Show details"
                                }
                              >
                                <CollapseChevronIcon isCollapsed={!isExpanded} />
                              </button>
                              <button
                                type="button"
                                className={`${iconButtonClass} h-10 w-10 rounded-2xl border border-line/70 bg-surface-elevated px-0`}
                                onClick={() => openEditNoteDialog(note)}
                                title={isFrench ? "Modifier la note" : "Edit note"}
                                aria-label={isFrench ? "Modifier la note" : "Edit note"}
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                className={`${iconButtonClass} h-10 w-10 rounded-2xl border border-red-100 bg-red-50/80 px-0 text-rose-500 hover:border-red-200 hover:bg-rose-50 hover:text-rose-600`}
                                onClick={() => {
                                  void handleDeleteNote(note.id);
                                }}
                                title={isFrench ? "Supprimer la note" : "Delete note"}
                                aria-label={isFrench ? "Supprimer la note" : "Delete note"}
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-4">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                              <span className="rounded-full border border-line bg-surface-elevated px-3 py-1.5">
                                {note.linkedCalendarEvent
                                  ? isFrench
                                    ? "Lie a un evenement"
                                    : "Linked to an event"
                                  : isFrench
                                  ? "Note libre"
                                  : "Standalone note"}
                              </span>
                            </div>
                            <button
                              type="button"
                              className={`${controlButtonClass} px-3 py-2 text-xs`}
                              onClick={() => {
                                void handleExpandNote(note.id);
                              }}
                            >
                              {isExpanded
                                ? isFrench
                                  ? "Masquer les details"
                                  : "Hide details"
                                : isFrench
                                ? "Voir les details"
                                : "View details"}
                            </button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="border-t border-line/70 bg-surface-soft/55 px-4 py-4 sm:px-5">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.9fr)]">
                              <section className={dialogSectionClass}>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                  {isFrench ? "Contenu complet" : "Full content"}
                                </p>
                                <div className="mt-3 rounded-[22px] bg-surface-elevated px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
                                  <RichTextContent
                                    value={note.body}
                                    className="rich-text-render text-sm leading-6 text-foreground"
                                  />
                                </div>
                              </section>

                              <section className={`${dialogSectionClass} space-y-3`}>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                    {isFrench ? "Documents" : "Documents"}
                                  </p>
                                  <span className="rounded-full border border-line bg-surface-elevated px-2.5 py-1 text-[11px] font-semibold text-muted">
                                    {attachmentsForNote.length}
                                  </span>
                                </div>

                                {attachmentsForNote.length > 0 ? (
                                  <ul className="flex flex-col gap-2">
                                    {attachmentsForNote.map((attachment) => (
                                      <li
                                        key={attachment.id}
                                        className="dialog-section-shell flex items-center justify-between gap-2 rounded-[20px] px-3 py-3"
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
                                              ? isFrench
                                                ? "Ouvrir le fichier"
                                                : "Open file"
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
                                          className={`${iconButtonClass} h-9 w-9 rounded-2xl px-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50`}
                                          disabled={pendingNoteAttachmentIds.includes(attachment.id)}
                                          onClick={() => {
                                            void handleDeleteNoteAttachment(note.id, attachment.id);
                                          }}
                                          aria-label={isFrench ? "Supprimer" : "Delete"}
                                        >
                                          {pendingNoteAttachmentIds.includes(attachment.id) ? "…" : <TrashIcon />}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="rounded-[22px] border border-dashed border-line bg-surface-elevated px-3 py-3 text-sm text-muted">
                                    {isFrench ? "Aucun document pour le moment." : "No documents yet."}
                                  </p>
                                )}

                                <div className="grid gap-2">
                                  <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                                    {isFrench ? "Nom du fichier" : "File name"}
                                    <input
                                      type="text"
                                      value={noteAttachmentNameDraft}
                                      onChange={(event) => setNoteAttachmentNameDraft(event.target.value)}
                                      className={textFieldClass}
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
                                      className={textFieldClass}
                                      disabled={isCreatingNoteAttachment}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className={`${controlButtonClass} justify-center`}
                                    disabled={isCreatingNoteAttachment}
                                    onClick={() => {
                                      void handleCreateNoteAttachment(note.id);
                                    }}
                                  >
                                    <PlusIcon />
                                    {isCreatingNoteAttachment
                                      ? isFrench
                                        ? "Envoi..."
                                        : "Uploading..."
                                      : isFrench
                                      ? "Ajouter un document"
                                      : "Add document"}
                                  </button>
                                </div>

                                {noteAttachmentErrorMessage ? (
                                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
              </>
            )}
          </>
        )}
      </section>

      <section
        id="gaming"
        className={dashboardSectionClass}
        style={{ animationDelay: "0.05s" }}
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
              <div className={segmentedControlClass}>
                {gamingTrackPeriodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      gamingTrackPeriod === option.value ? "bg-surface-elevated text-foreground shadow-sm" : "text-muted hover:text-foreground"
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
          className={`${dialogOverlayClass} max-sm:p-0`}
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
            className={`${dialogShellClass} flex w-full max-w-3xl flex-col overflow-hidden ${noteDialogHeightClass} max-sm:h-full max-sm:max-h-none max-sm:rounded-none`}
          >
            <header className="mb-4 flex shrink-0 items-start justify-between gap-3">
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
              <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#100069] via-[#3525cd] to-[#8856e5] px-5 py-5 text-white shadow-[0_28px_56px_rgba(16,0,105,0.22)]">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/72">
                  <span>{noteDialogMode === "edit" ? (isFrench ? "Note active" : "Active note") : isFrench ? "Nouvelle capture" : "New capture"}</span>
                  {selectedNoteCalendarEventTitle ? (
                    <>
                      <span>•</span>
                      <span>{isFrench ? "Calendrier relie" : "Calendar linked"}</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-4 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                  {noteFormValues.title.trim() || (isFrench ? "Structurer une note utile" : "Shape a useful note")}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                  {noteDialogPreview ||
                    (isFrench
                      ? "Ajoutez une trace claire, puis reliez-la si besoin a une date ou un evenement calendrier."
                      : "Capture clear context, then optionally connect it to a date or calendar event.")}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                      {isFrench ? "Date cible" : "Target date"}
                    </p>
                    <p className="mt-2 text-base font-bold">
                      {noteFormValues.targetDate ? formatDateOnlyForLocale(noteFormValues.targetDate, activeLocale) : "—"}
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                      {isFrench ? "Evenement" : "Event"}
                    </p>
                    <p className="mt-2 text-base font-bold">{selectedNoteCalendarEventTitle || "—"}</p>
                  </div>
                  <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                      {isFrench ? "Documents" : "Documents"}
                    </p>
                    <p className="mt-2 text-base font-bold">{noteDialogAttachmentCount}</p>
                  </div>
                </div>
              </section>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                <div className="space-y-4">
                  <section className={`${dialogSectionClass} space-y-4`}>
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
                  </section>

                  {noteDialogMode === "edit" && editingNoteId ? (
                    <section className={`${dialogSectionClass} space-y-3`}>
                      <header>
                        <h3 className="text-sm font-semibold text-foreground">
                          {isFrench ? "Documents" : "Documents"} ({(noteAttachments[editingNoteId] ?? []).length})
                        </h3>
                        <p className="text-xs text-muted">
                          {isFrench
                            ? "Ajoutez ou retirez des fichiers lies a cette note."
                            : "Add or remove files linked to this note."}
                        </p>
                      </header>

                      {(noteAttachments[editingNoteId] ?? []).length > 0 ? (
                        <ul className="flex flex-col gap-2">
                          {(noteAttachments[editingNoteId] ?? []).map((attachment) => (
                            <li key={attachment.id} className="dialog-section-shell flex items-center justify-between gap-2 rounded-[20px] px-3 py-3">
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
                                    {[attachment.contentType ?? null, typeof attachment.sizeBytes === "number" ? formatFileSize(attachment.sizeBytes) : null]
                                      .filter((value): value is string => Boolean(value))
                                      .join(" · ")}
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className={`${iconButtonClass} h-9 w-9 rounded-2xl px-0 text-rose-500 hover:bg-rose-50 disabled:opacity-50`}
                                disabled={pendingNoteAttachmentIds.includes(attachment.id)}
                                onClick={() => {
                                  void handleDeleteNoteAttachment(editingNoteId, attachment.id);
                                }}
                              >
                                {pendingNoteAttachmentIds.includes(attachment.id) ? "…" : <TrashIcon />}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="rounded-[22px] border border-dashed border-line bg-surface-elevated px-3 py-3 text-sm text-muted">
                          {isFrench ? "Aucun document pour le moment." : "No documents yet."}
                        </p>
                      )}

                      {noteAttachmentErrorMessage ? (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          {noteAttachmentErrorMessage}
                        </p>
                      ) : null}

                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
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
                          onClick={() => {
                            void handleCreateNoteAttachment(editingNoteId);
                          }}
                        >
                          <PlusIcon />
                          {isCreatingNoteAttachment ? "…" : isFrench ? "Ajouter" : "Add"}
                        </button>
                      </div>
                    </section>
                  ) : null}
                </div>

                <aside className="space-y-4">
                  <section className={`${dialogSectionClass} space-y-4`}>
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
                        <option value="">{isFrench ? "Aucun evenement" : "No event"}</option>
                        {noteCalendarEventOptions.map((eventOption) => {
                          const isDisabled =
                            linkedCalendarEventIdsInUse.has(eventOption.id) &&
                            eventOption.id !== editingNote?.calendarEventId;

                          return (
                            <option key={eventOption.id} value={eventOption.id} disabled={isDisabled}>
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
                  </section>

                  <section className={`${dialogSectionClass} space-y-3`}>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {isFrench ? "Usage" : "Usage"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground/82">
                        {isFrench
                          ? "Utilisez une date pour faire remonter la note au bon jour, ou reliez-la a un evenement pour garder le contexte vivant."
                          : "Use a date to resurface the note on the right day, or link it to an event to keep the context alive."}
                      </p>
                    </div>
                    <div className="rounded-[20px] bg-surface-elevated px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        {isFrench ? "Etat de la note" : "Note state"}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {selectedNoteCalendarEventTitle
                          ? isFrench
                            ? "Contexte calendrier attache"
                            : "Calendar context attached"
                          : noteFormValues.targetDate
                          ? isFrench
                            ? "Repere journalier actif"
                            : "Daily anchor active"
                          : isFrench
                          ? "Capture libre"
                          : "Free capture"}
                      </p>
                    </div>
                  </section>
                </aside>
              </div>

              {noteErrorMessage ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {noteErrorMessage}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  className={controlButtonClass}
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
          className={`${dialogOverlayClass} max-sm:p-0 lg:items-stretch lg:justify-end lg:p-0`}
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
            className={`${dialogShellClass} flex w-full max-w-2xl flex-col overflow-hidden ${taskDialogHeightClass} max-sm:h-full max-sm:max-h-none max-sm:rounded-none lg:h-full lg:max-h-none lg:max-w-[42rem] lg:rounded-none lg:border-l lg:border-line/20 lg:p-8 lg:shadow-[-40px_0_80px_-20px_rgba(16,0,105,0.15)]`}
          >
            <header className="mb-4 flex shrink-0 items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${priorityChipClassByPriority[taskFormValues.priority]}`}>
                    {formatPriority(taskFormValues.priority, activeLocale)}
                  </span>
                  {taskFormValues.project ? (
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                      {taskFormValues.project}
                    </span>
                  ) : null}
                  {taskFormValues.calendarEventId ? (
                    <span className="rounded-full bg-reward-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-success">
                      {isFrench ? "Calendrier lie" : "Calendar linked"}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-foreground sm:text-3xl">{taskDialogTitle}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
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
              <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-accent via-accent-strong to-[#6e3aca] px-5 py-5 text-white shadow-[0_28px_56px_rgba(53,37,205,0.2)]">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
                  <span>{taskDialogMode === "edit" ? (isFrench ? "Tache active" : "Active Task") : (isFrench ? "Nouvelle entree" : "New Entry")}</span>
                  {taskFormValues.project ? <span>• {taskFormValues.project}</span> : null}
                </div>
                <p className="mt-4 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                  {taskFormValues.title || (isFrench ? "Definir l'action prioritaire" : "Define the next high-leverage action")}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/58">{isFrench ? "Statut" : "Status"}</p>
                    <p className="mt-2 text-base font-bold">{formatTaskStatus(taskFormValues.status, activeLocale)}</p>
                  </div>
                  <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/58">{isFrench ? "Echeance" : "Due Date"}</p>
                    <p className="mt-2 text-base font-bold">
                      {taskFormValues.dueDate ? formatDateOnlyForLocale(taskFormValues.dueDate, activeLocale) : "—"}
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/58">{isFrench ? "Temps planifie" : "Planned Time"}</p>
                    <p className="mt-2 text-base font-bold">
                      {taskFormValues.plannedTime ? formatPlannedTime(Number(taskFormValues.plannedTime) || 0) : "—"}
                    </p>
                  </div>
                </div>
              </section>

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

              <label className="block text-sm font-semibold text-foreground">
                {isFrench ? "Assignes (optionnel)" : "Assignees (optional)"}
                <input
                  type="text"
                  placeholder={isFrench ? "ex : Alice, Bob" : "e.g. Alice, Bob"}
                  value={taskFormValues.assignees}
                  onChange={(event) => updateTaskFormField("assignees", event.target.value)}
                  className={textFieldClass}
                  disabled={isSubmittingTask}
                />
              </label>

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

              <section className={dialogSectionClass}>
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
          className={`${dialogOverlayClass} max-sm:p-0`}
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
            className={`${dialogShellClass} flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden max-sm:h-full max-sm:max-h-none max-sm:rounded-none`}
          >
            <header className="mb-4 flex shrink-0 items-start justify-between gap-3">
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
                <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#3525cd] via-[#6e3aca] to-[#91db2a] px-5 py-5 text-white shadow-[0_28px_56px_rgba(53,37,205,0.22)]">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/72">
                    <span>{reminderDialogMode === "edit" ? (isFrench ? "Rappel actif" : "Active reminder") : isFrench ? "Nouvelle alerte" : "New alert"}</span>
                    {reminderFormValues.project ? (
                      <>
                        <span>•</span>
                        <span>{reminderFormValues.project}</span>
                      </>
                    ) : null}
                  </div>
                  <p className="mt-4 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                    {reminderFormValues.title.trim() || (isFrench ? "Definir le prochain signal utile" : "Define the next useful signal")}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                    {reminderDialogScheduleLabel
                      ? `${isFrench ? "Programmé pour" : "Scheduled for"} ${reminderDialogScheduleLabel}`
                      : isFrench
                      ? "Placez une heure claire pour faire remonter la bonne action au bon moment."
                      : "Set a clear time so the right action resurfaces at the right moment."}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                        {isFrench ? "Echeance" : "Schedule"}
                      </p>
                      <p className="mt-2 text-base font-bold">{reminderDialogScheduleLabel || "—"}</p>
                    </div>
                    <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                        {isFrench ? "Participants" : "Assignees"}
                      </p>
                      <p className="mt-2 text-base font-bold">
                        {reminderDialogAssigneePreview.length > 0 ? reminderDialogAssigneePreview.join(", ") : "—"}
                      </p>
                    </div>
                    <div className="rounded-[22px] bg-white/12 px-4 py-3 backdrop-blur-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                        {isFrench ? "Documents" : "Documents"}
                      </p>
                      <p className="mt-2 text-base font-bold">{reminderDialogAttachmentCount}</p>
                    </div>
                  </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                  <div className="space-y-4">
                    <section className={`${dialogSectionClass} space-y-4`}>
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
                    </section>

                    {reminderDialogMode === "edit" && editingReminderId ? (
                      <section className={`${dialogSectionClass} space-y-3`}>
                        <header>
                          <h3 className="text-sm font-semibold text-foreground">
                            {isFrench ? "Documents" : "Documents"} ({(reminderAttachments[editingReminderId] ?? []).length})
                          </h3>
                          <p className="text-xs text-muted">
                            {isFrench
                              ? "Ajoutez ou retirez des fichiers lies a ce rappel."
                              : "Add or remove files linked to this reminder."}
                          </p>
                        </header>

                        {(reminderAttachments[editingReminderId] ?? []).length > 0 ? (
                          <ul className="flex flex-col gap-2">
                            {(reminderAttachments[editingReminderId] ?? []).map((attachment) => (
                              <li key={attachment.id} className="dialog-section-shell flex items-center justify-between gap-2 rounded-[20px] px-3 py-3">
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
                                      {[attachment.contentType ?? null, typeof attachment.sizeBytes === "number" ? formatFileSize(attachment.sizeBytes) : null]
                                        .filter((v): v is string => Boolean(v))
                                        .join(" · ")}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  className={`${iconButtonClass} h-9 w-9 rounded-2xl px-0 text-rose-500 hover:bg-rose-50 disabled:opacity-50`}
                                  disabled={pendingReminderAttachmentIds.includes(attachment.id)}
                                  onClick={() => {
                                    void handleDeleteReminderAttachment(editingReminderId, attachment.id);
                                  }}
                                >
                                  {pendingReminderAttachmentIds.includes(attachment.id) ? "…" : <TrashIcon />}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="rounded-[22px] border border-dashed border-line bg-surface-elevated px-3 py-3 text-sm text-muted">
                            {isFrench ? "Aucun document pour le moment." : "No documents yet."}
                          </p>
                        )}
                        {reminderAttachmentErrorMessage ? (
                          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {reminderAttachmentErrorMessage}
                          </p>
                        ) : null}
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
                          <label className="block text-sm font-semibold text-foreground">
                            {isFrench ? "Nom" : "Name"}
                            <input
                              type="text"
                              value={reminderAttachmentNameDraft}
                              onChange={(e) => setReminderAttachmentNameDraft(e.target.value)}
                              className={textFieldClass}
                              placeholder={isFrench ? "Nom du fichier" : "File name"}
                              disabled={isCreatingReminderAttachment}
                            />
                          </label>
                          <label className="block text-sm font-semibold text-foreground">
                            {isFrench ? "Fichier" : "File"}
                            <input
                              ref={reminderAttachmentFileInputRef}
                              type="file"
                              onChange={(e) => setReminderAttachmentFileDraft(e.target.files?.[0] ?? null)}
                              className={textFieldClass}
                              disabled={isCreatingReminderAttachment}
                            />
                          </label>
                          <button
                            type="button"
                            className={controlButtonClass}
                            disabled={isCreatingReminderAttachment}
                            onClick={() => {
                              void handleCreateReminderAttachment(editingReminderId);
                            }}
                          >
                            <PlusIcon />
                            {isCreatingReminderAttachment ? "…" : isFrench ? "Ajouter" : "Add"}
                          </button>
                        </div>
                      </section>
                    ) : null}
                  </div>

                  <aside className="space-y-4">
                    <section className={`${dialogSectionClass} space-y-4`}>
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
                    </section>

                    <section className={`${dialogSectionClass} space-y-3`}>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                          {isFrench ? "Usage" : "Usage"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground/82">
                          {isFrench
                            ? "Programmez un point d'action concret: projet, personnes concernees et heure de declenchement."
                            : "Schedule a concrete action point: project, people involved, and trigger time."}
                        </p>
                      </div>
                      <div className="rounded-[20px] bg-surface-elevated px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                          {isFrench ? "Etat du rappel" : "Reminder state"}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {reminderDialogScheduleLabel
                            ? isFrench
                              ? "Pret a declencher"
                              : "Ready to trigger"
                            : isFrench
                            ? "Brouillon de rappel"
                            : "Reminder draft"}
                        </p>
                      </div>
                    </section>
                  </aside>
                </div>

                {reminderErrorMessage ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {reminderErrorMessage}
                  </p>
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
          className={`${dialogOverlayClass} max-sm:p-0`}
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
            className={`${dialogShellClass} flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col overflow-hidden p-0 max-sm:h-full max-sm:max-h-none max-sm:rounded-none sm:p-0`}
          >
            <header className="workspace-header-shell px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[20px] bg-gradient-to-br from-accent to-secondary text-white shadow-[0_20px_36px_rgba(53,37,205,0.24)]">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <circle cx="12" cy="8" r="3.2" />
                      <path d="M5 19c1.2-3.1 3.8-4.7 7-4.7s5.8 1.6 7 4.7" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-foreground">
                      {isFrench ? "Parametres du profil" : "Profile Settings"}
                    </h3>
                    <p className="mt-1 max-w-xl text-sm text-muted">
                      {isFrench
                        ? "Ajustez votre identite, vos integrations et les sections requises avec la meme surface glass que le reste du workspace."
                        : "Tune your identity, integrations, and required sections with the same glass workspace treatment as the rest of the product."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end">
                  <span className="rounded-full border border-line/70 bg-white/65 px-3 py-1 text-[11px] font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                    {profileFormValues.displayName.trim() ||
                      authUser?.displayName ||
                      authUser?.email ||
                      (isFrench ? "Profil Jotly" : "Jotly Profile")}
                  </span>
                  <span className="rounded-full border border-line/70 bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent">
                    {profileFormValues.preferredLocale === "fr"
                      ? isFrench ? "Francais" : "French"
                      : isFrench ? "Anglais" : "English"}
                  </span>
                  <span className="rounded-full border border-[#cfe8a8] bg-[#edf8d6] px-3 py-1 text-[11px] font-semibold text-[#304f00]">
                    {profileFormValues.preferredTimeZone || "UTC"}
                  </span>
                </div>
              </div>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleProfileSubmit}>
              <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                <section className="dialog-section-shell rounded-[28px] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                        {isFrench ? "Identite" : "Identity"}
                      </p>
                      <h4 className="mt-2 text-base font-semibold text-foreground">
                        {isFrench ? "Preferences personnelles" : "Personal Preferences"}
                      </h4>
                      <p className="mt-1 text-sm text-muted">
                        {isFrench
                          ? "Ces valeurs pilotent la langue de l'assistant, le rendu des dates et votre etiquette de profil."
                          : "These values drive assistant language, date rendering, and your profile label."}
                      </p>
                    </div>

                    <div className="toolbar-surface inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold text-muted">
                      <LightningIcon />
                      {isFrench ? "Applique partout dans Jotly" : "Applies across Jotly"}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

                    <label className="block text-sm font-semibold text-foreground sm:col-span-2">
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
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={controlButtonClass}
                      onClick={() => handleProfileFieldChange("preferredTimeZone", getBrowserTimeZone())}
                      disabled={isProfileSaving}
                    >
                      <TimeZoneIcon />
                      {isFrench ? "Utiliser le fuseau du navigateur" : "Use Browser Time Zone"}
                    </button>
                  </div>
                </section>

                <section className="dialog-section-shell rounded-[28px] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                        Google Calendar
                      </p>
                      <h4 className="mt-2 text-base font-semibold text-foreground">
                        {isFrench ? "Comptes relies" : "Connected Accounts"}
                      </h4>
                      <p className="mt-1 text-sm text-muted">
                        {isFrench
                          ? "Conservez une vue dense de vos comptes, couleurs et calendriers actifs sans quitter le panneau."
                          : "Keep a dense view of connected accounts, colors, and active calendars without leaving the panel."}
                      </p>
                    </div>

                    <div className="rounded-full border border-[#cfe8a8] bg-[#edf8d6] px-3 py-1.5 text-[11px] font-semibold text-[#304f00]">
                      {googleCalendarConnections.length > 0
                        ? isFrench
                          ? `${googleCalendarConnections.length} compte(s) actif(s)`
                          : `${googleCalendarConnections.length} active account(s)`
                        : isFrench
                        ? "Aucun compte connecte"
                        : "No account connected"}
                    </div>
                  </div>

                  {!isGoogleCalendarAvailable ? (
                    <div className="mt-4 rounded-[24px] border border-dashed border-line bg-white/50 px-4 py-4 text-sm text-muted">
                      {getGoogleCalendarUnavailableMessage(isFrench)}
                    </div>
                  ) : isGoogleCalendarLoading ? (
                    <div className="mt-4 flex items-center gap-3 rounded-[24px] border border-line/60 bg-white/55 px-4 py-4 text-sm text-muted">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                      {isFrench ? "Chargement des connexions..." : "Loading connections..."}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {googleCalendarConnections.length > 0 ? (
                        <div className="grid gap-3 lg:grid-cols-2">
                          {googleCalendarConnections.map((conn) => (
                            <div
                              key={conn.id}
                              className="dialog-section-shell relative overflow-hidden rounded-[24px] px-4 py-4"
                            >
                              <div className="pointer-events-none absolute -right-6 top-0 h-16 w-16 rounded-full bg-accent-soft/80 blur-2xl" />
                              <div className="relative">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex min-w-0 items-start gap-3">
                                    <input
                                      type="color"
                                      value={conn.color}
                                      onChange={(e) => handleUpdateConnectionColor(conn.id, e.target.value)}
                                      className="mt-0.5 h-8 w-8 cursor-pointer rounded-full border border-white/70 bg-transparent p-0 shadow-[0_8px_18px_rgba(16,0,105,0.08)]"
                                      title={isFrench ? "Couleur du calendrier" : "Calendar color"}
                                    />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-foreground">{conn.email}</p>
                                      <p className="mt-1 text-[11px] text-muted">
                                        {conn.lastSyncedAt
                                          ? `${isFrench ? "Derniere synchro" : "Last sync"} · ${new Date(conn.lastSyncedAt).toLocaleString()}`
                                          : isFrench
                                          ? "Jamais synchronise"
                                          : "Never synced"}
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className="rounded-full border border-line bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-foreground"
                                    onClick={() => handleDisconnectGoogleCalendar(conn.id)}
                                  >
                                    {isFrench ? "Deconnecter" : "Disconnect"}
                                  </button>
                                </div>

                                <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                  {isFrench ? "Calendrier principal" : "Primary calendar"}
                                  <select
                                    value={conn.calendarId}
                                    onFocus={() => {
                                      if (!connectionCalendarOptions[conn.id]) {
                                        fetchConnectionCalendars(conn.id);
                                      }
                                    }}
                                    onChange={(e) => handleUpdateCalendarId(conn.id, e.target.value)}
                                    className="mt-2 w-full rounded-2xl border border-line bg-surface-elevated px-3 py-2.5 text-xs text-foreground outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15"
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
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-line bg-white/55 px-4 py-5 text-sm text-muted">
                          {isFrench
                            ? "Ajoutez un compte Google Calendar pour synchroniser vos evenements dans le dashboard Jotly."
                            : "Add a Google Calendar account to sync events into the Jotly dashboard."}
                        </div>
                      )}

                      <div className={`${toolbarSurfaceClass} flex flex-wrap items-center gap-2 rounded-[24px]`}>
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
                            <LightningIcon />
                            {isGoogleCalendarSyncing
                              ? (isFrench ? "Synchronisation..." : "Syncing...")
                              : (isFrench ? "Synchroniser" : "Sync")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {googleCalendarError ? (
                    <p className="mt-3 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      {googleCalendarError}
                    </p>
                  ) : null}
                </section>

                <section className="dialog-section-shell rounded-[28px] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                        {isFrench ? "Validation" : "Validation"}
                      </p>
                      <h4 className="mt-2 text-base font-semibold text-foreground">
                        {isFrench ? "Sections obligatoires" : "Required Sections"}
                      </h4>
                      <p className="mt-1 text-sm text-muted">
                        {isFrench
                          ? "Activez les blocs qui doivent compter dans vos routines quotidiennes et periodiques."
                          : "Enable the blocks that must count toward your daily and periodic routines."}
                      </p>
                    </div>

                    <div className="rounded-full border border-line/70 bg-white/65 px-3 py-1.5 text-[11px] font-semibold text-muted">
                      {isFrench
                        ? `${Object.values({
                            requireDailyAffirmation: profileFormValues.requireDailyAffirmation,
                            requireDailyBilan: profileFormValues.requireDailyBilan,
                            requireWeeklySynthesis: profileFormValues.requireWeeklySynthesis,
                            requireMonthlySynthesis: profileFormValues.requireMonthlySynthesis,
                          }).filter(Boolean).length} actifs`
                        : `${Object.values({
                            requireDailyAffirmation: profileFormValues.requireDailyAffirmation,
                            requireDailyBilan: profileFormValues.requireDailyBilan,
                            requireWeeklySynthesis: profileFormValues.requireWeeklySynthesis,
                            requireMonthlySynthesis: profileFormValues.requireMonthlySynthesis,
                          }).filter(Boolean).length} active`}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        {
                          key: "requireDailyAffirmation" as const,
                          labelFr: "Affirmation du jour",
                          labelEn: "Daily Affirmation",
                        },
                        {
                          key: "requireDailyBilan" as const,
                          labelFr: "Bilan du jour",
                          labelEn: "Daily Review (Bilan)",
                        },
                        {
                          key: "requireWeeklySynthesis" as const,
                          labelFr: "Synthese hebdomadaire (dimanche)",
                          labelEn: "Weekly Synthesis (Sunday)",
                        },
                        {
                          key: "requireMonthlySynthesis" as const,
                          labelFr: "Synthese mensuelle",
                          labelEn: "Monthly Synthesis",
                        },
                      ] as const
                    ).map(({ key, labelFr, labelEn }) => (
                      <label
                        key={key}
                        className={`dialog-section-shell flex cursor-pointer items-center justify-between gap-3 rounded-[22px] px-4 py-3 transition-colors ${
                          isProfileSaving ? "opacity-70" : "hover:border-accent/20 hover:bg-white/60"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {isFrench ? labelFr : labelEn}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {profileFormValues[key]
                              ? isFrench ? "Actif" : "Active"
                              : isFrench ? "Inactif" : "Inactive"}
                          </p>
                        </div>

                        <span
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                            profileFormValues[key]
                              ? "border-accent bg-accent"
                              : "border-line bg-white/80"
                          }`}
                        >
                          <span
                            className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-[0_6px_14px_rgba(16,0,105,0.12)] transition-transform ${
                              profileFormValues[key] ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </span>

                        <input
                          type="checkbox"
                          checked={profileFormValues[key]}
                          onChange={(e) => handleProfileFieldChange(key, e.target.checked)}
                          disabled={isProfileSaving}
                          className="sr-only"
                        />
                      </label>
                    ))}
                  </div>
                </section>

                {profileErrorMessage ? (
                  <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {profileErrorMessage}
                  </p>
                ) : null}

                {profileSuccessMessage ? (
                  <p className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {profileSuccessMessage}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-line/30 bg-white/20 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-end gap-2">
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
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {navigationBlockers.length > 0 ? (
        <div className={dialogOverlayClass}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={isFrench ? "Navigation bloquee" : "Navigation blocked"}
            className={`${dialogShellClass} max-w-md`}
          >
            <h3 className="text-lg font-semibold text-foreground">
              {isFrench ? "Compléter les champs requis" : "Complete required fields"}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {isFrench
                ? "Vous devez remplir les éléments suivants avant de changer de date :"
                : "You must complete the following before navigating to another date:"}
            </p>
            <ul className="mt-3 space-y-1">
              {navigationBlockers.map((blocker) => (
                <li key={blocker} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {blocker}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => setNavigationBlockers([])}
              >
                {isFrench ? "Compris" : "Got it"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {taskToDelete ? (
        <div
          className={dialogOverlayClass}
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
            className={`${dialogShellClass} max-w-md`}
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
        <section className={`${floatingPanelClass} max-h-[76vh] max-sm:h-full max-sm:max-h-none sm:w-[430px]`}>
          <header className="workspace-header-shell px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[20px] bg-gradient-to-br from-[#8856e5] to-[#3525cd] text-white shadow-[0_18px_34px_rgba(53,37,205,0.24)]">
                  <BellIcon />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {isFrench ? "Alertes" : "Alerts"}
                    </p>
                    <span className="rounded-full border border-line/70 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                      {alertsSummary.count > 0
                        ? isFrench ? `${alertsSummary.count} actives` : `${alertsSummary.count} active`
                        : isFrench ? "Inbox propre" : "Clear inbox"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
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
                className={`${iconButtonClass} h-9 w-9 rounded-full px-0`}
                onClick={() => setIsTaskAlertsPanelOpen(false)}
                aria-label={isFrench ? "Fermer les alertes" : "Close alerts"}
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          <div className="grid grid-cols-3 gap-2 px-4 pt-4">
            <div className="workspace-stat-card min-w-0 flex-col items-start gap-1 rounded-[22px] border border-rose-200/70 bg-white/72 px-3 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                {isFrench ? "Retard" : "Overdue"}
              </span>
              <span className="text-lg font-semibold text-foreground">{alertsSummary.overdueCount}</span>
            </div>
            <div className="workspace-stat-card min-w-0 flex-col items-start gap-1 rounded-[22px] border border-[#d3bbff] bg-[#f5edff]/85 px-3 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#581db3]">
                {isFrench ? "Jour" : "Today"}
              </span>
              <span className="text-lg font-semibold text-foreground">{alertsSummary.todayCount}</span>
            </div>
            <div className="workspace-stat-card min-w-0 flex-col items-start gap-1 rounded-[22px] border border-[#cfe8a8] bg-[#edf8d6]/85 px-3 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#304f00]">
                {isFrench ? "Demain" : "Tomorrow"}
              </span>
              <span className="text-lg font-semibold text-foreground">{alertsSummary.tomorrowCount}</span>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {isTaskAlertsLoading ? (
              <div className="dialog-section-shell flex items-center gap-3 rounded-[24px] px-4 py-4 text-sm text-muted">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                {isFrench ? "Chargement des alertes..." : "Loading alerts..."}
              </div>
            ) : null}

            {taskAlertsErrorMessage ? (
              <p className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                {taskAlertsErrorMessage}
              </p>
            ) : null}

            {!isTaskAlertsLoading && !taskAlertsErrorMessage && alertPanelItems.length ? (
              alertPanelItems.map((item) =>
                item.sourceType === "task" ? (
                  <button
                    key={item.task.id}
                    type="button"
                    className="dialog-section-shell group relative w-full overflow-hidden rounded-[24px] px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent/25 hover:bg-white/60 hover:shadow-[0_18px_36px_rgba(16,0,105,0.08)]"
                    onClick={() => {
                      setIsTaskAlertsPanelOpen(false);

                      if (item.task.targetDate === selectedDate) {
                        openEditTaskDialog(item.task);
                        return;
                      }

                      handleDateChange(item.task.targetDate);
                    }}
                  >
                    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${alertSourceChipClassByType.task}`}
                          >
                            {formatAlertSourceLabel("task", activeLocale)}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${alertUrgencyChipClassByUrgency[item.urgency]}`}
                          >
                            {formatAlertUrgencyLabel(item.urgency, activeLocale)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-accent">
                          {item.task.title}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
                          <span className="rounded-full border border-line/60 bg-white/70 px-2.5 py-1">
                            {item.task.dueDate
                              ? `${isFrench ? "Echeance" : "Due"} · ${formatDateOnlyForLocale(item.task.dueDate, activeLocale)}`
                              : isFrench
                              ? "Sans echeance"
                              : "No due date"}
                          </span>
                          <span className="rounded-full border border-line/60 bg-white/70 px-2.5 py-1">
                            {isFrench ? "Planifiee" : "Scheduled"} · {formatDateOnlyForLocale(item.task.targetDate, activeLocale)}
                          </span>
                          {item.task.project ? (
                            <span className="rounded-full border border-line/60 bg-white/70 px-2.5 py-1">
                              {item.task.project}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${priorityChipClassByPriority[item.task.priority]}`}
                        >
                          {formatPriority(item.task.priority, activeLocale)}
                        </span>
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line/70 bg-white/70 text-muted transition-colors group-hover:text-accent">
                          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
                            <path d="M5 3.5 9.5 8 5 12.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </button>
                ) : (
                  <article
                    key={item.reminder.id}
                    className="dialog-section-shell relative overflow-hidden rounded-[24px] px-4 py-4"
                  >
                    <div className="pointer-events-none absolute -right-6 top-0 h-16 w-16 rounded-full bg-accent-soft/75 blur-2xl" />
                    <div className="relative">
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
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${alertSourceChipClassByType.reminder}`}
                            >
                              {formatAlertSourceLabel("reminder", activeLocale)}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${alertUrgencyChipClassByUrgency[item.urgency]}`}
                            >
                              {formatAlertUrgencyLabel(item.urgency, activeLocale)}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-semibold leading-5 text-foreground">{item.reminder.title}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
                            <span className="rounded-full border border-line/60 bg-white/70 px-2.5 py-1">
                              {`${formatTaskAlertDueLabel(
                                formatDateInputForTimeZone(new Date(item.reminder.remindAt), activeTimeZone),
                                taskAlertsAnchorDate,
                                activeLocale
                              )} · ${formatDateTime(item.reminder.remindAt, activeLocale, activeTimeZone)}`}
                            </span>
                            <span className="rounded-full border border-line/60 bg-white/70 px-2.5 py-1">
                              {[item.reminder.project, item.reminder.assignees].filter(Boolean).join(" · ") ||
                                (isFrench ? "Rappel actif" : "Active reminder")}
                            </span>
                          </div>
                        </button>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${reminderStatusChipClassByStatus[item.reminder.status]}`}
                        >
                          {formatReminderStatus(item.reminder.status, activeLocale)}
                        </span>
                      </div>

                      <div className="toolbar-surface mt-4 flex items-center justify-end gap-2 rounded-[20px] px-2.5 py-2">
                        <button
                          type="button"
                          className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
                          onClick={() => { void handleCompleteReminder(item.reminder.id); }}
                        >
                          {isFrench ? "Traiter" : "Complete"}
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-line bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-surface hover:text-foreground"
                          onClick={() => { void handleCancelReminder(item.reminder.id); }}
                        >
                          {isFrench ? "Annuler" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              )
            ) : null}

            {!isTaskAlertsLoading && !taskAlertsErrorMessage && alertPanelItems.length === 0 ? (
              <div className="dialog-section-shell rounded-[24px] border border-[#cfe8a8] bg-[#edf8d6]/85 px-4 py-5 text-sm text-[#304f00]">
                <p className="font-semibold">
                  {isFrench ? "Tout est sous controle." : "Everything is under control."}
                </p>
                <p className="mt-1 text-[13px] text-[#426b00]">
                  {isFrench
                    ? "Aucune alerte active en retard, aujourd'hui ou demain."
                    : "No active alerts overdue, today, or tomorrow."}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {isAssistantPanelOpen ? (
        <section className={`${floatingPanelClass} max-h-[82vh] max-sm:h-full max-sm:max-h-none sm:w-[660px] lg:bottom-auto lg:top-0 lg:h-full lg:max-h-none lg:w-[400px] lg:rounded-none lg:border-l lg:border-line/30 2xl:w-[440px]`}>
          <header className="workspace-header-shell px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[20px] bg-gradient-to-br from-accent to-secondary text-white shadow-[0_18px_36px_rgba(53,37,205,0.24)]">
                  <svg viewBox="0 0 16 16" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M8 2l1.5 3h3l-2.5 2.5.8 3L8 9l-2.8 1.5.8-3L3.5 5h3z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {isFrench ? "Assistant IA" : "AI Assistant"}
                    </p>
                    <span className="rounded-full border border-line/70 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                      {isFrench ? "Workspace Jotly" : "Jotly Workspace"}
                    </span>
                    {assistantMessages.length > 0 ? (
                      <span className="rounded-full border border-[#cfe8a8] bg-[#edf8d6] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#304f00]">
                        {isFrench
                          ? `${assistantMessages.length} messages`
                          : `${assistantMessages.length} messages`}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {isFrench
                      ? "Reponses basees sur vos taches, commentaires, rappels et contenus relies."
                      : "Answers grounded in your tasks, comments, reminders, and connected content."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={`${iconButtonClass} h-9 w-9 rounded-full px-0`}
                onClick={() => setIsAssistantPanelOpen(false)}
                disabled={isAssistantLoading}
                aria-label={isFrench ? "Fermer l'assistant IA" : "Close AI assistant"}
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-hidden">
            <div className="h-full space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(145,219,42,0.12),transparent_28%),radial-gradient(circle_at_top_left,rgba(79,70,229,0.12),transparent_32%)] px-4 py-4">
              <div className="dialog-section-shell flex items-start gap-3 rounded-[24px] px-4 py-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[18px] bg-accent-soft text-accent">
                  <LightningIcon />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {isFrench ? "Contexte Jotly uniquement" : "Jotly-only context"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {isFrench
                      ? "L'assistant priorise ce qui existe deja dans votre espace: taches, commentaires, rappels, calendrier et recherche interne."
                      : "The assistant prioritizes what already exists in your workspace: tasks, comments, reminders, calendar, and internal search."}
                  </p>
                </div>
              </div>

              {assistantMessages.length === 0 ? (
                <div className="dialog-section-shell flex flex-col items-center gap-3 rounded-[28px] px-5 py-8 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-[22px] bg-white/75 text-accent shadow-[0_16px_34px_rgba(16,0,105,0.08)]">
                    <ChatIcon />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {isFrench ? "Pret pour une question precise" : "Ready for a precise question"}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {isFrench
                        ? "Demandez une priorisation, une synthese ou un plan d'action sur votre workspace."
                        : "Ask for prioritization, a synthesis, or an action plan on your workspace."}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3 pb-1">
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
                          className={`max-w-[90%] rounded-[24px] px-4 py-3 ${
                            isUserMessage
                              ? "ml-auto rounded-br-md bg-gradient-to-br from-accent to-secondary text-white shadow-[0_18px_36px_rgba(53,37,205,0.24)]"
                              : "dialog-section-shell rounded-bl-md text-foreground"
                          }`}
                        >
                          {isUserMessage ? (
                            <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                          ) : (
                            <div className="space-y-2.5">
                              <RichTextContent
                                value={message.content}
                                className="text-sm leading-6 [&_p]:m-0 [&_p+p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-1 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-1 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-1 [&_h3]:mb-1 [&_code]:rounded [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2"
                              />

                              {message.warning ? (
                                <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                                  {message.warning}
                                </div>
                              ) : null}

                              {hasAssistantMetadata ? (
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                                  {message.source ? (
                                    <span className="rounded-full border border-line bg-white/70 px-2.5 py-1 font-medium text-foreground">
                                      {formatAssistantSourceLabel(message.source, activeLocale)}
                                    </span>
                                  ) : null}
                                  {typeof message.usedTaskCount === "number" ? (
                                    <span className="rounded-full border border-line bg-white/70 px-2.5 py-1">
                                      {isFrench
                                        ? `${message.usedTaskCount} taches`
                                        : `${message.usedTaskCount} tasks`}
                                    </span>
                                  ) : null}
                                  {typeof message.usedCommentCount === "number" ? (
                                    <span className="rounded-full border border-line bg-white/70 px-2.5 py-1">
                                      {isFrench
                                        ? `${message.usedCommentCount} commentaires`
                                        : `${message.usedCommentCount} comments`}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          )}

                          <p className={`mt-2 text-[10px] ${isUserMessage ? "text-white/70" : "text-muted"}`}>
                            {formatDateTime(message.timestamp, activeLocale, activeTimeZone)}
                          </p>
                        </article>
                      );
                    })}
                  </div>

                  {isAssistantLoading ? (
                    <article className="dialog-section-shell max-w-[90%] rounded-[24px] rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60" style={{ animationDelay: "300ms" }} />
                        <span className="text-xs text-muted">
                          {isFrench ? "Analyse en cours..." : "Thinking..."}
                        </span>
                      </div>
                    </article>
                  ) : null}

                  <div ref={assistantMessagesEndRef} />
                </>
              )}
            </div>
          </div>

          <div className="border-t border-line/30 bg-white/18 px-4 py-4">
            <div className={`${toolbarSurfaceClass} mb-3 rounded-[24px] p-3`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {isFrench ? "Prompts rapides" : "Quick prompts"}
                </p>
                <span className="text-[10px] text-muted">
                  {assistantQuestion.length}/{ASSISTANT_QUESTION_MAX_LENGTH}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {assistantPromptSuggestions.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-white/72 px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:bg-accent-soft hover:text-accent"
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
            </div>

            <form className="flex items-end gap-2" onSubmit={handleAssistantSubmit}>
              <div className="flex-1 rounded-[24px] border border-line bg-white/74 p-2 shadow-[0_12px_26px_rgba(16,0,105,0.05)]">
                <input
                  type="text"
                  value={assistantQuestion}
                  onChange={(event) => {
                    setAssistantQuestion(event.target.value);
                    setAssistantErrorMessage(null);
                  }}
                  className="w-full bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted/60"
                  maxLength={ASSISTANT_QUESTION_MAX_LENGTH}
                  placeholder={isFrench ? "Posez une question..." : "Ask a question..."}
                  disabled={isAssistantLoading}
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-accent to-secondary text-white shadow-[0_18px_36px_rgba(53,37,205,0.24)] transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-50"
                disabled={isAssistantLoading}
              >
                <SendIcon />
              </button>
            </form>

            {assistantErrorMessage ? (
              <p className="mt-3 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {assistantErrorMessage}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="animate-pulse-soft fixed bottom-28 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:bottom-6 sm:right-6"
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
        <div className="fixed bottom-24 left-4 right-4 z-50 flex flex-col gap-2 sm:left-auto sm:right-6 sm:max-w-sm">
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
                className="animate-scale-in dialog-shell flex items-start gap-3 rounded-[24px] border-amber-200 px-4 py-3"
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
                    className="rounded-full px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft"
                    onClick={() => { void handleCompleteReminder(reminder.id); }}
                  >
                    {isFrench ? "Traiter" : "Complete"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-surface-soft hover:text-foreground"
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
