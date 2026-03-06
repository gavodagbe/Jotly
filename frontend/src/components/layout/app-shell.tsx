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
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-meta";

type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
type TaskPriority = "low" | "medium" | "high";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: string;
  priority: TaskPriority;
  project: string | null;
  plannedTime: number | null;
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

type TaskDialogMode = "create" | "edit";
type ApiErrorPayload = { error?: { message?: string } } | null;

const AUTH_TOKEN_STORAGE_KEY = "jotly_auth_token";

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

const BOARD_COLUMN_STATUSES = new Set<TaskStatus>(BOARD_COLUMNS.map((column) => column.status));
const PRIORITY_VALUES = new Set<TaskPriority>(PRIORITY_OPTIONS.map((option) => option.value));

const dateHeadingFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const controlButtonClass =
  "rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60";
const textFieldClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent";

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

function formatPriority(priority: TaskPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function isTaskStatus(value: string): value is TaskStatus {
  return BOARD_COLUMN_STATUSES.has(value as TaskStatus);
}

function isTaskPriority(value: string): value is TaskPriority {
  return PRIORITY_VALUES.has(value as TaskPriority);
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeOptionalTextInput(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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

function createAuthHeaders(token: string, includesJsonBody: boolean): HeadersInit {
  return {
    ...(includesJsonBody ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
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
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to validate session"));
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
      className={`rounded-2xl border border-line bg-background/80 px-3 py-3 shadow-sm transition ${
        isDragging ? "opacity-60 shadow-md" : ""
      } ${isSaving ? "cursor-wait opacity-80" : "cursor-grab active:cursor-grabbing"}`}
      aria-busy={isSaving}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{task.title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onEdit(task)}
            disabled={isSaving}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onDelete(task)}
            disabled={isSaving}
          >
            Delete
          </button>
        </div>
      </div>

      {task.description ? <p className="mt-2 text-sm leading-6 text-muted">{task.description}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
          {formatPriority(task.priority)}
        </span>
        {task.project ? (
          <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">
            {task.project}
          </span>
        ) : null}
        {typeof task.plannedTime === "number" ? (
          <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">
            {task.plannedTime} min
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
      className={`mt-4 flex-1 space-y-3 rounded-2xl p-1 transition ${isOver ? "bg-accent-soft/60" : ""}`}
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
    <div className="mx-auto flex min-h-screen w-full max-w-[720px] flex-col justify-center px-4 py-10 sm:px-8">
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">Authentication</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-muted">{APP_TAGLINE}</p>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            className={`${controlButtonClass} ${mode === "login" ? "border-accent/40 text-accent" : ""}`}
            onClick={() => onModeChange("login")}
            disabled={isSubmitting}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`${controlButtonClass} ${mode === "register" ? "border-accent/40 text-accent" : ""}`}
            onClick={() => onModeChange("register")}
            disabled={isSubmitting}
          >
            Register
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-foreground">
            Email
            <input
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => onValueChange("email", event.target.value)}
              className={textFieldClass}
              disabled={isSubmitting}
              required
            />
          </label>

          <label className="block text-sm font-medium text-foreground">
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
            <label className="block text-sm font-medium text-foreground">
              Display Name (optional)
              <input
                type="text"
                autoComplete="name"
                value={values.displayName}
                onChange={(event) => onValueChange("displayName", event.target.value)}
                className={textFieldClass}
                disabled={isSubmitting}
              />
            </label>
          ) : null}

          {errorMessage ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl border border-accent/50 bg-accent-soft px-3 py-2 text-sm font-semibold text-accent transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            {submitLabel}
          </button>
          <p className="text-xs text-muted">
            {mode === "login"
              ? "Use your account to access protected task APIs."
              : "New accounts are available immediately after registration."}
          </p>
        </form>
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
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([]);

  const [taskDialogMode, setTaskDialogMode] = useState<TaskDialogMode | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskFormValues, setTaskFormValues] = useState<TaskFormValues>(() =>
    getDefaultTaskFormValues(toDateInputValue(new Date()))
  );
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
  const isMutationPending = isSubmittingTask || isDeletingTask;

  function applyAuthSession(token: string, user: AuthUser) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    setAuthToken(token);
    setAuthUser(user);
    setAuthErrorMessage(null);
    setErrorMessage(null);
  }

  function clearAuthSession() {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setTasks([]);
    setErrorMessage(null);
    setDragErrorMessage(null);
    setIsLoading(false);
    setTaskDialogMode(null);
    setEditingTaskId(null);
    setTaskToDelete(null);
    setAuthFormValues((current) => ({ ...current, password: "" }));
  }

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

  function openCreateTaskDialog() {
    setTaskDialogMode("create");
    setEditingTaskId(null);
    setTaskFormValues(getDefaultTaskFormValues(selectedDate));
    setTaskFormErrorMessage(null);
    setDeleteErrorMessage(null);
  }

  function openEditTaskDialog(task: Task) {
    setTaskDialogMode("edit");
    setEditingTaskId(task.id);
    setTaskFormValues(getTaskFormValues(task));
    setTaskFormErrorMessage(null);
    setDeleteErrorMessage(null);
  }

  function closeTaskDialog() {
    if (isSubmittingTask) {
      return;
    }

    setTaskDialogMode(null);
    setEditingTaskId(null);
    setTaskFormErrorMessage(null);
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
    setActiveTaskId(null);
    setPendingTaskIds([]);

    setTaskDialogMode(null);
    setEditingTaskId(null);
    setTaskFormErrorMessage(null);
    setTaskToDelete(null);
    setDeleteErrorMessage(null);

    setSelectedDate(nextDate);
  }

  function updateTaskFormField(field: keyof TaskFormValues, value: string) {
    setTaskFormValues((current) => ({
      ...current,
      [field]: value,
    }));
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

    setTaskFormErrorMessage(null);
    setDeleteErrorMessage(null);
    setIsSubmittingTask(true);

    try {
      if (!authToken) {
        throw new Error("Authentication is required.");
      }

      if (taskDialogMode === "create") {
        const createdTask = await createTask(inputResult.data, authToken);

        setTasks((currentTasks) =>
          createdTask.targetDate === selectedDate ? [...currentTasks, createdTask] : currentTasks
        );
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
      }

      setTaskDialogMode(null);
      setEditingTaskId(null);
      setTaskFormErrorMessage(null);
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
      }

      setTaskToDelete(null);
    } catch (error) {
      setDeleteErrorMessage(error instanceof Error ? error.message : "Unable to delete task.");
    } finally {
      setIsDeletingTask(false);
    }
  }

  useEffect(() => {
    const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    setAuthToken(storedToken);
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
      .catch(() => {
        if (!cancelled) {
          clearAuthSession();
          setAuthErrorMessage("Your session expired. Please sign in again.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, isAuthReady]);

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
      <div className="mx-auto flex min-h-screen w-full max-w-[720px] items-center justify-center px-4 py-10 text-sm text-muted sm:px-8">
        Initializing session...
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
    <div className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col gap-6 px-4 py-8 sm:px-8 lg:px-10">
      <header className="rounded-3xl border border-line bg-surface/90 px-6 py-7 shadow-sm backdrop-blur sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">Authenticated Date Board</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{APP_NAME}</h1>
            <p className="mt-2 max-w-2xl text-base text-muted sm:text-lg">{APP_TAGLINE}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              {authUser.displayName ?? authUser.email}
            </p>
            <button type="button" className={controlButtonClass} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-line bg-surface px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
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
          <button
            type="button"
            className={`${controlButtonClass} border-accent/40 text-accent`}
            onClick={openCreateTaskDialog}
            disabled={isMutationPending}
          >
            New Task
          </button>
          <label className="ml-auto flex min-w-[190px] flex-col gap-1 text-xs uppercase tracking-[0.14em] text-muted">
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
              className="rounded-xl border border-line bg-background px-3 py-2 text-sm tracking-normal text-foreground outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <p className="font-medium text-foreground">{getDateHeading(selectedDate)}</p>
          <p>
            {isLoading
              ? "Loading tasks..."
              : `${tasks.length} task${tasks.length === 1 ? "" : "s"} for the selected date`}
          </p>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </section>
      ) : null}

      {dragErrorMessage ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {dragErrorMessage}
        </section>
      ) : null}

      {isEmptyBoard ? (
        <section className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted shadow-sm">
          No tasks are scheduled for this date yet.
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
                className="flex min-h-[320px] flex-col rounded-3xl border border-line bg-surface px-4 py-4 shadow-sm"
              >
                <header className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">
                    {column.label}
                  </h2>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                    {columnTasks.length}
                  </span>
                </header>

                <TaskColumn status={column.status}>
                  {isLoading ? (
                    <>
                      <div className="h-20 animate-pulse rounded-2xl bg-background" />
                      <div className="h-16 animate-pulse rounded-2xl bg-background" />
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
                    <p className="text-sm text-muted">{column.emptyLabel}</p>
                  )}
                </TaskColumn>
              </section>
            );
          })}
        </main>
      </DndContext>

      {isTaskDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
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
            className="w-full max-w-2xl rounded-3xl border border-line bg-surface p-5 shadow-2xl sm:p-6"
          >
            <header className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-foreground">{taskDialogTitle}</h2>
              <button
                type="button"
                className={controlButtonClass}
                onClick={closeTaskDialog}
                disabled={isSubmittingTask}
              >
                Close
              </button>
            </header>

            <form className="space-y-4" onSubmit={handleTaskFormSubmit}>
              <label className="block text-sm font-medium text-foreground">
                Title
                <input
                  type="text"
                  value={taskFormValues.title}
                  onChange={(event) => updateTaskFormField("title", event.target.value)}
                  className={textFieldClass}
                  maxLength={200}
                  required
                  disabled={isSubmittingTask}
                />
              </label>

              <label className="block text-sm font-medium text-foreground">
                Description
                <textarea
                  value={taskFormValues.description}
                  onChange={(event) => updateTaskFormField("description", event.target.value)}
                  className={`${textFieldClass} min-h-[90px] resize-y`}
                  disabled={isSubmittingTask}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">
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

                <label className="block text-sm font-medium text-foreground">
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
                <label className="block text-sm font-medium text-foreground">
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

                <label className="block text-sm font-medium text-foreground">
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

              <label className="block text-sm font-medium text-foreground">
                Project
                <input
                  type="text"
                  value={taskFormValues.project}
                  onChange={(event) => updateTaskFormField("project", event.target.value)}
                  className={textFieldClass}
                  disabled={isSubmittingTask}
                />
              </label>

              {taskFormErrorMessage ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {taskFormErrorMessage}
                </p>
              ) : null}

              <footer className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {taskDialogMode === "edit" ? (
                  <button
                    type="button"
                    className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <button
                    type="submit"
                    className="rounded-xl border border-accent/50 bg-accent-soft px-3 py-2 text-sm font-semibold text-accent transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmittingTask}
                  >
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
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
            className="w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-2xl sm:p-6"
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
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleDeleteTask}
                disabled={isDeletingTask}
              >
                {isDeletingTask ? "Deleting..." : "Delete task"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
