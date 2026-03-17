import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
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
};

const NOTE_BODY_MAX = 50000;
const NOTE_TITLE_MAX = 300;
const NOTE_COLOR_MAX = 50;

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
});

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
}

function serializeNote(note: {
  id: string;
  title: string | null;
  body: string;
  color: string | null;
  targetDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    color: note.color,
    targetDate: note.targetDate
      ? note.targetDate.toISOString().substring(0, 10)
      : null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

const noteRoutes: FastifyPluginAsync<NoteRoutesOptions> = async (app, options) => {
  const { authService, noteStore } = options;

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
      const note = await noteStore.create({
        userId: authUserId,
        title: bodyResult.data.title ?? null,
        body: bodyResult.data.body,
        color: bodyResult.data.color ?? null,
        targetDate: bodyResult.data.targetDate
          ? parseDateOnly(bodyResult.data.targetDate)
          : null,
      });
      return reply.code(201).send({ data: serializeNote(note) });
    } catch (error) {
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
      } = {};
      if (bodyResult.data.title !== undefined) updateInput.title = bodyResult.data.title;
      if (bodyResult.data.body !== undefined) updateInput.body = bodyResult.data.body;
      if (bodyResult.data.color !== undefined) updateInput.color = bodyResult.data.color;
      if (bodyResult.data.targetDate !== undefined) {
        updateInput.targetDate = bodyResult.data.targetDate
          ? parseDateOnly(bodyResult.data.targetDate)
          : null;
      }

      const updated = await noteStore.update(id, updateInput, authUserId);
      if (!updated) {
        return sendError(reply, 404, "NOT_FOUND", "Note not found");
      }
      return reply.send({ data: serializeNote(updated) });
    } catch (error) {
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
