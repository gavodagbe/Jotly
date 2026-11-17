import { FastifyPluginAsync } from "fastify";
import { AuthService } from "../auth/auth-service";
import { ReminderAttachmentStore } from "../reminders/reminder-attachment-store";
import { ReminderStore } from "../reminders/reminder-store";
import { ProjectStore } from "../projects/project-store";
import { getBearerToken, sendError } from "./route-helpers";
import { AssistantSearchSyncService } from "../assistant/assistant-search-sync";
import { registerReminderReadRoutes } from "./reminder-read-routes";
import { registerReminderWriteRoutes } from "./reminder-write-routes";
import { registerReminderAttachmentRoutes } from "./reminder-attachment-routes";

export type ReminderRoutesOptions = {
  authService: AuthService;
  reminderStore: ReminderStore;
  reminderAttachmentStore?: ReminderAttachmentStore;
  assistantSearchSyncService?: AssistantSearchSyncService;
  projectStore?: ProjectStore;
};

const reminderRoutes: FastifyPluginAsync<ReminderRoutesOptions> = async (app, options) => {
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

  registerReminderReadRoutes(app, options);
  registerReminderWriteRoutes(app, options);
  registerReminderAttachmentRoutes(app, options);
};

export default reminderRoutes;
