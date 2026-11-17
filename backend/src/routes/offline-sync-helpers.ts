import { z } from "zod";

/**
 * Offline sync support shared by tasks, reminders and notes (planning/OFFLINE.md).
 *
 * - Clients may create a record with their own id: replaying the same create
 *   returns the existing record instead of a duplicate (idempotent retry).
 * - Clients may send the `updatedAt` their edit was based on: if the record
 *   changed on the server since, the update is rejected with 409 so the
 *   client can resolve the conflict.
 */

export const clientIdSchema = z
  .string()
  .trim()
  .min(8, "id must be at least 8 characters")
  .max(64, "id must be at most 64 characters")
  .regex(/^[A-Za-z0-9_-]+$/, "id may only contain letters, digits, '-' and '_'");

export const baseUpdatedAtSchema = z.string().datetime({ offset: true, message: "baseUpdatedAt must be an ISO date-time" });

/** True when the server copy changed after the version the client edited. */
export function hasConcurrentChange(existing: { updatedAt: Date }, baseUpdatedAt: string | undefined): boolean {
  if (baseUpdatedAt === undefined) {
    return false;
  }
  const base = Date.parse(baseUpdatedAt);
  return Number.isFinite(base) && existing.updatedAt.getTime() > base;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/** Body sent with a 409 so the client can reconcile with the current server copy. */
export function conflictPayload(message: string, data: unknown) {
  return { error: { code: "CONFLICT", message }, data };
}
