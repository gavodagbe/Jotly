import type { FastifyInstance } from "fastify";
import type { Task } from "@prisma/client";
import { sendError, zodIssuesToStrings } from "./route-helpers";
import { formatDateOnly, parseDateOnly } from "../tasks/task-store";
import type { TasksRouteOptions } from "./tasks";
import {
  taskIdParamsSchema,
  listTimeEntriesQuerySchema,
  upsertTimeEntryBodySchema,
  normalizeTimeFraction,
  sumTimeFractions,
  isTaskTableMissingError,
  sendTaskStorageNotInitializedError,
  getAuthenticatedUserId,
} from "../tasks/task-route-helpers";

export function registerTaskTimeEntryRoutes(app: FastifyInstance, options: TasksRouteOptions): void {
  const { taskStore, taskTimeEntryStore } = options;

  app.get("/api/tasks/time-entries", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    if (!taskTimeEntryStore) {
      return sendTaskStorageNotInitializedError(reply);
    }

    const queryResult = listTimeEntriesQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      const details = zodIssuesToStrings(queryResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request query", details);
    }

    const entryDate = parseDateOnly(queryResult.data.date);

    if (!entryDate) {
      return sendError(reply, 400, "VALIDATION_ERROR", "date must be a valid date in YYYY-MM-DD format");
    }

    try {
      const entries = await taskTimeEntryStore.listByDate(authUserId, entryDate);

      return reply.send({
        data: {
          date: formatDateOnly(entryDate),
          total: sumTimeFractions(entries.map((entry) => entry.fraction)),
          entries: entries.map((entry) => ({
            taskId: entry.taskId,
            fraction: entry.fraction,
          })),
        },
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task time entry table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to list task time entries");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list task time entries");
    }
  });

  app.put("/api/tasks/:id/time-entry", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    if (!taskTimeEntryStore) {
      return sendTaskStorageNotInitializedError(reply);
    }

    const paramsResult = taskIdParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid task id", details);
    }

    const bodyResult = upsertTimeEntryBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    const entryDate = parseDateOnly(bodyResult.data.date);

    if (!entryDate) {
      return sendError(reply, 400, "VALIDATION_ERROR", "date must be a valid date in YYYY-MM-DD format");
    }

    const fraction = normalizeTimeFraction(bodyResult.data.fraction);

    try {
      const task = await taskStore.getById(paramsResult.data.id, authUserId);

      if (!task) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      if (fraction === 0) {
        await taskTimeEntryStore.remove(task.id, entryDate);
      } else {
        await taskTimeEntryStore.upsert({
          taskId: task.id,
          userId: authUserId,
          entryDate,
          fraction,
        });
      }

      const dayEntries = await taskTimeEntryStore.listByDate(authUserId, entryDate);

      return reply.send({
        data: {
          taskId: task.id,
          date: formatDateOnly(entryDate),
          fraction,
          dayTotal: sumTimeFractions(dayEntries.map((entry) => entry.fraction)),
        },
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task time entry table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to save task time entry");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to save task time entry");
    }
  });
}
