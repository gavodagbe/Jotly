/**
 * Minimal JSON client for the backend, shared by the task, reminder and note APIs.
 * Distinguishes "the server said no" (ApiError) from "the server could not be
 * reached" (OfflineError), which the offline layer treats differently.
 */

const API_BASE = "/backend-api";

type ApiPayload<T> = { data?: T; error?: { code?: string; message?: string } } | null;

/** The server answered with an error status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | null = null,
    readonly data: unknown = null
  ) {
    super(message);
    this.name = "ApiError";
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

export async function apiRequest<T>(
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
    throw new ApiError(response.status, message, payload?.error?.code ?? null, payload?.data ?? null);
  }

  return payload?.data;
}

export function requireData<T>(data: T | undefined, fallbackMessage: string): T {
  if (data === undefined || data === null) {
    throw new Error(`${fallbackMessage}.`);
  }
  return data;
}

export function withBase<T extends object>(body: T, baseUpdatedAt?: string): T & { baseUpdatedAt?: string } {
  return baseUpdatedAt ? { ...body, baseUpdatedAt } : body;
}
