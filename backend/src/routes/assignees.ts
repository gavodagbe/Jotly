import { FastifyPluginAsync } from "fastify";
import { AuthService } from "../auth/auth-service";
import { TaskStore } from "../tasks/task-store";
import { ReminderStore } from "../reminders/reminder-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
} from "./route-helpers";

type AssigneesRouteOptions = {
  authService: AuthService;
  taskStore: TaskStore;
  reminderStore: ReminderStore;
};

function extractUniqueAssignees(values: (string | null)[]): string[] {
  const set = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const name of value.split(",")) {
      const trimmed = name.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

const assigneesRoutes: FastifyPluginAsync<AssigneesRouteOptions> = async (app, options) => {
  const { authService, taskStore, reminderStore } = options;

  app.addHook("preHandler", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    if (!token) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    const authContext = await authService.authenticateBearerToken(token);
    if (!authContext) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    (request as { authUserId?: string }).authUserId = authContext.user.id;
  });

  app.get("/api/assignees", async (request, reply) => {
    const authUserId = (request as { authUserId?: string }).authUserId;
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    try {
      const [tasks, reminders] = await Promise.all([
        taskStore.listByUser(authUserId),
        reminderStore.listByUser(authUserId),
      ]);

      const assignees = extractUniqueAssignees([
        ...tasks.map((t) => t.assignees),
        ...reminders.map((r) => r.assignees),
      ]);

      return reply.send({ data: assignees });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Assignees");
      }
      throw error;
    }
  });
};

export default assigneesRoutes;
