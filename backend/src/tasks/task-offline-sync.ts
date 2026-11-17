import { Task } from "@prisma/client";
import { z } from "zod";

/**
 * Offline sync support for task mutations (planning/OFFLINE.md, phase 2).
 *
 * - Clients may create a task with their own id: replaying the same create
 *   returns the existing task instead of a duplicate (idempotent retry).
 * - Clients may send the `updatedAt` their edit was based on: if the task
 *   changed on the server since, the update is rejected with 409 so the
 *   client can resolve the conflict.
 */

export const clientTaskIdSchema = z
  .string()
  .trim()
  .min(8, "id must be at least 8 characters")
  .max(64, "id must be at most 64 characters")
  .regex(/^[A-Za-z0-9_-]+$/, "id may only contain letters, digits, '-' and '_'");

export const baseUpdatedAtSchema = z.string().datetime({ offset: true, message: "baseUpdatedAt must be an ISO date-time" });

/** True when the server copy changed after the version the client edited. */
export function hasConcurrentChange(existingTask: Pick<Task, "updatedAt">, baseUpdatedAt: string | undefined): boolean {
  if (baseUpdatedAt === undefined) {
    return false;
  }
  const base = Date.parse(baseUpdatedAt);
  return Number.isFinite(base) && existingTask.updatedAt.getTime() > base;
}
