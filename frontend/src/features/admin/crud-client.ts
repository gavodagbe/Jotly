import { AdminApiError } from "./types";

const AUTH_TOKEN_STORAGE_KEY = "jotly_auth_token";

export function readAdminAuthToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

type ErrorPayload = { error?: { code?: string; message?: string } } | null;

function extractError(status: number, payload: ErrorPayload, fallback: string): AdminApiError {
  const message = payload?.error?.message?.trim();
  return new AdminApiError(message && message.length > 0 ? message : fallback, status, payload?.error?.code ?? null);
}

async function request<T>(
  method: string,
  path: string,
  token: string,
  body: unknown,
  fallbackError: string
): Promise<T> {
  const response = await fetch(`/backend-api${path}`, {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as ({ data?: T } & ErrorPayload) | null;
  if (!response.ok) {
    throw extractError(response.status, payload, fallbackError);
  }
  return (payload?.data ?? (undefined as T)) as T;
}

/**
 * Minimal typed REST helper shared by every admin resource. `basePath` is the
 * `/api/...` collection path; individual resources layer their own custom
 * actions on top when they need more than plain CRUD.
 */
export function createCrudClient<TRecord, TCreateInput = Partial<TRecord>, TUpdateInput = Partial<TRecord>>(
  basePath: string,
  token: string
) {
  return {
    list: () => request<TRecord[]>("GET", basePath, token, undefined, "Unable to load records"),
    create: (input: TCreateInput) =>
      request<TRecord>("POST", basePath, token, input, "Unable to create record"),
    update: (id: string, input: TUpdateInput) =>
      request<TRecord>("PATCH", `${basePath}/${encodeURIComponent(id)}`, token, input, "Unable to update record"),
    remove: (id: string) =>
      request<TRecord>("DELETE", `${basePath}/${encodeURIComponent(id)}`, token, undefined, "Unable to delete record"),
    action: <TResult = TRecord>(id: string, action: string, input?: unknown) =>
      request<TResult>(
        "PATCH",
        `${basePath}/${encodeURIComponent(id)}/${action}`,
        token,
        input ?? {},
        "Unable to complete the action"
      ),
    get: <TResult>(subPath: string) =>
      request<TResult>("GET", `${basePath}${subPath}`, token, undefined, "Unable to load records"),
  };
}

export type CrudClient<TRecord, TCreateInput = Partial<TRecord>, TUpdateInput = Partial<TRecord>> = ReturnType<
  typeof createCrudClient<TRecord, TCreateInput, TUpdateInput>
>;
