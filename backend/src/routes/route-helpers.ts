import { Prisma } from "@prisma/client";
import { z } from "zod";

export type ApiErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR" | "SERVICE_UNAVAILABLE" | "OCR_UNAVAILABLE" | "AI_UNAVAILABLE" | "AI_ERROR";

export function sendError(
  reply: {
    code: (statusCode: number) => {
      send: (payload: unknown) => unknown;
    };
  },
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: string[]
) {
  const payload: {
    error: { code: ApiErrorCode; message: string; details?: string[] };
  } = {
    error: {
      code,
      message,
    },
  };

  if (details && details.length > 0) {
    payload.error.details = details;
  }

  return reply.code(statusCode).send(payload);
}

export function zodIssuesToStrings(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function getBearerToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const [scheme, token] = value.trim().split(/\s+/, 2);

  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function isStorageNotInitializedPrismaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export function sendStorageNotInitializedError(
  reply: {
    code: (statusCode: number) => {
      send: (payload: unknown) => unknown;
    };
  },
  entityName: string
) {
  return sendError(
    reply,
    503,
    "INTERNAL_ERROR",
    `${entityName} storage is not initialized. Apply Prisma migrations and retry.`
  );
}
