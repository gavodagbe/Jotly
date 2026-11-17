/**
 * Shared validation schemas and helpers for the task routes (split out of routes/tasks.ts).
 */
import type { Task, TaskPriority, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { isStorageNotInitializedPrismaError, sendStorageNotInitializedError } from "../routes/route-helpers";
import { formatDateOnly, parseDateOnly } from "./task-store";
import { baseUpdatedAtSchema, clientTaskIdSchema } from "./task-offline-sync";
import type { CalendarEventStore } from "../google-calendar/calendar-event-store";

export const taskStatusSchema = z.enum(["todo", "in_progress", "done", "cancelled"]);
export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

export const targetDateSchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, {
    message: "targetDate must be a valid date in YYYY-MM-DD format"
  });

export const createTaskBodySchema = z.object({
  id: clientTaskIdSchema.optional(),
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional().nullable(),
  status: taskStatusSchema.optional(),
  targetDate: targetDateSchema,
  dueDate: targetDateSchema.optional(),
  priority: taskPrioritySchema.optional(),
  project: z.string().trim().optional().nullable(),
  projectId: z.string().trim().min(1, "projectId must not be empty").optional().nullable(),
  assignees: z.string().trim().optional().nullable(),
  plannedTime: z.number().int().nonnegative().optional().nullable(),
  calendarEventId: z.string().trim().min(1, "calendarEventId is required").optional().nullable(),
  autoCancelIfUntouched: z.boolean().optional(),
});

export const updateTaskBodySchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").optional(),
    description: z.string().trim().optional().nullable(),
    status: taskStatusSchema.optional(),
    targetDate: targetDateSchema.optional(),
    dueDate: targetDateSchema.optional(),
    priority: taskPrioritySchema.optional(),
    project: z.string().trim().optional().nullable(),
    projectId: z.string().trim().min(1, "projectId must not be empty").optional().nullable(),
    assignees: z.string().trim().optional().nullable(),
    plannedTime: z.number().int().nonnegative().optional().nullable(),
    calendarEventId: z.string().trim().min(1, "calendarEventId is required").optional().nullable(),
    autoCancelIfUntouched: z.boolean().optional(),
    baseUpdatedAt: baseUpdatedAtSchema.optional(),
  })
  .refine((body) => Object.keys(body).some((key) => key !== "baseUpdatedAt"), {
    message: "At least one field must be provided"
  });

export const taskIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Task id is required")
});

export const listTasksQuerySchema = z.object({
  date: targetDateSchema
});

export const listAllTasksQuerySchema = z.object({
  project: z.string().trim().optional(),
  projectId: z.string().trim().min(1).optional(),
  status: z.enum(["all", "todo", "in_progress", "done", "cancelled"]).optional(),
  dateFrom: targetDateSchema.optional(),
  dateTo: targetDateSchema.optional(),
});

export const listTaskAlertsQuerySchema = z.object({
  date: targetDateSchema
});

export const listTaskTriageQuerySchema = z.object({
  date: targetDateSchema
});

export const dateOnlySchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, {
    message: "date must be a valid date in YYYY-MM-DD format"
  });

export const listTimeEntriesQuerySchema = z.object({
  date: dateOnlySchema
});

export const upsertTimeEntryBodySchema = z.object({
  date: dateOnlySchema,
  fraction: z.number().min(0, "fraction must be between 0 and 1").max(1, "fraction must be between 0 and 1")
});

export const TIME_IMPUTATION_STEP = 0.05;

/** Rounds a day fraction to the nearest allowed 0.05 step and normalizes float noise. */
export function normalizeTimeFraction(value: number): number {
  const stepped = Math.round(value / TIME_IMPUTATION_STEP) * TIME_IMPUTATION_STEP;
  const clamped = Math.min(1, Math.max(0, stepped));
  return Number(clamped.toFixed(2));
}

export function sumTimeFractions(fractions: number[]): number {
  return Number(fractions.reduce((total, fraction) => total + fraction, 0).toFixed(2));
}

export const STALE_THRESHOLD_DAYS = 14;

export const carryOverYesterdayBodySchema = z.object({
  targetDate: targetDateSchema,
});

export const autoCancelUntouchedBodySchema = z.object({
  today: targetDateSchema,
  locale: z.enum(["en", "fr"]).optional(),
});

