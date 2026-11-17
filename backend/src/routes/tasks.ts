import { FastifyPluginAsync } from "fastify";
import { AuthService } from "../auth/auth-service";
import { CalendarEventStore } from "../google-calendar/calendar-event-store";
import { RecurrenceStore } from "../recurrence/recurrence-store";
import { CommentStore } from "../comments/comment-store";
import { getBearerToken, sendError } from "./route-helpers";
import { TaskStore } from "../tasks/task-store";
import { TaskTimeEntryStore } from "../tasks/task-time-entry-store";
import { AssistantSearchSyncService } from "../assistant/assistant-search-sync";
import { ProjectStore } from "../projects/project-store";
import { registerTaskMaintenanceRoutes } from "./task-maintenance-routes";
import { registerTaskReadRoutes } from "./task-read-routes";
import { registerTaskTimeEntryRoutes } from "./task-time-entry-routes";
import { registerTaskWriteRoutes } from "./task-write-routes";

export type TasksRouteOptions = {
  taskStore: TaskStore;
  taskTimeEntryStore?: TaskTimeEntryStore;
  authService: AuthService;
  recurrenceStore?: RecurrenceStore;
  calendarEventStore?: CalendarEventStore;
  assistantSearchSyncService?: AssistantSearchSyncService;
  projectStore?: ProjectStore;
  commentStore?: CommentStore;
};

const tasksRoutes: FastifyPluginAsync<TasksRouteOptions> = async (app, options) => {
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

  registerTaskReadRoutes(app, options);
  registerTaskTimeEntryRoutes(app, options);
  registerTaskWriteRoutes(app, options);
  registerTaskMaintenanceRoutes(app, options);
};

export default tasksRoutes;
