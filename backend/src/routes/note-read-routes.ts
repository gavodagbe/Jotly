import type { FastifyInstance } from "fastify";
import { parseDateOnly } from "../tasks/task-store";
import { isStorageNotInitializedPrismaError, sendError, sendStorageNotInitializedError, zodIssuesToStrings } from "./route-helpers";
import type { NoteRoutesOptions } from "./notes";
import {
  dateQuerySchema,
  getAuthenticatedUserId,
  serializeNote,
} from "../notes/note-route-helpers";

export function registerNoteReadRoutes(app: FastifyInstance, options: NoteRoutesOptions): void {
  const { noteStore } = options;

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
}
