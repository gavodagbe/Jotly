import { Task, TaskPriority, TaskStatus } from "@prisma/client";
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { CalendarEventStore } from "../google-calendar/calendar-event-store";
import { RecurrenceStore } from "../recurrence/recurrence-store";
import { materializeRecurringTasksForDate } from "../recurrence/recurrence-service";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";
import { formatDateOnly, parseDateOnly, TaskStore, TaskUpdateInput } from "../tasks/task-store";

type TasksRouteOptions = {
  taskStore: TaskStore;
  authService: AuthService;
  recurrenceStore?: RecurrenceStore;
  calendarEventStore?: CalendarEventStore;
};

const taskStatusSchema = z.enum(["todo", "in_progress", "done", "cancelled"]);
const taskPrioritySchema = z.enum(["low", "medium", "high"]);

const targetDateSchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, {
    message: "targetDate must be a valid date in YYYY-MM-DD format"
  });

const createTaskBodySchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional().nullable(),
  status: taskStatusSchema.optional(),
  targetDate: targetDateSchema,
  dueDate: targetDateSchema.optional(),
  priority: taskPrioritySchema.optional(),
  project: z.string().trim().optional().nullable(),
  plannedTime: z.number().int().nonnegative().optional().nullable(),
  calendarEventId: z.string().trim().min(1, "calendarEventId is required").optional().nullable(),
});

const updateTaskBodySchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").optional(),
    description: z.string().trim().optional().nullable(),
    status: taskStatusSchema.optional(),
    targetDate: targetDateSchema.optional(),
    dueDate: targetDateSchema.optional(),
    priority: taskPrioritySchema.optional(),
    project: z.string().trim().optional().nullable(),
    plannedTime: z.number().int().nonnegative().optional().nullable(),
    calendarEventId: z.string().trim().min(1, "calendarEventId is required").optional().nullable(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided"
  });

const taskIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Task id is required")
});

const listTasksQuerySchema = z.object({
  date: targetDateSchema
});

const listTaskAlertsQuerySchema = z.object({
  date: targetDateSchema
});

const carryOverYesterdayBodySchema = z.object({
  targetDate: targetDateSchema,
});

function isTaskTableMissingError(error: unknown): boolean {
  return isStorageNotInitializedPrismaError(error);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function sendTaskStorageNotInitializedError(
  reply: {
    code: (statusCode: number) => {
      send: (payload: unknown) => unknown;
    };
  }
) {
  return sendStorageNotInitializedError(reply, "Task");
}

function serializeTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    targetDate: formatDateOnly(task.targetDate),
    dueDate: task.dueDate ? formatDateOnly(task.dueDate) : null,
    priority: task.priority,
    project: task.project,
    plannedTime: task.plannedTime,
    rolledFromTaskId: task.rolledFromTaskId ?? null,
    recurrenceSourceTaskId: task.recurrenceSourceTaskId ?? null,
    recurrenceOccurrenceDate: task.recurrenceOccurrenceDate
      ? formatDateOnly(task.recurrenceOccurrenceDate)
      : null,
    calendarEventId: task.calendarEventId ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
    cancelledAt: task.cancelledAt?.toISOString() ?? null
  };
}

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value === "" ? null : value;
}

function getTimestampsForNewStatus(status: TaskStatus, now: Date) {
  if (status === "done") {
    return { completedAt: now, cancelledAt: null };
  }

  if (status === "cancelled") {
    return { completedAt: null, cancelledAt: now };
  }

  return { completedAt: null, cancelledAt: null };
}

function getTimestampsForStatusTransition(task: Task, nextStatus: TaskStatus, now: Date) {
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

function getPreviousDate(date: Date): Date {
  const previousDate = new Date(date);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  return previousDate;
}

function addUtcDays(date: Date, offsetDays: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + offsetDays);
  return nextDate;
}

function shouldCarryOverTask(task: Task): boolean {
  return (
    (task.status === "todo" || task.status === "in_progress") &&
    task.recurrenceSourceTaskId === null
  );
}

function isTaskDueSoonStatus(status: TaskStatus): boolean {
  return status === "todo" || status === "in_progress";
}

function getPrioritySortRank(priority: TaskPriority): number {
  if (priority === "high") {
    return 0;
  }

  if (priority === "medium") {
    return 1;
  }

  return 2;
}

function compareDueSoonTasks(left: Task, right: Task): number {
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

function getCarryOverDueDate(task: Task, nextTargetDate: Date): Date | null {
  if (!task.dueDate) {
    return nextTargetDate;
  }

  return formatDateOnly(task.dueDate) === formatDateOnly(task.targetDate)
    ? nextTargetDate
    : task.dueDate;
}

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }

  return request.authUserId;
}

