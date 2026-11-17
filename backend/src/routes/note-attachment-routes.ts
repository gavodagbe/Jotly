import type { FastifyInstance } from "fastify";
import { isStorageNotInitializedPrismaError, sendError, sendStorageNotInitializedError, zodIssuesToStrings } from "./route-helpers";
import type { NoteRoutesOptions } from "./notes";
import {
  getAuthenticatedUserId,
  createAttachmentBodySchema,
  serializeAttachment,
} from "../notes/note-route-helpers";

export function registerNoteAttachmentRoutes(app: FastifyInstance, options: NoteRoutesOptions): void {
  const { noteStore, noteAttachmentStore, assistantSearchSyncService } = options;

  // GET /api/notes/:id/attachments
  app.get("/api/notes/:id/attachments", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    if (!noteAttachmentStore) return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Attachments are not available");

    const { id } = request.params as { id: string };

    try {
      const note = await noteStore.getById(id, authUserId);
      if (!note) return sendError(reply, 404, "NOT_FOUND", "Note not found");

      const attachments = await noteAttachmentStore.listByNoteId(id, authUserId);
      return reply.send({ data: attachments.map(serializeAttachment) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "NoteAttachment");
      request.log.error(error, "Failed to list note attachments");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list attachments");
    }
  });

  // POST /api/notes/:id/attachments
  app.post("/api/notes/:id/attachments", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    if (!noteAttachmentStore) return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Attachments are not available");

    const { id } = request.params as { id: string };
    const bodyResult = createAttachmentBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const note = await noteStore.getById(id, authUserId);
      if (!note) return sendError(reply, 404, "NOT_FOUND", "Note not found");

      const attachment = await noteAttachmentStore.create({
        noteId: id,
        userId: authUserId,
        name: bodyResult.data.name,
        url: bodyResult.data.url,
        contentType: bodyResult.data.contentType?.trim() || null,
        sizeBytes: bodyResult.data.sizeBytes ?? null,
      });

      // Fire-and-forget sync (do not await)
      if (assistantSearchSyncService) {
        assistantSearchSyncService.syncUserWorkspace(authUserId, { onlySourceTypes: ["note", "noteAttachment"] }).catch(() => {});
      }
      return reply.code(201).send({ data: serializeAttachment(attachment) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "NoteAttachment");
      request.log.error(error, "Failed to create note attachment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create attachment");
    }
  });

  // DELETE /api/notes/:id/attachments/:attachmentId
  app.delete("/api/notes/:id/attachments/:attachmentId", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    if (!noteAttachmentStore) return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Attachments are not available");

    const { id, attachmentId } = request.params as { id: string; attachmentId: string };

    try {
      const note = await noteStore.getById(id, authUserId);
      if (!note) return sendError(reply, 404, "NOT_FOUND", "Note not found");

      const removed = await noteAttachmentStore.remove(attachmentId, authUserId);
      if (!removed) return sendError(reply, 404, "NOT_FOUND", "Attachment not found");

      // Fire-and-forget sync (do not await)
      if (assistantSearchSyncService) {
        assistantSearchSyncService.syncUserWorkspace(authUserId, { onlySourceTypes: ["note", "noteAttachment"] }).catch(() => {});
      }
      return reply.send({ data: serializeAttachment(removed) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "NoteAttachment");
      request.log.error(error, "Failed to delete note attachment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete attachment");
    }
  });
}
