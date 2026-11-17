import type { FastifyInstance } from "fastify";
import { parseDateOnly } from "../tasks/task-store";
import { isStorageNotInitializedPrismaError, sendError, sendStorageNotInitializedError, zodIssuesToStrings } from "./route-helpers";
import type { NoteRoutesOptions } from "./notes";
import { conflictPayload, hasConcurrentChange } from "./offline-sync-helpers";
import {
  createNoteBodySchema,
  updateNoteBodySchema,
  isUniqueConstraintPrismaError,
  getAuthenticatedUserId,
  serializeNote,
} from "../notes/note-route-helpers";

export function registerNoteWriteRoutes(app: FastifyInstance, options: NoteRoutesOptions): void {
  const { noteStore, calendarEventStore, assistantSearchSyncService } = options;

  // POST /api/notes
  app.post("/api/notes", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = createNoteBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    const clientId = bodyResult.data.id;

    try {
      if (clientId) {
        // Offline replay of a create that already reached the server.
        const alreadyCreated = await noteStore.getById(clientId, authUserId);
        if (alreadyCreated) {
          return reply.code(200).send({ data: serializeNote(alreadyCreated) });
        }
      }

      const calendarEventId = bodyResult.data.calendarEventId ?? null;
      if (calendarEventId) {
        if (!calendarEventStore) {
          return sendError(reply, 500, "INTERNAL_ERROR", "Calendar event storage is unavailable");
        }

        const event = await calendarEventStore.getById(calendarEventId, authUserId);
        if (!event) {
          return sendError(reply, 400, "VALIDATION_ERROR", "Linked calendar event not found");
        }
      }

      const note = await noteStore.create({
        ...(clientId ? { id: clientId } : {}),
        userId: authUserId,
        title: bodyResult.data.title ?? null,
        body: bodyResult.data.body,
        color: bodyResult.data.color ?? null,
        targetDate: bodyResult.data.targetDate
          ? parseDateOnly(bodyResult.data.targetDate)
          : null,
        calendarEventId,
      });
      // Fire-and-forget sync (do not await)
      if (assistantSearchSyncService) {
        assistantSearchSyncService.syncUserWorkspace(authUserId, { onlySourceTypes: ["note", "noteAttachment"] }).catch(() => {});
      }
      return reply.code(201).send({ data: serializeNote(note) });
    } catch (error) {
      if (isUniqueConstraintPrismaError(error) && clientId && !bodyResult.data.calendarEventId) {
        return sendError(reply, 409, "CONFLICT", "Note id is already in use");
      }
      if (isUniqueConstraintPrismaError(error)) {
        return sendError(
          reply,
          409,
          "CONFLICT",
          "This calendar event is already linked to another note"
        );
      }
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Note");
      }
      request.log.error(error, "Failed to create note");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create note");
    }
  });

  // PATCH /api/notes/:id
  app.patch("/api/notes/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };
    const bodyResult = updateNoteBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      if (bodyResult.data.baseUpdatedAt !== undefined) {
        const existing = await noteStore.getById(id, authUserId);
        if (!existing) {
          return sendError(reply, 404, "NOT_FOUND", "Note not found");
        }
        if (hasConcurrentChange(existing, bodyResult.data.baseUpdatedAt)) {
          return reply
            .code(409)
            .send(conflictPayload("Note was modified since this change was made", serializeNote(existing)));
        }
      }

      const updateInput: {
        title?: string | null;
        body?: string;
        color?: string | null;
        targetDate?: Date | null;
        calendarEventId?: string | null;
      } = {};
      if (bodyResult.data.title !== undefined) updateInput.title = bodyResult.data.title;
      if (bodyResult.data.body !== undefined) updateInput.body = bodyResult.data.body;
      if (bodyResult.data.color !== undefined) updateInput.color = bodyResult.data.color;
      if (bodyResult.data.targetDate !== undefined) {
        updateInput.targetDate = bodyResult.data.targetDate
          ? parseDateOnly(bodyResult.data.targetDate)
          : null;
      }
      if (bodyResult.data.calendarEventId !== undefined) {
        const calendarEventId = bodyResult.data.calendarEventId ?? null;
        if (calendarEventId) {
          if (!calendarEventStore) {
            return sendError(reply, 500, "INTERNAL_ERROR", "Calendar event storage is unavailable");
          }

          const event = await calendarEventStore.getById(calendarEventId, authUserId);
          if (!event) {
            return sendError(reply, 400, "VALIDATION_ERROR", "Linked calendar event not found");
          }
        }

        updateInput.calendarEventId = calendarEventId;
      }

      const updated = await noteStore.update(id, updateInput, authUserId);
      if (!updated) {
        return sendError(reply, 404, "NOT_FOUND", "Note not found");
      }
      // Fire-and-forget sync (do not await)
      if (assistantSearchSyncService) {
        assistantSearchSyncService.syncUserWorkspace(authUserId, { onlySourceTypes: ["note", "noteAttachment"] }).catch(() => {});
      }
      return reply.send({ data: serializeNote(updated) });
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        return sendError(
          reply,
          409,
          "CONFLICT",
          "This calendar event is already linked to another note"
        );
      }
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Note");
      }
      request.log.error(error, "Failed to update note");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to update note");
    }
  });

  // DELETE /api/notes/:id
  app.delete("/api/notes/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };

    try {
      const removed = await noteStore.remove(id, authUserId);
      if (!removed) {
        return sendError(reply, 404, "NOT_FOUND", "Note not found");
      }
      // Fire-and-forget sync (do not await)
      if (assistantSearchSyncService) {
        assistantSearchSyncService.syncUserWorkspace(authUserId, { onlySourceTypes: ["note", "noteAttachment"] }).catch(() => {});
      }
      return reply.send({ data: serializeNote(removed) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Note");
      }
      request.log.error(error, "Failed to delete note");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete note");
    }
  });
}