async function resolveCalendarEventId(
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

const tasksRoutes: FastifyPluginAsync<TasksRouteOptions> = async (app, options) => {
  const { taskStore, authService, recurrenceStore, calendarEventStore } = options;

  app.addHook("preHandler", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const authContext = await authService.authenticateBearerToken(token);

    if (!authContext) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    (request as { authUserId?: string }).authUserId = authContext.user.id;
  });

  app.get("/api/tasks", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const queryResult = listTasksQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      const details = zodIssuesToStrings(queryResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request query",
        details
      );
    }

    const targetDate = parseDateOnly(queryResult.data.date);

    if (!targetDate) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "targetDate must be a valid date in YYYY-MM-DD format"
      );
    }

    try {
      if (recurrenceStore) {
        await materializeRecurringTasksForDate(targetDate, taskStore, recurrenceStore, authUserId);
      }

      const tasks = await taskStore.listByDate(targetDate, authUserId);
      return reply.send({
        data: tasks.map(serializeTask)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to list tasks");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list tasks");
    }
  });

  app.get("/api/tasks/alerts", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const queryResult = listTaskAlertsQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      const details = zodIssuesToStrings(queryResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request query",
        details
      );
    }

    const anchorDate = parseDateOnly(queryResult.data.date);

    if (!anchorDate) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "date must be a valid date in YYYY-MM-DD format"
      );
    }

    const tomorrowDate = addUtcDays(anchorDate, 1);
    const endExclusive = addUtcDays(anchorDate, 2);

    try {
      const dueSoonTasks = (await taskStore.listByUser(authUserId))
        .filter(
          (task) =>
            task.dueDate !== null &&
            isTaskDueSoonStatus(task.status) &&
            task.dueDate.getTime() >= anchorDate.getTime() &&
            task.dueDate.getTime() < endExclusive.getTime()
        )
        .sort(compareDueSoonTasks);

      const dueTodayCount = dueSoonTasks.filter(
        (task) => task.dueDate && formatDateOnly(task.dueDate) === formatDateOnly(anchorDate)
      ).length;
      const dueTomorrowCount = dueSoonTasks.filter(
        (task) => task.dueDate && formatDateOnly(task.dueDate) === formatDateOnly(tomorrowDate)
      ).length;

      return reply.send({
        data: {
          count: dueSoonTasks.length,
          dueTodayCount,
          dueTomorrowCount,
          tasks: dueSoonTasks.map(serializeTask),
        },
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to list task alerts");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list task alerts");
    }
  });

  app.post("/api/tasks", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = createTaskBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request body",
        details
      );
    }

    const parsedDate = parseDateOnly(bodyResult.data.targetDate);

    if (!parsedDate) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "targetDate must be a valid date in YYYY-MM-DD format"
      );
    }

    const parsedDueDate = bodyResult.data.dueDate
      ? parseDateOnly(bodyResult.data.dueDate)
      : parsedDate;

    if (!parsedDueDate) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "dueDate must be a valid date in YYYY-MM-DD format"
      );
    }

    const status = bodyResult.data.status ?? "todo";
    const now = new Date();

    try {
      const linkedCalendarEvent = await resolveCalendarEventId(
        bodyResult.data.calendarEventId,
        authUserId,
        calendarEventStore
      );
      if (!linkedCalendarEvent.ok) {
        if (linkedCalendarEvent.reason === "NOT_AVAILABLE") {
          return sendError(reply, 400, "VALIDATION_ERROR", "Calendar event linking is not available");
        }
        return sendError(reply, 404, "NOT_FOUND", "Calendar event not found");
      }

      const task = await taskStore.create({
        userId: authUserId,
        title: bodyResult.data.title,
        description: normalizeNullableText(bodyResult.data.description) ?? null,
        status,
        targetDate: parsedDate,
        dueDate: parsedDueDate,
        priority: bodyResult.data.priority ?? "medium",
        project: normalizeNullableText(bodyResult.data.project) ?? null,
        plannedTime: bodyResult.data.plannedTime ?? null,
        calendarEventId: linkedCalendarEvent.hasValue ? linkedCalendarEvent.value : null,
        ...getTimestampsForNewStatus(status, now)
      });

      return reply.code(201).send({
        data: serializeTask(task)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to create task");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create task");
    }
  });

  app.post("/api/tasks/carry-over-yesterday", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = carryOverYesterdayBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request body",
        details
      );
    }

    const targetDate = parseDateOnly(bodyResult.data.targetDate);

    if (!targetDate) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "targetDate must be a valid date in YYYY-MM-DD format"
      );
    }

    const yesterdayDate = getPreviousDate(targetDate);

    try {
      const yesterdayTasks = await taskStore.listByDate(yesterdayDate, authUserId);
      const carryOverCandidates = yesterdayTasks.filter(shouldCarryOverTask);
      const createdTasks: Task[] = [];
      let skippedCount = 0;

      for (const sourceTask of carryOverCandidates) {
        try {
          const createdTask = await taskStore.create({
            userId: authUserId,
            rolledFromTaskId: sourceTask.id,
            title: sourceTask.title,
            description: sourceTask.description,
            status: sourceTask.status,
            targetDate,
            dueDate: getCarryOverDueDate(sourceTask, targetDate),
            priority: sourceTask.priority,
            project: sourceTask.project,
            plannedTime: sourceTask.plannedTime,
            recurrenceSourceTaskId: null,
            recurrenceOccurrenceDate: null,
            completedAt: null,
            cancelledAt: null,
          });

          createdTasks.push(createdTask);
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            skippedCount += 1;
            continue;
          }

          throw error;
        }
      }

      return reply.send({
        data: {
          copiedCount: createdTasks.length,
          skippedCount,
          tasks: createdTasks.map(serializeTask),
        },
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to carry over tasks from yesterday");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to carry over yesterday tasks");
    }
  });

  app.get("/api/tasks/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = taskIdParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request params",
        details
      );
    }

    try {
      const task = await taskStore.getById(paramsResult.data.id, authUserId);

      if (!task) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      return reply.send({
        data: serializeTask(task)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to fetch task");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to fetch task");
    }
  });

  app.patch("/api/tasks/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = taskIdParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request params",
        details
      );
    }

    const bodyResult = updateTaskBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request body",
        details
      );
    }

    const updateBody = bodyResult.data;

    try {
      const existingTask = await taskStore.getById(paramsResult.data.id, authUserId);

      if (!existingTask) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      const updateInput: TaskUpdateInput = {};

      if (updateBody.title !== undefined) {
        updateInput.title = updateBody.title;
      }

      if (updateBody.description !== undefined) {
        updateInput.description = normalizeNullableText(updateBody.description) ?? null;
      }

      if (updateBody.targetDate !== undefined) {
        const parsedDate = parseDateOnly(updateBody.targetDate);

        if (!parsedDate) {
          return sendError(
            reply,
            400,
            "VALIDATION_ERROR",
            "targetDate must be a valid date in YYYY-MM-DD format"
          );
        }

        updateInput.targetDate = parsedDate;
      }

      if (updateBody.dueDate !== undefined) {
        const parsedDueDate = parseDateOnly(updateBody.dueDate);

        if (!parsedDueDate) {
          return sendError(
            reply,
            400,
            "VALIDATION_ERROR",
            "dueDate must be a valid date in YYYY-MM-DD format"
          );
        }

        updateInput.dueDate = parsedDueDate;
      }

      if (updateBody.priority !== undefined) {
        updateInput.priority = updateBody.priority;
      }

      if (updateBody.project !== undefined) {
        updateInput.project = normalizeNullableText(updateBody.project) ?? null;
      }

      if (updateBody.plannedTime !== undefined) {
        updateInput.plannedTime = updateBody.plannedTime;
      }

      if (updateBody.calendarEventId !== undefined) {
        const linkedCalendarEvent = await resolveCalendarEventId(
          updateBody.calendarEventId,
          authUserId,
          calendarEventStore
        );
        if (!linkedCalendarEvent.ok) {
          if (linkedCalendarEvent.reason === "NOT_AVAILABLE") {
            return sendError(reply, 400, "VALIDATION_ERROR", "Calendar event linking is not available");
          }
          return sendError(reply, 404, "NOT_FOUND", "Calendar event not found");
        }
        if (linkedCalendarEvent.hasValue) {
          updateInput.calendarEventId = linkedCalendarEvent.value;
        }
      }

      const nextStatus = updateBody.status ?? existingTask.status;
      updateInput.status = nextStatus;

      const now = new Date();
      const timestamps = getTimestampsForStatusTransition(existingTask, nextStatus, now);
      updateInput.completedAt = timestamps.completedAt;
      updateInput.cancelledAt = timestamps.cancelledAt;

      const updatedTask = await taskStore.update(paramsResult.data.id, updateInput, authUserId);

      if (!updatedTask) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      return reply.send({
        data: serializeTask(updatedTask)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to update task");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to update task");
    }
  });

  app.delete("/api/tasks/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = taskIdParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request params",
        details
      );
    }

    try {
      const deletedTask = await taskStore.remove(paramsResult.data.id, authUserId);

      if (!deletedTask) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      return reply.send({
        data: serializeTask(deletedTask)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to delete task");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete task");
    }
  });
};

export default tasksRoutes;
