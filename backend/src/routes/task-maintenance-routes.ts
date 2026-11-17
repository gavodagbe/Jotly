import type { FastifyInstance } from "fastify";
import type { Task } from "@prisma/client";
import { autoCancelUntouchedTasks } from "../tasks/auto-cancel-untouched-service";
import { sendError, zodIssuesToStrings } from "./route-helpers";
import { parseDateOnly } from "../tasks/task-store";
import type { TasksRouteOptions } from "./tasks";
import {
  carryOverYesterdayBodySchema,
  autoCancelUntouchedBodySchema,
  isTaskTableMissingError,
  isUniqueConstraintError,
  sendTaskStorageNotInitializedError,
  serializeTask,
  getPreviousDate,
  shouldCarryOverTask,
  getCarryOverDueDate,
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
            subProject: sourceTask.subProject,
            projectId: sourceTask.projectId,
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
