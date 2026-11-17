import type { FastifyInstance } from "fastify";
import { isStorageNotInitializedPrismaError, sendError, sendStorageNotInitializedError, zodIssuesToStrings } from "./route-helpers";
import type { ReminderRoutesOptions } from "./reminders";
import {
  getAuthenticatedUserId,
  createAttachmentBodySchema,
  serializeAttachment,
} from "../reminders/reminder-route-helpers";

export function registerReminderAttachmentRoutes(app: FastifyInstance, options: ReminderRoutesOptions): void {
  const { reminderStore, reminderAttachmentStore } = options;

  // GET /api/reminders/:id/attachments
  app.get("/api/reminders/:id/attachments", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    if (!reminderAttachmentStore) return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Attachments are not available");

    const { id } = request.params as { id: string };

    try {
      const reminder = await reminderStore.getById(id, authUserId);
      if (!reminder) return sendError(reply, 404, "NOT_FOUND", "Reminder not found");

      const attachments = await reminderAttachmentStore.listByReminderId(id, authUserId);
      return reply.send({ data: attachments.map(serializeAttachment) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "ReminderAttachment");
      request.log.error(error, "Failed to list reminder attachments");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list attachments");
    }
  });

  // POST /api/reminders/:id/attachments
  app.post("/api/reminders/:id/attachments", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    if (!reminderAttachmentStore) return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Attachments are not available");

    const { id } = request.params as { id: string };
    const bodyResult = createAttachmentBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const reminder = await reminderStore.getById(id, authUserId);
      if (!reminder) return sendError(reply, 404, "NOT_FOUND", "Reminder not found");

      const attachment = await reminderAttachmentStore.create({
        reminderId: id,
        userId: authUserId,
        name: bodyResult.data.name,
        url: bodyResult.data.url,
        contentType: bodyResult.data.contentType?.trim() || null,
        sizeBytes: bodyResult.data.sizeBytes ?? null,
      });
      return reply.code(201).send({ data: serializeAttachment(attachment) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "ReminderAttachment");
      request.log.error(error, "Failed to create reminder attachment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create attachment");
    }
  });

  // DELETE /api/reminders/:id/attachments/:attachmentId
  app.delete("/api/reminders/:id/attachments/:attachmentId", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    if (!reminderAttachmentStore) return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Attachments are not available");

    const { id, attachmentId } = request.params as { id: string; attachmentId: string };

    try {
      const reminder = await reminderStore.getById(id, authUserId);
      if (!reminder) return sendError(reply, 404, "NOT_FOUND", "Reminder not found");

      const removed = await reminderAttachmentStore.remove(attachmentId, authUserId);
      if (!removed) return sendError(reply, 404, "NOT_FOUND", "Attachment not found");

      return reply.send({ data: serializeAttachment(removed) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "ReminderAttachment");
      request.log.error(error, "Failed to delete reminder attachment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete attachment");
    }
  });
}
