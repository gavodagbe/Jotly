import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { AssistantSearchSyncService } from "../assistant/assistant-search-sync";
import { CalendarEventStore } from "../google-calendar/calendar-event-store";
import { NoteAttachmentStore } from "../notes/note-attachment-store";
import { NoteStore } from "../notes/note-store";
import { parseDateOnly } from "../tasks/task-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type NoteRoutesOptions = {
  authService: AuthService;
  noteStore: NoteStore;
  noteAttachmentStore?: NoteAttachmentStore;
  calendarEventStore?: CalendarEventStore;
  assistantSearchSyncService?: AssistantSearchSyncService;
};

const NOTE_BODY_MAX = 50000;
const NOTE_TITLE_MAX = 300;
const NOTE_COLOR_MAX = 50;
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_URL_LENGTH = 7_100_000;

const dateQuerySchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, {
    message: "date must be a valid date in YYYY-MM-DD format",
  });

const createNoteBodySchema = z.object({
  title: z.string().max(NOTE_TITLE_MAX, "Title is too long").optional().nullable(),
  body: z.string().min(1, "Body is required").max(NOTE_BODY_MAX, "Body is too long"),
  color: z.string().max(NOTE_COLOR_MAX, "Color value is too long").optional().nullable(),
  targetDate: z
    .string()
    .refine((value) => parseDateOnly(value) !== null, {
      message: "targetDate must be a valid date in YYYY-MM-DD format",
    })
    .optional()
    .nullable(),
  calendarEventId: z.string().trim().min(1, "calendarEventId must not be empty").optional().nullable(),
});

const updateNoteBodySchema = z.object({
  title: z.string().max(NOTE_TITLE_MAX, "Title is too long").optional().nullable(),
  body: z.string().min(1, "Body is required").max(NOTE_BODY_MAX, "Body is too long").optional(),
  color: z.string().max(NOTE_COLOR_MAX, "Color value is too long").optional().nullable(),
  targetDate: z
    .string()
    .refine((value) => parseDateOnly(value) !== null, {
      message: "targetDate must be a valid date in YYYY-MM-DD format",
    })
    .optional()
    .nullable(),
  calendarEventId: z.string().trim().min(1, "calendarEventId must not be empty").optional().nullable(),
});

function isUniqueConstraintPrismaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    typeof error === "object" && error !== null
  ) && (error as { code?: unknown }).code === "P2002";
}

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
}

const createAttachmentBodySchema = z.object({
  name: z.string().trim().min(1, "Attachment name is required").max(200, "Attachment name is too long"),
  url: z
    .string()
    .trim()
    .min(1, "Attachment URL must be valid")
    .max(MAX_ATTACHMENT_URL_LENGTH, "Attachment payload is too large")
    .url("Attachment URL must be valid"),
  contentType: z.string().trim().max(255, "contentType is too long").optional().nullable(),
  sizeBytes: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_ATTACHMENT_SIZE_BYTES, "Attachment exceeds 5 MB limit")
    .optional()
    .nullable(),
});

function serializeAttachment(a: {
  id: string;
  noteId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    noteId: a.noteId,
    name: a.name,
    url: a.url,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt.toISOString(),
  };
}

function serializeNote(note: {
  id: string;
  calendarEventId: string | null;
  title: string | null;
  body: string;
  color: string | null;
  targetDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  calendarEvent?: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    htmlLink: string | null;
  } | null;
}) {
  return {
    id: note.id,
    calendarEventId: note.calendarEventId,
    title: note.title,
    body: note.body,
    color: note.color,
    targetDate: note.targetDate
      ? note.targetDate.toISOString().substring(0, 10)
      : null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    linkedCalendarEvent: note.calendarEvent
      ? {
          id: note.calendarEvent.id,
          title: note.calendarEvent.title,
          startTime: note.calendarEvent.startTime.toISOString(),
          endTime: note.calendarEvent.endTime.toISOString(),
          htmlLink: note.calendarEvent.htmlLink,
        }
      : null,
  };
}

const noteRoutes: FastifyPluginAsync<NoteRoutesOptions> = async (app, options) => {
  const {
    authService,
    noteStore,
    noteAttachmentStore,
    calendarEventStore,
    assistantSearchSyncService,
  } = options;

  app.addHook("preHandler", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    if (!token) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
    const authContext = await authService.authenticateBearerToken(token);
    if (!authContext) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
    (request as { authUserId?: string }).authUserId = authContext.user.id;
  });

  // GET /api/notes?date=YYYY-MM-DD
  app.get("/api/notes", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const query = request.query as { date?: string };

    try {
      let filters: { targetDate?: Date } | undefined;
      if (query.date) {
        const parseResult = dateQuerySchema.safeParse(query.date);
        if (!parseResult.success) {
          const details = zodIssuesToStrings(parseResult.error);
          return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid date", details);
        }
        const targetDate = parseDateOnly(query.date);
        if (!targetDate) {
          return sendError(reply, 400, "VALIDATION_ERROR", "date must be a valid date in YYYY-MM-DD format");
        }
        filters = { targetDate };
      }

      const notes = await noteStore.listByUser(authUserId, filters);
      return reply.send({ data: notes.map(serializeNote) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Note");
      }
      request.log.error(error, "Failed to list notes");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list notes");
    }
  });

  // GET /api/notes/:id
  app.get("/api/notes/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };

    try {
      const note = await noteStore.getById(id, authUserId);
      if (!note) {
        return sendError(reply, 404, "NOT_FOUND", "Note not found");
      }
      return reply.send({ data: serializeNote(note) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Note");
      }
      request.log.error(error, "Failed to get note");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to get note");
    }
  });

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

    try {
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
        assistantSearchSyncService.syncUserWorkspace(authUserId).catch(() => {});
      }
      return reply.code(201).send({ data: serializeNote(note) });
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
        assistantSearchSyncService.syncUserWorkspace(authUserId).catch(() => {});
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
        assistantSearchSyncService.syncUserWorkspace(authUserId).catch(() => {});
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
        assistantSearchSyncService.syncUserWorkspace(authUserId).catch(() => {});
      }
      return reply.send({ data: serializeAttachment(removed) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "NoteAttachment");
      request.log.error(error, "Failed to delete note attachment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete attachment");
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
        assistantSearchSyncService.syncUserWorkspace(authUserId).catch(() => {});
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
};

export default noteRoutes;
