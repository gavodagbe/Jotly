import { FastifyPluginAsync } from "fastify";
import { TaskRecurrenceRule } from "@prisma/client";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { RecurrenceStore } from "../recurrence/recurrence-store";
import { formatDateOnly, parseDateOnly, TaskStore } from "../tasks/task-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type RecurrenceRouteOptions = {
  taskStore: TaskStore;
  recurrenceStore: RecurrenceStore;
  authService: AuthService;
};

type RecurrenceFrequency = "daily" | "weekly" | "monthly";

const taskParamsSchema = z.object({
  id: z.string().trim().min(1, "Task id is required"),
});

const recurrenceFrequencySchema = z.enum(["daily", "weekly", "monthly"]);

const recurrenceBodySchema = z
  .object({
    frequency: recurrenceFrequencySchema,
    interval: z.number().int().min(1).max(365).optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    endsOn: z
      .string()
      .refine((value) => parseDateOnly(value) !== null, {
        message: "endsOn must be a valid date in YYYY-MM-DD format",
      })
      .nullable()
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.frequency !== "weekly" && Array.isArray(value.weekdays) && value.weekdays.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["weekdays"],
        message: "weekdays is only supported for weekly recurrence",
      });
    }

    if (Array.isArray(value.weekdays)) {
      const uniqueCount = new Set(value.weekdays).size;

      if (uniqueCount !== value.weekdays.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["weekdays"],
          message: "weekdays must not contain duplicate values",
        });
      }
    }
  });

function serializeRecurrenceRule(rule: TaskRecurrenceRule) {
  return {
    id: rule.id,
    taskId: rule.taskId,
    frequency: rule.frequency,
    interval: rule.interval,
    weekdays: [...rule.weekdays],
    endsOn: rule.endsOn ? formatDateOnly(rule.endsOn) : null,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

function isStorageMissingError(error: unknown): boolean {
  return isStorageNotInitializedPrismaError(error);
}

function normalizeWeekdays(frequency: RecurrenceFrequency, weekdays: number[] | undefined): number[] {
  if (frequency !== "weekly") {
    return [];
  }

  if (!weekdays || weekdays.length === 0) {
    return [];
  }

  return [...weekdays].sort((left, right) => left - right);
}

const recurrenceRoutes: FastifyPluginAsync<RecurrenceRouteOptions> = async (app, options) => {
  const { taskStore, recurrenceStore, authService } = options;

  app.addHook("preHandler", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const authContext = await authService.authenticateBearerToken(token);

    if (!authContext) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
  });

  app.get("/api/tasks/:id/recurrence", async (request, reply) => {
    const paramsResult = taskParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request params", details);
    }

    try {
      const task = await taskStore.getById(paramsResult.data.id);

      if (!task) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      const rule = await recurrenceStore.getByTaskId(paramsResult.data.id);

      return reply.send({
        data: rule ? serializeRecurrenceRule(rule) : null,
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Recurrence table is missing");
        return sendStorageNotInitializedError(reply, "Recurrence");
      }

      request.log.error(error, "Failed to fetch recurrence rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to fetch recurrence rule");
    }
  });

  app.put("/api/tasks/:id/recurrence", async (request, reply) => {
    const paramsResult = taskParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request params", details);
    }

    const bodyResult = recurrenceBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    const frequency = bodyResult.data.frequency as RecurrenceFrequency;
    const endsOnDate =
      bodyResult.data.endsOn === undefined || bodyResult.data.endsOn === null
        ? null
        : parseDateOnly(bodyResult.data.endsOn);

    if (bodyResult.data.endsOn && !endsOnDate) {
      return sendError(reply, 400, "VALIDATION_ERROR", "endsOn must be a valid date in YYYY-MM-DD format");
    }

    try {
      const task = await taskStore.getById(paramsResult.data.id);

      if (!task) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      if (task.recurrenceSourceTaskId) {
        return sendError(
          reply,
          409,
          "CONFLICT",
          "Recurrence can only be configured on source tasks."
        );
      }

      const rule = await recurrenceStore.upsertByTaskId(task.id, {
        frequency,
        interval: bodyResult.data.interval ?? 1,
        weekdays: normalizeWeekdays(frequency, bodyResult.data.weekdays),
        endsOn: endsOnDate,
      });

      return reply.send({
        data: serializeRecurrenceRule(rule),
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Recurrence table is missing");
        return sendStorageNotInitializedError(reply, "Recurrence");
      }

      request.log.error(error, "Failed to upsert recurrence rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to save recurrence rule");
    }
  });

  app.delete("/api/tasks/:id/recurrence", async (request, reply) => {
    const paramsResult = taskParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request params", details);
    }

    try {
      const task = await taskStore.getById(paramsResult.data.id);

      if (!task) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      const deletedRule = await recurrenceStore.removeByTaskId(task.id);

      return reply.send({
        data: deletedRule ? serializeRecurrenceRule(deletedRule) : null,
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Recurrence table is missing");
        return sendStorageNotInitializedError(reply, "Recurrence");
      }

      request.log.error(error, "Failed to delete recurrence rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete recurrence rule");
    }
  });
};

export default recurrenceRoutes;
