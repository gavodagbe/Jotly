import type { FastifyInstance } from "fastify";
import { autoCancelUntouchedTasks } from "../tasks/auto-cancel-untouched-service";
import { carryOverYesterdayTasks } from "../tasks/carry-over-service";
import { sendError, zodIssuesToStrings } from "./route-helpers";
import { parseDateOnly } from "../tasks/task-store";
import type { TasksRouteOptions } from "./tasks";
import {
  carryOverYesterdayBodySchema,
  autoCancelUntouchedBodySchema,
  isTaskTableMissingError,
  sendTaskStorageNotInitializedError,
  serializeTask,
  getAuthenticatedUserId,
} from "../tasks/task-route-helpers";

export function registerTaskMaintenanceRoutes(app: FastifyInstance, options: TasksRouteOptions): void {
  const { taskStore, assistantSearchSyncService, commentStore } = options;

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

    try {
      const { createdTasks, skippedCount } = await carryOverYesterdayTasks(taskStore, authUserId, targetDate);

      assistantSearchSyncService?.syncUserWorkspace(authUserId, { onlySourceTypes: ["task"] }).catch(() => {});
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

  app.post("/api/tasks/auto-cancel-untouched", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = autoCancelUntouchedBodySchema.safeParse(request.body);

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

    const today = parseDateOnly(bodyResult.data.today);

    if (!today) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "today must be a valid date in YYYY-MM-DD format"
      );
    }

    try {
      const result = await autoCancelUntouchedTasks({
        taskStore,
        commentStore,
        userId: authUserId,
        today,
        locale: bodyResult.data.locale,
      });

      if (result.cancelledCount > 0) {
        assistantSearchSyncService?.syncUserWorkspace(authUserId, { onlySourceTypes: ["task"] }).catch(() => {});
      }

      return reply.send({
        data: {
          cancelledCount: result.cancelledCount,
          tasks: result.tasks.map(serializeTask),
        },
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to auto-cancel untouched tasks");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to auto-cancel untouched tasks");
    }
  });
}
