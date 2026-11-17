/**
 * Raw network calls for tasks (moved out of app-shell.tsx).
 * The offline layer (src/lib/offline/task-repository.ts) wraps these.
 */
import type {
  Task,
  TaskListFilters,
  TaskMutationInput,
  TaskPatch,
  TaskTimeEntriesPayload,
  TaskTimeEntrySavePayload,
} from "./task-types";

const API_BASE = "/backend-api";

type ApiPayload<T> = { data?: T; error?: { code?: string; message?: string } } | null;

/** The server answered with an error status. */
export class TaskApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | null = null,
    readonly data: unknown = null
  ) {
    super(message);
    this.name = "TaskApiError";
  }
}

/** The request never reached the server (no network, or the service worker reported offline). */
export class OfflineError extends Error {
  constructor(message = "You are offline.") {
    super(message);
    this.name = "OfflineError";
  }
}

export function isOfflineError(error: unknown): error is OfflineError {
  return error instanceof OfflineError;
}

function authHeaders(token: string, hasJsonBody: boolean): HeadersInit {
  return {
    ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
}

async function request<T>(
  path: string,
  init: { method: string; token: string; body?: unknown; signal?: AbortSignal },
  fallbackMessage: string
): Promise<T | undefined> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init.method,
      headers: authHeaders(init.token, init.body !== undefined),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
      cache: init.method === "GET" ? "no-store" : undefined,
    });
  } catch (error) {
    if (init.signal?.aborted) {
      throw error;
    }
    throw new OfflineError();
  }

  // X-Jotly-Offline: the service worker could not reach the server.
  // X-Jotly-Offline-Cache: it served a stale cached copy; the local database is fresher.
  if (response.headers.get("X-Jotly-Offline") === "1" || response.headers.get("X-Jotly-Offline-Cache") === "1") {
    throw new OfflineError();
  }

  const payload = (await response.json().catch(() => null)) as ApiPayload<T>;

  if (!response.ok) {
    const message = payload?.error?.message ?? `${fallbackMessage} (HTTP ${response.status}).`;
    throw new TaskApiError(response.status, message, payload?.error?.code ?? null, payload?.data ?? null);
  }

  return payload?.data;
}

function requireData<T>(data: T | undefined, fallbackMessage: string): T {
  if (data === undefined || data === null) {
    throw new Error(`${fallbackMessage}.`);
  }
  return data;
}

export async function fetchTasksByDate(date: string, token: string, signal?: AbortSignal): Promise<Task[]> {
  const data = await request<Task[]>(
    `/tasks?date=${encodeURIComponent(date)}`,
    { method: "GET", token, signal },
    "Unable to load tasks for this date"
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchAllTasks(token: string, filters: TaskListFilters, signal?: AbortSignal): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.project) params.set("project", filters.project);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await request<Task[]>(`/tasks/all${query}`, { method: "GET", token, signal }, "Unable to load tasks");
  return Array.isArray(data) ? data : [];
}

export async function postTask(input: TaskMutationInput & { id?: string }, token: string): Promise<Task> {
  const data = await request<Task>("/tasks", { method: "POST", token, body: input }, "Unable to create task");
  return requireData(data, "Unable to create task");
}

export async function patchTask(
  taskId: string,
  patch: TaskPatch,
  token: string,
  options: { baseUpdatedAt?: string; errorMessage?: string } = {}
): Promise<Task> {
  const message = options.errorMessage ?? "Unable to update task";
  const body = options.baseUpdatedAt ? { ...patch, baseUpdatedAt: options.baseUpdatedAt } : patch;
  const data = await request<Task>(`/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", token, body }, message);
  return requireData(data, message);
}

export async function deleteTask(taskId: string, token: string): Promise<void> {
  await request<Task>(`/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE", token }, "Unable to delete task");
}

export async function fetchTaskTimeEntries(
  date: string,
  token: string,
  signal?: AbortSignal
): Promise<TaskTimeEntriesPayload> {
  const data = await request<TaskTimeEntriesPayload>(
    `/tasks/time-entries?date=${encodeURIComponent(date)}`,
    { method: "GET", token, signal },
    "Unable to load imputed time"
  );
  return data ?? { date, total: 0, entries: [] };
}

export async function putTaskTimeEntry(
  taskId: string,
  input: { date: string; fraction: number },
  token: string
): Promise<TaskTimeEntrySavePayload> {
  const data = await request<TaskTimeEntrySavePayload>(
    `/tasks/${encodeURIComponent(taskId)}/time-entry`,
    { method: "PUT", token, body: input },
    "Unable to save imputed time"
  );
  return requireData(data, "Unable to save imputed time");
}
