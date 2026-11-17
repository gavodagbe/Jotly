import type { FastifyInstance } from "fastify";
import { parseDateOnly } from "../tasks/task-store";
import { isStorageNotInitializedPrismaError, sendError, sendStorageNotInitializedError, zodIssuesToStrings } from "./route-helpers";
import type { ReminderRoutesOptions } from "./reminders";
import {
  dateQuerySchema,
  getAuthenticatedUserId,
  serializeReminder,
} from "../reminders/reminder-route-helpers";

export function registerReminderReadRoutes(app: FastifyInstance, options: ReminderRoutesOptions): void {
  const { reminderStore } = options;

  // GET /api/reminders?date=YYYY-MM-DD
  app.get("/api/reminders", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const query = request.query as { date?: string };

    try {
      let filters:
        | { dateFrom?: Date; dateTo?: Date; activeBefore?: Date; statuses?: Array<"pending" | "fired" | "completed" | "cancelled"> }
        | undefined;
      if (query.date) {
        const parseResult = dateQuerySchema.safeParse(query.date);
        if (!parseResult.success) {
          const details = zodIssuesToStrings(parseResult.error);
          return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid date", details);
        }
        const dateFrom = parseDateOnly(query.date);
        if (!dateFrom) {
          return sendError(reply, 400, "VALIDATION_ERROR", "date must be a valid date in YYYY-MM-DD format");
        }
        const dateTo = new Date(dateFrom);
        dateTo.setUTCDate(dateTo.getUTCDate() + 1);
        filters = { activeBefore: dateTo, statuses: ["pending", "fired"] };
      }

      const reminders = await reminderStore.listByUser(authUserId, filters);
      return reply.send({ data: reminders.map(serializeReminder) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to list reminders");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list reminders");
    }
  });

  // GET /api/reminders/pending
  app.get("/api/reminders/pending", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    try {
      const pending = await reminderStore.listPending(authUserId);

      // Auto-mark as fired
      const results = await Promise.all(
        pending.map(async (r) => {
          const fired = await reminderStore.markFired(r.id, authUserId);
          return fired ?? r;
        })
      );

      return reply.send({ data: results.map(serializeReminder) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to list pending reminders");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list pending reminders");
    }
  });

  // GET /api/reminders/:id
  app.get("/api/reminders/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };

    try {
      const reminder = await reminderStore.getById(id, authUserId);
      if (!reminder) {
        return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
      }
      return reply.send({ data: serializeReminder(reminder) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to get reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to get reminder");
    }
  });
}
