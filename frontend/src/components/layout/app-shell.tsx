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

type CarryOverYesterdayPayload = {
  copiedCount: number;
  skippedCount: number;
  tasks: Task[];
};

type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
};

type AuthMode = "login" | "register";

type AuthFormValues = {
  email: string;
  password: string;
  displayName: string;
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

const ASSISTANT_PROMPT_SUGGESTIONS: ReadonlyArray<string> = [
  "What should I prioritize across all my tasks?",
  "Create a realistic order for my open tasks this week.",
  "Which tasks look blocked and what should I unblock first?",
];

const DAILY_AFFIRMATION_SUGGESTIONS: ReadonlyArray<string> = [
  "I choose focus, discipline, and calm execution today.",
  "I finish what matters most before I move to new work.",
  "I am consistent, capable, and committed to meaningful progress.",
  "I protect deep work and handle distractions with intention.",
  "I act with clarity, energy, and confidence in every task.",
];

const BOARD_COLUMNS: ReadonlyArray<{
  status: TaskStatus;
  label: string;
  emptyLabel: string;
}> = [
  { status: "todo", label: "To Do", emptyLabel: "No tasks ready for this day." },
  { status: "in_progress", label: "In Progress", emptyLabel: "No tasks in progress." },
  { status: "done", label: "Done", emptyLabel: "Nothing completed yet." },
  { status: "cancelled", label: "Cancelled", emptyLabel: "No cancelled tasks." },
];

const PRIORITY_OPTIONS: ReadonlyArray<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const RECURRENCE_FREQUENCY_OPTIONS: ReadonlyArray<{ value: RecurrenceFrequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const WEEKDAY_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const BOARD_COLUMN_STATUSES = new Set<TaskStatus>(BOARD_COLUMNS.map((column) => column.status));
const PRIORITY_VALUES = new Set<TaskPriority>(PRIORITY_OPTIONS.map((option) => option.value));
const RECURRENCE_FREQUENCY_VALUES = new Set<RecurrenceFrequency>(
  RECURRENCE_FREQUENCY_OPTIONS.map((option) => option.value)
);

const dateHeadingFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

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

function getDateHeading(value: string): string {
  return dateHeadingFormatter.format(parseDateInput(value));
}

function getDefaultAffirmationText(targetDate: string): string {
  const segments = targetDate.split("-").map((segment) => Number(segment));
  const seed = segments.reduce((total, current) => total + (Number.isNaN(current) ? 0 : current), 0);
  const index = seed % DAILY_AFFIRMATION_SUGGESTIONS.length;
  return DAILY_AFFIRMATION_SUGGESTIONS[index];
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateTimeFormatter.format(parsed);
}

function formatPriority(priority: TaskPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
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
  date: string
): { data?: DayBilanMutationInput; error?: string } {
  if (!isDateOnly(date)) {
    return { error: "Date must be in YYYY-MM-DD format." };
  }

  let mood: number | null = null;
  const moodValue = values.mood.trim();

  if (moodValue.length > 0) {
    const parsedMood = Number(moodValue);

    if (!Number.isInteger(parsedMood) || parsedMood < 1 || parsedMood > 5) {
      return { error: "Mood must be a value between 1 and 5." };
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

function buildTaskMutationInput(values: TaskFormValues): { data?: TaskMutationInput; error?: string } {
  const title = values.title.trim();
  if (!title) {
    return { error: "Title is required." };
  }

  if (!isDateOnly(values.targetDate)) {
    return { error: "Target date must be in YYYY-MM-DD format." };
  }

  if (!isTaskStatus(values.status)) {
    return { error: "Status is invalid." };
  }

  if (!isTaskPriority(values.priority)) {
    return { error: "Priority is invalid." };
  }

  const plannedTimeValue = values.plannedTime.trim();
  let plannedTime: number | null = null;

  if (plannedTimeValue) {
    const parsed = Number(plannedTimeValue);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { error: "Planned time must be a non-negative integer." };
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
  values: RecurrenceFormValues
): { data?: TaskRecurrenceMutationInput; error?: string } {
  if (!values.enabled) {
    return {};
  }

  if (!isRecurrenceFrequency(values.frequency)) {
    return { error: "Recurrence frequency is invalid." };
  }

  const intervalValue = values.interval.trim();
  const interval = Number(intervalValue);

  if (!intervalValue || !Number.isInteger(interval) || interval < 1) {
    return { error: "Recurrence interval must be an integer greater than or equal to 1." };
  }

  const normalizedWeekdays = [...values.weekdays].sort((left, right) => left - right);

  if (values.frequency === "weekly" && normalizedWeekdays.length === 0) {
    return { error: "Select at least one weekday for weekly recurrence." };
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
    return { error: "Recurrence end date must be in YYYY-MM-DD format." };
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

  return payload.data;
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

  return payload.data;
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

  return payload.data.user;
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

async function requestAssistantReply(question: string, token: string): Promise<AssistantReplyPayload> {
  const response = await fetch("/backend-api/assistant/reply", {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({
      question,
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

type AppNavbarProps = {
  user: AuthUser | null;
  onLogout?: () => void;
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

function AppNavbar({ user, onLogout, onLogin, isBusy = false }: AppNavbarProps) {
  const isLoggedIn = user !== null;
  const profileLabel = user?.displayName ?? user?.email ?? "Guest";

  return (
    <nav className="mb-4 flex items-center justify-between rounded-2xl border border-line bg-surface/92 px-4 py-3 shadow-[0_18px_45px_-34px_rgba(16,34,48,0.7)] backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-sm font-bold text-white shadow-sm">J</div>
        <div>
          <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
          <p className="text-xs text-muted">{isLoggedIn ? "Planner workspace" : "Sign in to continue"}</p>
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
          <button type="button" className={controlButtonClass} onClick={onLogout} disabled={isBusy || !onLogout}>
            Logout
          </button>
        ) : (
          <button type="button" className={controlButtonClass} onClick={onLogin} disabled={isBusy || !onLogin}>
            Login
          </button>
        )}
      </div>
    </nav>
  );
}

type RichTextEditorProps = {
  value: string;
  disabled: boolean;
  onChange: (nextValue: string) => void;
};

function RichTextEditor({ value, disabled, onChange }: RichTextEditorProps) {
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
    const selected = value.slice(start, end) || "text";
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
        const selected = value.slice(start, end) || "link text";
        const prompted = window.prompt("Enter a URL", "https://");

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
        placeholder="Describe the task. Use the toolbar for bold, lists, quotes, code, and links."
        disabled={disabled}
      />

      <div className="border-t border-line bg-surface-soft/60 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Preview</p>
        {value.trim() ? (
          <div
            className="rich-text-render mt-2 text-sm leading-6 text-muted"
            dangerouslySetInnerHTML={{ __html: renderDescriptionHtml(value) }}
          />
        ) : (
          <p className="mt-1 text-xs text-muted">Add description text to preview formatting.</p>
        )}
      </div>
    </div>
  );
}

type TaskCardProps = {
  task: Task;
  isDragging: boolean;
  isSaving: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

function TaskCard({ task, isDragging, isSaving, onEdit, onDelete }: TaskCardProps) {
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
            Drag
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
            Edit
          </button>
          <button
            type="button"
            className="rounded-lg border border-rose-200 bg-rose-50/80 px-2.5 py-1 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onDelete(task)}
            disabled={isSaving}
          >
            Delete
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
          {formatPriority(task.priority)}
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusChipClassByStatus[task.status]}`}
        >
          {BOARD_COLUMNS.find((column) => column.status === task.status)?.label ?? task.status}
        </span>
        {task.project ? (
          <span className="rounded-full border border-line bg-surface-soft px-2.5 py-1 text-[11px] text-muted">
            Project: {task.project}
          </span>
        ) : null}
        {typeof task.plannedTime === "number" ? (
          <span className="rounded-full border border-line bg-surface-soft px-2.5 py-1 text-[11px] text-muted">
            Time: {formatPlannedTime(task.plannedTime)}
          </span>
        ) : null}
        {task.recurrenceSourceTaskId ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">
            Recurring
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
  mode: AuthMode;
  values: AuthFormValues;
  isSubmitting: boolean;
  errorMessage: string | null;
  onModeChange: (mode: AuthMode) => void;
  onValueChange: (field: keyof AuthFormValues, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function AuthPanel({
  mode,
  values,
  isSubmitting,
  errorMessage,
  onModeChange,
  onValueChange,
  onSubmit,
}: AuthPanelProps) {
  const submitLabel =
    mode === "login"
      ? isSubmitting
        ? "Signing in..."
        : "Sign in"
      : isSubmitting
      ? "Creating..."
      : "Create account";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1080px] flex-col justify-center px-4 py-8 sm:px-8">
      <AppNavbar user={null} onLogin={() => onModeChange("login")} isBusy={isSubmitting} />

      <section className="grid w-full overflow-hidden rounded-[2rem] border border-line bg-surface/95 shadow-[0_36px_80px_-52px_rgba(16,34,48,0.8)] backdrop-blur lg:grid-cols-[1.12fr_1fr]">
        <div className="border-b border-line bg-gradient-to-br from-accent-soft via-[#e8f6f4] to-surface-soft p-8 lg:border-b-0 lg:border-r lg:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">Daily Planning Workspace</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{APP_NAME}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted sm:text-base">{APP_TAGLINE}</p>

          <div className="mt-7 space-y-3 text-sm text-foreground/90">
            <p className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
              Plan work by day and keep priorities visible.
            </p>
            <p className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
              Drag tasks across statuses as work progresses.
            </p>
            <p className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
              Keep a reliable view of what needs attention now.
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
              Sign in
            </button>
            <button
              type="button"
              className={`min-w-[110px] rounded-lg px-4 py-2 text-sm font-semibold transition ${
                mode === "register" ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-foreground"
              }`}
              onClick={() => onModeChange("register")}
              disabled={isSubmitting}
            >
              Register
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm font-semibold text-foreground">
              Email
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
              Password
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
                Display Name (optional)
                <input
                  type="text"
                  autoComplete="name"
                  value={values.displayName}
                  onChange={(event) => onValueChange("displayName", event.target.value)}
                  className={textFieldClass}
                  disabled={isSubmitting}
                  placeholder="How should we address you?"
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
                ? "Use your account to continue to your daily board."
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
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authFormValues, setAuthFormValues] = useState<AuthFormValues>({
    email: "",
    password: "",
    displayName: "",
  });
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

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
    getDefaultAffirmationText(toDateInputValue(new Date()))
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
    setAuthErrorMessage(null);
    setErrorMessage(null);
  }

  const clearAuthSession = useCallback(() => {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setTasks([]);
    setErrorMessage(null);
    setDragErrorMessage(null);
    setIsCarryingOverYesterday(false);
    setCarryOverMessage(null);
    setCarryOverErrorMessage(null);
    setDayAffirmation(null);
    setDayAffirmationDraft(getDefaultAffirmationText(toDateInputValue(new Date())));
    setIsDayAffirmationLoading(false);
    setIsDayAffirmationSaving(false);
    setDayAffirmationErrorMessage(null);
    setDayBilan(null);
    setDayBilanFormValues(getDefaultDayBilanFormValues());
    setIsDayBilanLoading(false);
    setIsDayBilanSaving(false);
    setDayBilanErrorMessage(null);
    setDayBilanSuccessMessage(null);
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
      setAuthErrorMessage(error instanceof Error ? error.message : "Unable to authenticate.");
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
    setDayAffirmationDraft(getDefaultAffirmationText(nextDate));
    setDayAffirmationErrorMessage(null);
    setDayBilan(null);
    setDayBilanFormValues(getDefaultDayBilanFormValues());
    setDayBilanErrorMessage(null);
    setDayBilanSuccessMessage(null);
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
      setAssistantErrorMessage("Enter a question for the assistant.");
      return;
    }

    if (normalizedQuestion.length > ASSISTANT_QUESTION_MAX_LENGTH) {
      setAssistantErrorMessage(
        `Question is too long. Maximum length is ${ASSISTANT_QUESTION_MAX_LENGTH} characters.`
      );
      return;
    }

    if (!authToken) {
      setAssistantErrorMessage("Authentication is required.");
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
      const reply = await requestAssistantReply(normalizedQuestion, authToken);
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
        error instanceof Error ? error.message : "Unable to generate assistant reply."
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
      setCarryOverErrorMessage("Authentication is required.");
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
        setCarryOverMessage("No actionable tasks found yesterday.");
      } else {
        setCarryOverMessage(
          `Carry-over complete: ${result.copiedCount} copied, ${result.skippedCount} skipped.`
        );
      }
    } catch (error) {
      setCarryOverErrorMessage(
        error instanceof Error ? error.message : "Unable to carry over yesterday tasks."
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
      setDayAffirmationErrorMessage("Authentication is required.");
      return;
    }

    const fallbackText = getDefaultAffirmationText(selectedDate);
    const nextTextCandidate = options?.text ?? dayAffirmationDraft;
    const normalizedText = nextTextCandidate.trim().length > 0 ? nextTextCandidate.trim() : fallbackText;
    const nextCompletion = options?.isCompleted ?? dayAffirmation?.isCompleted ?? false;

    if (normalizedText.length > DAY_AFFIRMATION_MAX_LENGTH) {
      setDayAffirmationErrorMessage(
        `Affirmation is too long. Maximum length is ${DAY_AFFIRMATION_MAX_LENGTH} characters.`
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
        error instanceof Error ? error.message : "Unable to save day affirmation."
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
      setDayBilanErrorMessage("Authentication is required.");
      return;
    }

    const inputResult = buildDayBilanMutationInput(dayBilanFormValues, selectedDate);
    if (!inputResult.data) {
      setDayBilanErrorMessage(inputResult.error ?? "Invalid day bilan.");
      return;
    }

    setDayBilanErrorMessage(null);
    setDayBilanSuccessMessage(null);
    setIsDayBilanSaving(true);

    try {
      const savedBilan = await upsertDayBilan(inputResult.data, authToken);
      setDayBilan(savedBilan);
      setDayBilanFormValues(getDayBilanFormValues(savedBilan));
      setDayBilanSuccessMessage("Day bilan saved.");
    } catch (error) {
      setDayBilanErrorMessage(error instanceof Error ? error.message : "Unable to save day bilan.");
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
      setProjectFormErrorMessage("Project name is required.");
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
      setProjectFormErrorMessage("Select a project to delete.");
      return;
    }

    if (selectedProjectIsUsed) {
      setProjectFormErrorMessage(
        "This project is in use on the current board and cannot be deleted."
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
      setTaskCommentErrorMessage("Comment text is required.");
      return;
    }

    if (!authToken) {
      setTaskCommentErrorMessage("Authentication is required.");
      return;
    }

    setTaskCommentErrorMessage(null);
    setIsCreatingTaskComment(true);

    try {
      const comment = await createTaskComment(editingTaskId, body, authToken);
      setTaskComments((currentComments) => [...currentComments, comment]);
      setTaskCommentDraft("");
    } catch (error) {
      setTaskCommentErrorMessage(error instanceof Error ? error.message : "Unable to create comment.");
    } finally {
      setIsCreatingTaskComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!editingTaskId || isTaskDetailsLoading) {
      return;
    }

    if (!authToken) {
      setTaskCommentErrorMessage("Authentication is required.");
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
      setTaskCommentErrorMessage(error instanceof Error ? error.message : "Unable to delete comment.");
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
      setTaskAttachmentErrorMessage("Attachment name is required.");
      return;
    }

    if (!file) {
      setTaskAttachmentErrorMessage("Select a file to upload.");
      return;
    }

    if (file.size > MAX_ATTACHMENT_UPLOAD_BYTES) {
      setTaskAttachmentErrorMessage(
        `Attachment exceeds ${formatFileSize(MAX_ATTACHMENT_UPLOAD_BYTES)} limit.`
      );
      return;
    }

    if (!authToken) {
      setTaskAttachmentErrorMessage("Authentication is required.");
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
        error instanceof Error ? error.message : "Unable to create attachment."
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
      setTaskAttachmentErrorMessage("Authentication is required.");
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
        error instanceof Error ? error.message : "Unable to delete attachment."
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

    const inputResult = buildTaskMutationInput(taskFormValues);
    if (!inputResult.data) {
      setTaskFormErrorMessage(inputResult.error ?? "Invalid task details.");
      return;
    }

    const recurrenceResult = buildRecurrenceMutationInput(recurrenceFormValues);
    if (recurrenceFormValues.enabled && !recurrenceResult.data) {
      setTaskFormErrorMessage(recurrenceResult.error ?? "Invalid recurrence settings.");
      return;
    }

    setTaskFormErrorMessage(null);
    setDeleteErrorMessage(null);
    setIsSubmittingTask(true);

    try {
      if (!authToken) {
        throw new Error("Authentication is required.");
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
                ? `Task saved, but recurrence could not be updated: ${error.message}`
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
                ? `Task saved, but recurrence could not be removed: ${error.message}`
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
      setTaskFormErrorMessage(error instanceof Error ? error.message : "Unable to save task.");
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
        throw new Error("Authentication is required.");
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
      setDeleteErrorMessage(error instanceof Error ? error.message : "Unable to delete task.");
    } finally {
      setIsDeletingTask(false);
    }
  }

  useEffect(() => {
    if (taskDialogMode !== "edit" || !editingTaskId) {
      return;
    }

    if (!authToken) {
      setTaskDetailsErrorMessage("Authentication is required.");
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
          error instanceof Error ? error.message : "Unable to load task details."
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
  }, [authToken, editingTask?.recurrenceSourceTaskId, editingTaskId, taskDialogMode]);

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
          setAuthErrorMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          if (error instanceof ApiRequestError && error.statusCode === 401) {
            clearAuthSession();
            setAuthErrorMessage("Your session expired. Please sign in again.");
            return;
          }

          setAuthErrorMessage(
            error instanceof Error ? error.message : "Unable to validate your session right now."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, clearAuthSession, isAuthReady]);

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
        setErrorMessage(error instanceof Error ? error.message : "Unable to load tasks for this date.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, authUser, isAuthReady, selectedDate]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!authToken || !authUser) {
      setDayAffirmation(null);
      setDayAffirmationDraft(getDefaultAffirmationText(selectedDate));
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
        setDayAffirmationDraft(nextAffirmation?.text ?? getDefaultAffirmationText(selectedDate));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setDayAffirmation(null);
        setDayAffirmationDraft(getDefaultAffirmationText(selectedDate));
        setDayAffirmationErrorMessage(
          error instanceof Error ? error.message : "Unable to load day affirmation."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsDayAffirmationLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, authUser, isAuthReady, selectedDate]);

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
        setDayBilanErrorMessage(error instanceof Error ? error.message : "Unable to load day bilan.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsDayBilanLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, authUser, isAuthReady, selectedDate]);

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
  const taskDialogTitle = taskDialogMode === "create" ? "Create Task" : "Edit Task";
  const taskDialogSubmitLabel =
    taskDialogMode === "create"
      ? isSubmittingTask
        ? "Creating..."
        : "Create task"
      : isSubmittingTask
      ? "Saving..."
      : "Save changes";
  const totalPlannedMinutes = tasks.reduce((total, task) => total + (task.plannedTime ?? 0), 0);
  const actionableTaskCount = tasksByStatus.todo.length + tasksByStatus.in_progress.length;
  const isAffirmationCompleted = dayAffirmation?.isCompleted ?? false;
  const completionItemCount = tasks.length + 1;
  const completedItemCount = tasksByStatus.done.length + (isAffirmationCompleted ? 1 : 0);
  const completionRate =
    completionItemCount === 0 ? 0 : Math.round((completedItemCount / completionItemCount) * 100);

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
      setDragErrorMessage("Authentication is required.");
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
      setDragErrorMessage(error instanceof Error ? error.message : "Unable to move task.");
    } finally {
      markTaskAsPending(taskId, false);
    }
  }

  if (!isAuthReady) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[720px] items-center justify-center px-4 py-10 sm:px-8">
        <div className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm font-medium text-muted shadow-sm">
          Initializing secure session...
        </div>
      </div>
    );
  }

  if (!authToken || !authUser) {
    return (
      <AuthPanel
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
      <AppNavbar user={authUser} onLogout={handleLogout} isBusy={isMutationPending || isLoading} />

      <header className="rounded-[1.8rem] border border-line bg-surface/95 px-6 py-6 shadow-[0_34px_80px_-60px_rgba(16,34,48,0.95)] backdrop-blur sm:px-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">Daily Task Operations</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{APP_NAME}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">{APP_TAGLINE}</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface-soft px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">Total Tasks</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{tasks.length}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface-soft px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">Actionable</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{actionableTaskCount}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface-soft px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">Planned Time</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatPlannedTime(totalPlannedMinutes)}</p>
          </div>
        </div>
      </header>

      <section className="rounded-[1.5rem] border border-line bg-surface px-5 py-5 shadow-[0_18px_45px_-35px_rgba(16,34,48,0.9)] sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-soft p-1.5">
            <button
              type="button"
              className={controlButtonClass}
              onClick={() => handleDateChange(shiftDate(selectedDate, -1))}
              disabled={isMutationPending}
            >
              Previous Day
            </button>
            <button
              type="button"
              className={controlButtonClass}
              onClick={() => handleDateChange(toDateInputValue(new Date()))}
              disabled={isMutationPending}
            >
              Today
            </button>
            <button
              type="button"
              className={controlButtonClass}
              onClick={() => handleDateChange(shiftDate(selectedDate, 1))}
              disabled={isMutationPending}
            >
              Next Day
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={controlButtonClass}
              onClick={handleCarryOverYesterday}
              disabled={isMutationPending || isLoading || isDayAffirmationSaving}
            >
              {isCarryingOverYesterday ? "Carrying..." : "Carry Over Yesterday"}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => openCreateTaskDialog()}
              disabled={isMutationPending}
            >
              New Task
            </button>
          </div>

          <label className="flex min-w-[210px] flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Selected Date
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
          <p className="font-semibold text-foreground">{getDateHeading(selectedDate)}</p>
          <p className="font-medium">
            {isLoading
              ? "Loading tasks..."
              : `${tasks.length} task${tasks.length === 1 ? "" : "s"} for the selected date`}
          </p>
          <p className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
            Completion {completionRate}%
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
            <h2 className="mt-1 text-lg font-semibold text-foreground">Day Affirmation</h2>
            <p className="text-sm text-muted">
              One intentional statement for the day. Mark it done to include it in completion.
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
            Affirmation completed
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block text-sm font-semibold text-foreground">
            Today statement
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
            {isDayAffirmationSaving ? "Saving..." : "Save affirmation"}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <p>
            {dayAffirmationDraft.trim().length}/{DAY_AFFIRMATION_MAX_LENGTH}
          </p>
          {dayAffirmation?.updatedAt ? <p>Last update: {formatDateTime(dayAffirmation.updatedAt)}</p> : null}
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
          <p className="font-semibold text-foreground">No tasks are scheduled for this date yet.</p>
          <p className="mt-1">Create your first task to populate this board.</p>
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
          {BOARD_COLUMNS.map((column) => {
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
                      + Task
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
            <p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted">End Of Day</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Day Bilan</h2>
            <p className="text-sm text-muted">Capture wins, blockers, and your top 3 for tomorrow.</p>
          </div>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={handleSaveDayBilan}
            disabled={isDayBilanLoading || isDayBilanSaving}
          >
            {isDayBilanSaving ? "Saving..." : "Save bilan"}
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface-soft px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Done Tasks</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{tasksByStatus.done.length}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-soft px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Actionable</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{actionableTaskCount}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-soft px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Cancelled</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{tasksByStatus.cancelled.length}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-soft px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Affirmation</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {isAffirmationCompleted ? "Done" : "Pending"}
            </p>
          </div>
        </div>

        {isDayBilanLoading ? (
          <p className="mt-4 text-sm text-muted">Loading day bilan...</p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              Mood (1-5)
              <select
                value={dayBilanFormValues.mood}
                onChange={(event) => updateDayBilanField("mood", event.target.value)}
                className={textFieldClass}
                disabled={isDayBilanSaving}
              >
                <option value="">Not set</option>
                <option value="1">1 - Very hard day</option>
                <option value="2">2 - Hard day</option>
                <option value="3">3 - Neutral day</option>
                <option value="4">4 - Good day</option>
                <option value="5">5 - Excellent day</option>
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-semibold text-foreground">
                Wins
                <textarea
                  value={dayBilanFormValues.wins}
                  onChange={(event) => updateDayBilanField("wins", event.target.value)}
                  className={`${textFieldClass} mt-1 min-h-[110px] resize-y`}
                  maxLength={DAY_BILAN_FIELD_MAX_LENGTH}
                  disabled={isDayBilanSaving}
                />
              </label>
              <label className="block text-sm font-semibold text-foreground">
                Blockers
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
                Lessons learned
                <textarea
                  value={dayBilanFormValues.lessonsLearned}
                  onChange={(event) => updateDayBilanField("lessonsLearned", event.target.value)}
                  className={`${textFieldClass} mt-1 min-h-[110px] resize-y`}
                  maxLength={DAY_BILAN_FIELD_MAX_LENGTH}
                  disabled={isDayBilanSaving}
                />
              </label>
              <label className="block text-sm font-semibold text-foreground">
                Tomorrow top 3
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
          <p className="mt-3 text-xs text-muted">Last update: {formatDateTime(dayBilan.updatedAt)}</p>
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
                <p className="mt-1 text-sm text-muted">Set details clearly so this task is easy to complete.</p>
              </div>
              <button
                type="button"
                className={controlButtonClass}
                onClick={closeTaskDialog}
                disabled={isSubmittingTask}
              >
                Close
              </button>
            </header>

            <form className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" onSubmit={handleTaskFormSubmit}>
              <label className="block text-sm font-semibold text-foreground">
                Title
                <input
                  type="text"
                  value={taskFormValues.title}
                  onChange={(event) => updateTaskFormField("title", event.target.value)}
                  className={textFieldClass}
                  maxLength={200}
                  placeholder="Write a concise action item"
                  required
                  disabled={isSubmittingTask}
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                Description
                <RichTextEditor
                  value={taskFormValues.description}
                  onChange={(nextValue) => updateTaskFormField("description", nextValue)}
                  disabled={isSubmittingTask}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-foreground">
                  Status
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
                    {BOARD_COLUMNS.map((column) => (
                      <option key={column.status} value={column.status}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-semibold text-foreground">
                  Priority
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
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-foreground">
                  Target Date
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
                  Planned Time (minutes)
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
                    <h3 className="text-sm font-semibold text-foreground">Project</h3>
                    <p className="text-xs text-muted">
                      Select an existing project or create a new one.
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
                    Delete Project
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <label className="block text-sm font-semibold text-foreground">
                    Project
                    <select
                      value={taskFormValues.project}
                      onChange={(event) => updateTaskFormField("project", event.target.value)}
                      className={textFieldClass}
                      disabled={isSubmittingTask}
                    >
                      <option value="">No project</option>
                      {projectSelectOptions.map((projectName) => (
                        <option key={projectName} value={projectName}>
                          {projectName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="text-xs text-muted">
                    {selectedProjectIsUsed
                      ? "Used on current board"
                      : "Can be deleted if unused"}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <label className="block text-sm font-semibold text-foreground">
                    New Project
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
                      placeholder="Type a project name"
                      disabled={isSubmittingTask}
                    />
                  </label>
                  <button
                    type="button"
                    className={controlButtonClass}
                    onClick={handleCreateProjectOption}
                    disabled={isSubmittingTask}
                  >
                    Add Project
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
                    <h3 className="text-sm font-semibold text-foreground">Recurrence</h3>
                    <p className="text-xs text-muted">
                      Automatically create future task instances.
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
                    Repeat task
                  </label>
                </div>

                {isEditingGeneratedTask ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    This is a generated recurrence instance. Edit the source task to change recurrence.
                  </p>
                ) : null}

                {recurrenceFormValues.enabled && !isEditingGeneratedTask ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-semibold text-foreground">
                        Frequency
                        <select
                          value={recurrenceFormValues.frequency}
                          onChange={(event) =>
                            updateRecurrenceFormField("frequency", event.target.value)
                          }
                          className={textFieldClass}
                          disabled={isSubmittingTask}
                        >
                          {RECURRENCE_FREQUENCY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-sm font-semibold text-foreground">
                        Every
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
                        <p className="text-sm font-semibold text-foreground">Weekdays</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {WEEKDAY_OPTIONS.map((option) => {
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
                      Ends On (optional)
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
                    <h3 className="text-sm font-semibold text-foreground">Task Details</h3>
                    <p className="text-xs text-muted">Comments and attachments for this task.</p>
                  </header>

                  {isTaskDetailsLoading ? (
                    <p className="text-sm text-muted">Loading task details...</p>
                  ) : null}

                  {taskDetailsErrorMessage ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {taskDetailsErrorMessage}
                    </p>
                  ) : null}

                  <section>
                    <h4 className="text-sm font-semibold text-foreground">
                      Comments ({taskComments.length})
                    </h4>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                      {taskComments.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-line bg-surface px-3 py-2 text-sm text-muted">
                          No comments yet.
                        </p>
                      ) : (
                        taskComments.map((comment) => (
                          <article
                            key={comment.id}
                            className="rounded-xl border border-line bg-surface px-3 py-2.5"
                          >
                            <p className="text-sm text-foreground">{comment.body}</p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <p className="text-xs text-muted">{formatDateTime(comment.createdAt)}</p>
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
                                {pendingCommentIds.includes(comment.id) ? "Removing..." : "Remove"}
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
                        placeholder="Add a comment..."
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
                        {isCreatingTaskComment ? "Adding..." : "Add comment"}
                      </button>
                    </div>
                  </section>

                  <section>
                    <h4 className="text-sm font-semibold text-foreground">
                      Attachments ({taskAttachments.length})
                    </h4>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                      {taskAttachments.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-line bg-surface px-3 py-2 text-sm text-muted">
                          No attachments yet.
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
                                  {isDataUrl(attachment.url) ? "Open file" : attachment.url}
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
                                {pendingAttachmentIds.includes(attachment.id) ? "Removing..." : "Remove"}
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
                      <label className="block text-sm font-semibold text-foreground">
                        Name
                        <input
                          type="text"
                          value={taskAttachmentNameDraft}
                          onChange={(event) => setTaskAttachmentNameDraft(event.target.value)}
                          className={textFieldClass}
                          disabled={isSubmittingTask || isCreatingTaskAttachment || isTaskDetailsLoading}
                          placeholder="Spec"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-foreground">
                        File
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
                        {isCreatingTaskAttachment ? "Uploading..." : "Upload"}
                      </button>
                    </div>

                    <p className="mt-2 text-[11px] text-muted">
                      Upload up to {formatFileSize(MAX_ATTACHMENT_UPLOAD_BYTES)} per attachment.
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
                    Delete Task
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
                    Cancel
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
            aria-label="Delete task confirmation"
            className="w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-[0_40px_80px_-50px_rgba(0,0,0,0.95)] sm:p-6"
          >
            <h3 className="text-lg font-semibold text-foreground">Delete task?</h3>
            <p className="mt-2 text-sm text-muted">
              This will permanently remove <span className="font-semibold text-foreground">{taskToDelete.title}</span>.
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
                Cancel
              </button>
              <button
                type="button"
                className={dangerButtonClass}
                onClick={handleDeleteTask}
                disabled={isDeletingTask}
              >
                {isDeletingTask ? "Deleting..." : "Delete task"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isAssistantPanelOpen ? (
        <section className="fixed bottom-24 left-4 right-4 z-40 flex max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_65px_-35px_rgba(16,34,48,0.95)] sm:left-auto sm:right-6 sm:w-[390px]">
          <header className="flex items-center justify-between gap-2 border-b border-line bg-surface-soft px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted">AI Assistant</p>
              <p className="text-sm font-semibold text-foreground">All your tasks</p>
            </div>
            <button
              type="button"
              className={`${iconButtonClass} h-7 px-2.5 text-[11px]`}
              onClick={() => setIsAssistantPanelOpen(false)}
              disabled={isAssistantLoading}
            >
              Close
            </button>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto bg-surface-soft/40 px-3 py-3">
            {assistantMessages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-surface px-3 py-2 text-sm text-muted">
                Ask anything about your tasks across all dates. Press Enter to send.
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
                      {formatDateTime(message.timestamp)}
                      {message.role === "assistant" && message.source ? ` · ${message.source}` : ""}
                      {message.role === "assistant" &&
                      typeof message.usedTaskCount === "number" &&
                      typeof message.usedCommentCount === "number"
                        ? ` · ${message.usedTaskCount} tasks, ${message.usedCommentCount} comments`
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
              {ASSISTANT_PROMPT_SUGGESTIONS.map((prompt) => (
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
                placeholder="Ask anything about your tasks..."
                disabled={isAssistantLoading}
              />
              <button type="submit" className={primaryButtonClass} disabled={isAssistantLoading}>
                {isAssistantLoading ? "..." : "Send"}
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
        aria-label={isAssistantPanelOpen ? "Close AI assistant" : "Open AI assistant"}
      >
        AI
      </button>
    </div>
  );
}
