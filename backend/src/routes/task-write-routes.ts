import type { FastifyInstance } from "fastify";
import type { Task } from "@prisma/client";
import { sendError, zodIssuesToStrings } from "./route-helpers";
import { parseDateOnly, type TaskUpdateInput } from "../tasks/task-store";
import { resolveProjectSelection } from "../projects/project-selection";
import { conflictPayload, hasConcurrentChange } from "./offline-sync-helpers";
import type { TasksRouteOptions } from "./tasks";
import {
  createTaskBodySchema,
  updateTaskBodySchema,
  taskIdParamsSchema,
  isTaskTableMissingError,
  isUniqueConstraintError,
  sendTaskStorageNotInitializedError,
  serializeTask,
  normalizeNullableText,
  getTimestampsForNewStatus,
  getTimestampsForStatusTransition,
  getAuthenticatedUserId,
  resolveCalendarEventId,
} from "../tasks/task-route-helpers";

export function registerTaskWriteRoutes(app: FastifyInstance, options: TasksRouteOptions): void {
  const { taskStore, calendarEventStore, assistantSearchSyncService, projectStore } = options;

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
    const clientTaskId = bodyResult.data.id;

    try {
      if (clientTaskId) {
        // Offline replay of a create that already reached the server.
        const alreadyCreated = await taskStore.getById(clientTaskId, authUserId);
        if (alreadyCreated) {
          return reply.code(200).send({ data: serializeTask(alreadyCreated) });
        }
      }

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

      const projectResolution = await resolveProjectSelection(
        bodyResult.data,
        authUserId,
        projectStore,
        "create"
      );
      if (!projectResolution.ok) {
        return sendError(
          reply,
          projectResolution.error === "PROJECT_NOT_FOUND" ? 404 : 400,
          projectResolution.error === "PROJECT_NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
          projectResolution.error === "PROJECT_NOT_FOUND"
            ? "Project not found"
            : "Project selection is not available"
        );
      }

      const task = await taskStore.create({
        ...(clientTaskId ? { id: clientTaskId } : {}),
        userId: authUserId,
        title: bodyResult.data.title,
        description: normalizeNullableText(bodyResult.data.description) ?? null,
        status,
        targetDate: parsedDate,
        dueDate: parsedDueDate,
        priority: bodyResult.data.priority ?? "medium",
        project: projectResolution.fields.project ?? null,
        subProject: projectResolution.fields.subProject ?? null,
        projectId: projectResolution.fields.projectId ?? null,
        assignees: normalizeNullableText(bodyResult.data.assignees) ?? null,
        plannedTime: bodyResult.data.plannedTime ?? null,
        calendarEventId: linkedCalendarEvent.hasValue ? linkedCalendarEvent.value : null,
        autoCancelIfUntouched: bodyResult.data.autoCancelIfUntouched ?? false,
        ...getTimestampsForNewStatus(status, now)
      });

      assistantSearchSyncService?.syncUserWorkspace(authUserId, { onlySourceTypes: ["task"] }).catch(() => {});
      return reply.code(201).send({
        data: serializeTask(task)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      if (clientTaskId && isUniqueConstraintError(error)) {
        return sendError(reply, 409, "CONFLICT", "Task id is already in use");
      }

      request.log.error(error, "Failed to create task");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create task");
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

      if (hasConcurrentChange(existingTask, updateBody.baseUpdatedAt)) {
        return reply
          .code(409)
          .send(conflictPayload("Task was modified since this change was made", serializeTask(existingTask)));
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

      if (updateBody.project !== undefined || updateBody.projectId !== undefined) {
        const projectResolution = await resolveProjectSelection(
          updateBody,
          authUserId,
          projectStore,
          "update"
        );
        if (!projectResolution.ok) {
          return sendError(
            reply,
            projectResolution.error === "PROJECT_NOT_FOUND" ? 404 : 400,
            projectResolution.error === "PROJECT_NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
            projectResolution.error === "PROJECT_NOT_FOUND"
              ? "Project not found"
              : "Project selection is not available"
          );
        }
        Object.assign(updateInput, projectResolution.fields);
      }

      if (updateBody.assignees !== undefined) {
        updateInput.assignees = normalizeNullableText(updateBody.assignees) ?? null;
      }

      if (updateBody.plannedTime !== undefined) {
        updateInput.plannedTime = updateBody.plannedTime;
      }

      if (updateBody.autoCancelIfUntouched !== undefined) {
        updateInput.autoCancelIfUntouched = updateBody.autoCancelIfUntouched;
      }

      if (
        updateBody.calendarEventId !== undefined &&
        updateBody.calendarEventId !== existingTask.calendarEventId
      ) {
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

      assistantSearchSyncService?.syncUserWorkspace(authUserId, { onlySourceTypes: ["task"] }).catch(() => {});
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

      assistantSearchSyncService?.syncUserWorkspace(authUserId, { onlySourceTypes: ["task"] }).catch(() => {});
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
}
