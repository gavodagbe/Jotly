import { FastifyPluginAsync } from "fastify";
import { AuthService } from "../auth/auth-service";
import { AssistantSearchSyncService } from "../assistant/assistant-search-sync";
import { CalendarEventStore } from "../google-calendar/calendar-event-store";
import { NoteAttachmentStore } from "../notes/note-attachment-store";
import { NoteStore } from "../notes/note-store";
import { getBearerToken, sendError } from "./route-helpers";
import { registerNoteReadRoutes } from "./note-read-routes";
import { registerNoteWriteRoutes } from "./note-write-routes";
import { registerNoteAttachmentRoutes } from "./note-attachment-routes";

export type NoteRoutesOptions = {
  authService: AuthService;
  noteStore: NoteStore;
  noteAttachmentStore?: NoteAttachmentStore;
  calendarEventStore?: CalendarEventStore;
  assistantSearchSyncService?: AssistantSearchSyncService;
};

const noteRoutes: FastifyPluginAsync<NoteRoutesOptions> = async (app, options) => {
  const { authService } = options;

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

  registerNoteReadRoutes(app, options);
  registerNoteWriteRoutes(app, options);
  registerNoteAttachmentRoutes(app, options);
};

export default noteRoutes;
