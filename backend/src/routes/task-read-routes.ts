import type { FastifyInstance } from "fastify";
import type { Task } from "@prisma/client";
import { materializeRecurringTasksForDate } from "../recurrence/recurrence-service";
import { sendError, zodIssuesToStrings } from "./route-helpers";
import { formatDateOnly, parseDateOnly } from "../tasks/task-store";
import type { TasksRouteOptions } from "./tasks";
import {
  taskIdParamsSchema,
  listTasksQuerySchema,
  listAllTasksQuerySchema,
  listTaskAlertsQuerySchema,
  listTaskTriageQuerySchema,
  STALE_THRESHOLD_DAYS,
  isTaskTableMissingError,
  sendTaskStorageNotInitializedError,
  serializeTask,
  addUtcDays,
  isTaskDueSoonStatus,
  compareDueSoonTasks,
  getAuthenticatedUserId,
} from "../tasks/task-route-helpers";

export function registerTaskReadRoutes(app: FastifyInstance, options: TasksRouteOptions): void {
  const { taskStore, recurrenceStore, projectStore } = options;

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

  app.get("/api/tasks/all", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const queryResult = listAllTasksQuerySchema.safeParse(request.query);

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

    const { project, projectId, status, dateFrom, dateTo } = queryResult.data;

    const parsedDateFrom = dateFrom ? parseDateOnly(dateFrom) : null;
    const parsedDateTo = dateTo ? parseDateOnly(dateTo) : null;

    try {
      let tasks = await taskStore.listByUser(authUserId);

      if (projectId) {
        // A top-level project filter also matches tasks assigned to its sub-projects.
        const scopedIds = new Set<string>([projectId]);
        if (projectStore) {
          const children = await projectStore.listChildren(projectId, authUserId);
          for (const child of children) {
            scopedIds.add(child.id);
          }
        }
        tasks = tasks.filter((task) => task.projectId !== null && scopedIds.has(task.projectId));
      } else if (project && project.trim() !== "") {
        const normalizedProject = project.trim().toLowerCase();
        tasks = tasks.filter(
          (task) => task.project !== null && task.project.trim().toLowerCase() === normalizedProject
        );
      }

      if (status && status !== "all") {
        tasks = tasks.filter((task) => task.status === status);
      }

      if (parsedDateFrom) {
        tasks = tasks.filter(
          (task) => task.targetDate.getTime() >= parsedDateFrom.getTime()
        );
      }

      if (parsedDateTo) {
        const endExclusive = new Date(parsedDateTo);
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
        tasks = tasks.filter(
          (task) => task.targetDate.getTime() < endExclusive.getTime()
        );
      }

      return reply.send({
        data: tasks.map(serializeTask)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to list all tasks");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list all tasks");
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
    const startInclusive = addUtcDays(anchorDate, -STALE_THRESHOLD_DAYS);

    try {
      const dueSoonTasks = (await taskStore.listByUser(authUserId))
        .filter(
          (task) =>
            task.dueDate !== null &&
            isTaskDueSoonStatus(task.status) &&
            task.dueDate.getTime() >= startInclusive.getTime() &&
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

  app.get("/api/tasks/triage", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const queryResult = listTaskTriageQuerySchema.safeParse(request.query);

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

    const startInclusive = addUtcDays(anchorDate, -STALE_THRESHOLD_DAYS);
    const msPerDay = 24 * 60 * 60 * 1000;

    try {
      const staleTasks = (await taskStore.listByUser(authUserId))
        .filter(
          (task) =>
            task.dueDate !== null &&
            isTaskDueSoonStatus(task.status) &&
            task.dueDate.getTime() < startInclusive.getTime()
        )
        .sort(compareDueSoonTasks);

      return reply.send({
        data: {
          count: staleTasks.length,
          tasks: staleTasks.map((task) => ({
            ...serializeTask(task),
            daysOverdue: Math.floor((anchorDate.getTime() - task.dueDate!.getTime()) / msPerDay),
          })),
        },
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to list task triage");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list task triage");
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
}