export function isTaskTableMissingError(error: unknown): boolean {
  return isStorageNotInitializedPrismaError(error);
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export function sendTaskStorageNotInitializedError(
  reply: {
    code: (statusCode: number) => {
      send: (payload: unknown) => unknown;
    };
  }
) {
  return sendStorageNotInitializedError(reply, "Task");
}

export function serializeTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    targetDate: formatDateOnly(task.targetDate),
    dueDate: task.dueDate ? formatDateOnly(task.dueDate) : null,
    priority: task.priority,
    project: task.project,
    subProject: task.subProject,
    projectId: task.projectId ?? null,
    assignees: task.assignees,
    plannedTime: task.plannedTime,
    rolledFromTaskId: task.rolledFromTaskId ?? null,
    recurrenceSourceTaskId: task.recurrenceSourceTaskId ?? null,
    recurrenceOccurrenceDate: task.recurrenceOccurrenceDate
      ? formatDateOnly(task.recurrenceOccurrenceDate)
      : null,
    calendarEventId: task.calendarEventId ?? null,
    autoCancelIfUntouched: task.autoCancelIfUntouched,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
    cancelledAt: task.cancelledAt?.toISOString() ?? null
  };
}

export function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value === "" ? null : value;
}

export function getTimestampsForNewStatus(status: TaskStatus, now: Date) {
  if (status === "done") {
    return { completedAt: now, cancelledAt: null };
  }

  if (status === "cancelled") {
    return { completedAt: null, cancelledAt: now };
  }

  return { completedAt: null, cancelledAt: null };
}

export function getTimestampsForStatusTransition(task: Task, nextStatus: TaskStatus, now: Date) {
  if (nextStatus === "done") {
    return {
      completedAt: task.completedAt ?? now,
      cancelledAt: null
    };
  }

  if (nextStatus === "cancelled") {
    return {
      completedAt: null,
      cancelledAt: task.cancelledAt ?? now
    };
  }

  return {
    completedAt: null,
    cancelledAt: null
  };
}

export function getPreviousDate(date: Date): Date {
  const previousDate = new Date(date);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  return previousDate;
}

export function addUtcDays(date: Date, offsetDays: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + offsetDays);
  return nextDate;
}

export function shouldCarryOverTask(task: Task): boolean {
  return (
    (task.status === "todo" || task.status === "in_progress") &&
    task.recurrenceSourceTaskId === null
  );
}

export function isTaskDueSoonStatus(status: TaskStatus): boolean {
  return status === "todo" || status === "in_progress";
}

export function getPrioritySortRank(priority: TaskPriority): number {
  if (priority === "high") {
    return 0;
  }

  if (priority === "medium") {
    return 1;
  }

  return 2;
}

export function compareDueSoonTasks(left: Task, right: Task): number {
  const leftDueAt = left.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightDueAt = right.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;

  if (leftDueAt !== rightDueAt) {
    return leftDueAt - rightDueAt;
  }

  const priorityDiff = getPrioritySortRank(left.priority) - getPrioritySortRank(right.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return left.createdAt.getTime() - right.createdAt.getTime();
}

export function getCarryOverDueDate(task: Task, nextTargetDate: Date): Date | null {
  if (!task.dueDate) {
    return nextTargetDate;
  }

  return formatDateOnly(task.dueDate) === formatDateOnly(task.targetDate)
    ? nextTargetDate
    : task.dueDate;
}

export function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }

  return request.authUserId;
}

export async function resolveCalendarEventId(
  calendarEventId: string | null | undefined,
  userId: string,
  calendarEventStore?: CalendarEventStore
): Promise<
  | { ok: true; hasValue: false }
  | { ok: true; hasValue: true; value: string | null }
  | { ok: false; reason: "NOT_AVAILABLE" | "NOT_FOUND" }
> {
  if (calendarEventId === undefined) {
    return { ok: true, hasValue: false };
  }

  if (calendarEventId === null) {
    return { ok: true, hasValue: true, value: null };
  }

  if (!calendarEventStore) {
    return { ok: false, reason: "NOT_AVAILABLE" };
  }

  const calendarEvent = await calendarEventStore.getById(calendarEventId, userId);
  if (!calendarEvent) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  return { ok: true, hasValue: true, value: calendarEvent.id };
}
