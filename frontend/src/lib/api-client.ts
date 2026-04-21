export type ApiErrorPayload = { error?: { code?: string; message?: string } } | null;

export class ApiRequestError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly apiCode: string | null = null
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export function getApiErrorMessage(statusCode: number, payload: ApiErrorPayload, fallback: string): string {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  return `${fallback} (HTTP ${statusCode}).`;
}

export function createAuthHeaders(token: string, includesJsonBody: boolean): HeadersInit {
  return {
    ...(includesJsonBody ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
}
