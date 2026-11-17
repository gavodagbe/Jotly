import type { FastifyInstance } from "fastify";
import { resolveProjectSelection } from "../projects/project-selection";
import { isStorageNotInitializedPrismaError, sendError, sendStorageNotInitializedError, zodIssuesToStrings } from "./route-helpers";
import type { ReminderRoutesOptions } from "./reminders";
import { conflictPayload, hasConcurrentChange, isUniqueConstraintError } from "./offline-sync-helpers";
import {
  createReminderBodySchema,
  updateReminderBodySchema,
  getAuthenticatedUserId,
  serializeReminder,
} from "../reminders/reminder-route-helpers";

export function registerReminderWriteRoutes(app: FastifyInstance, options: ReminderRoutesOptions): void {
  const { reminderStore, assistantSearchSyncService, projectStore } = options;

  // POST /api/reminders
  app.post("/api/reminders", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = createReminderBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    const clientId = bodyResult.data.id;
    if (clientId) {
      // Offline replay of a create that already reached the server.
      const alreadyCreated = await reminderStore.getById(clientId, authUserId);
      if (alreadyCreated) {
        return reply.code(200).send({ data: serializeReminder(alreadyCreated) });
      }
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

    try {
      const reminder = await reminderStore.create({
        ...(clientId ? { id: clientId } : {}),
        userId: authUserId,
        title: bodyResult.data.title,
        description: bodyResult.data.description ?? null,
        project: projectResolution.fields.project ?? null,
        subProject: projectResolution.fields.subProject ?? null,
        projectId: projectResolution.fields.projectId ?? null,
        assignees: bodyResult.data.assignees ?? null,
        remindAt: new Date(bodyResult.data.remindAt),
      });
      assistantSearchSyncService?.syncUserWorkspace(authUserId, { onlySourceTypes: ["reminder"] }).catch(() => {});
      return reply.code(201).send({ data: serializeReminder(reminder) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      if (clientId && isUniqueConstraintError(error)) {
        return sendError(reply, 409, "CONFLICT", "Reminder id is already in use");
      }
      request.log.error(error, "Failed to create reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create reminder");
    }
  });

  // PUT /api/reminders/:id
  app.put("/api/reminders/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };
    const bodyResult = updateReminderBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    const projectResolution = await resolveProjectSelection(
      bodyResult.data,
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

    try {
      if (bodyResult.data.baseUpdatedAt !== undefined) {
        const existing = await reminderStore.getById(id, authUserId);
        if (!existing) {
          return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
        }
        if (hasConcurrentChange(existing, bodyResult.data.baseUpdatedAt)) {
          return reply
            .code(409)
            .send(conflictPayload("Reminder was modified since this change was made", serializeReminder(existing)));
        }
      }

      const updateInput: {
        title?: string;
        description?: string | null;
        project?: string | null;
        subProject?: string | null;
        projectId?: string | null;
        assignees?: string | null;
        remindAt?: Date;
      } = {};
      if (bodyResult.data.title !== undefined) updateInput.title = bodyResult.data.title;
      if (bodyResult.data.description !== undefined) updateInput.description = bodyResult.data.description;
      Object.assign(updateInput, projectResolution.fields);
      if (bodyResult.data.assignees !== undefined) updateInput.assignees = bodyResult.data.assignees;
      if (bodyResult.data.remindAt !== undefined) updateInput.remindAt = new Date(bodyResult.data.remindAt);

      const updated = await reminderStore.update(id, updateInput, authUserId);
      if (!updated) {
        return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
      }
      assistantSearchSyncService?.syncUserWorkspace(authUserId, { onlySourceTypes: ["reminder"] }).catch(() => {});
      return reply.send({ data: serializeReminder(updated) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to update reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to update reminder");
    }
  });

  // DELETE /api/reminders/:id
  app.delete("/api/reminders/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };

    try {
      const removed = await reminderStore.remove(id, authUserId);
      if (!removed) {
        return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
      }
      assistantSearchSyncService?.syncUserWorkspace(authUserId, { onlySourceTypes: ["reminder"] }).catch(() => {});
      return reply.send({ data: serializeReminder(removed) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to delete reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete reminder");
    }
  });

  // POST /api/reminders/:id/complete
  app.post("/api/reminders/:id/complete", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };

    try {
      const completed = await reminderStore.complete(id, authUserId);
      if (!completed) {
        return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
      }
      return reply.send({ data: serializeReminder(completed) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to complete reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to complete reminder");
    }
  });

  // POST /api/reminders/:id/cancel
  app.post("/api/reminders/:id/cancel", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };

    try {
      const cancelled = await reminderStore.cancel(id, authUserId);
      if (!cancelled) {
        return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
      }
      return reply.send({ data: serializeReminder(cancelled) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to cancel reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to cancel reminder");
    }
  });

  // POST /api/reminders/:id/dismiss
  app.post("/api/reminders/:id/dismiss", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };

    try {
      const completed = await reminderStore.complete(id, authUserId);
      if (!completed) {
        return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
      }
      return reply.send({ data: serializeReminder(completed) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to dismiss reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to dismiss reminder");
    }
  });
}
