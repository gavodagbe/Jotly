import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { ReminderAttachmentStore } from "../reminders/reminder-attachment-store";
import { ReminderStore } from "../reminders/reminder-store";
import { parseDateOnly } from "../tasks/task-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_URL_LENGTH = 7_100_000;

type ReminderRoutesOptions = {
  authService: AuthService;
  reminderStore: ReminderStore;
  reminderAttachmentStore?: ReminderAttachmentStore;
};

const dateQuerySchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, {
    message: "date must be a valid date in YYYY-MM-DD format",
  });

const createReminderBodySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().max(2000, "Description is too long").optional().nullable(),
  project: z.string().max(200, "Project is too long").optional().nullable(),
  assignees: z.string().max(500, "Assignees is too long").optional().nullable(),
  remindAt: z.string().refine(
    (value) => !isNaN(Date.parse(value)),
    { message: "remindAt must be a valid ISO 8601 date-time" }
  ),
});

const updateReminderBodySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long").optional(),
  description: z.string().max(2000, "Description is too long").optional().nullable(),
  project: z.string().max(200, "Project is too long").optional().nullable(),
  assignees: z.string().max(500, "Assignees is too long").optional().nullable(),
  remindAt: z
    .string()
    .refine((value) => !isNaN(Date.parse(value)), {
      message: "remindAt must be a valid ISO 8601 date-time",
    })
    .optional(),
});

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
}

function serializeReminder(reminder: {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
  assignees: string | null;
  remindAt: Date;
  status: string;
  isFired: boolean;
  firedAt: Date | null;
  isDismissed: boolean;
  dismissedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: reminder.id,
    title: reminder.title,
    description: reminder.description,
    project: reminder.project,
    assignees: reminder.assignees,
    remindAt: reminder.remindAt.toISOString(),
    status: reminder.status,
    isFired: reminder.isFired,
    firedAt: reminder.firedAt?.toISOString() ?? null,
    isDismissed: reminder.isDismissed,
    dismissedAt: reminder.dismissedAt?.toISOString() ?? null,
    completedAt: reminder.completedAt?.toISOString() ?? null,
    cancelledAt: reminder.cancelledAt?.toISOString() ?? null,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
  };
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
  reminderId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    reminderId: a.reminderId,
    name: a.name,
    url: a.url,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt.toISOString(),
  };
}

const reminderRoutes: FastifyPluginAsync<ReminderRoutesOptions> = async (app, options) => {
  const { authService, reminderStore, reminderAttachmentStore } = options;

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

  // POST /api/reminders
  app.post("/api/reminders", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = createReminderBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const reminder = await reminderStore.create({
        userId: authUserId,
        title: bodyResult.data.title,
        description: bodyResult.data.description ?? null,
        project: bodyResult.data.project ?? null,
        assignees: bodyResult.data.assignees ?? null,
        remindAt: new Date(bodyResult.data.remindAt),
      });
      return reply.code(201).send({ data: serializeReminder(reminder) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to create reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create reminder");
    }
  });

  // PUT /api/reminders/:id
  app.put("/api/reminders/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };
    const bodyResult = updateReminderBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const updateInput: { title?: string; description?: string | null; project?: string | null; assignees?: string | null; remindAt?: Date } = {};
      if (bodyResult.data.title !== undefined) updateInput.title = bodyResult.data.title;
      if (bodyResult.data.description !== undefined) updateInput.description = bodyResult.data.description;
      if (bodyResult.data.project !== undefined) updateInput.project = bodyResult.data.project;
      if (bodyResult.data.assignees !== undefined) updateInput.assignees = bodyResult.data.assignees;
      if (bodyResult.data.remindAt !== undefined) updateInput.remindAt = new Date(bodyResult.data.remindAt);

      const updated = await reminderStore.update(id, updateInput, authUserId);
      if (!updated) {
        return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
      }
      return reply.send({ data: serializeReminder(updated) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to update reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to update reminder");
    }
  });

  // DELETE /api/reminders/:id
  app.delete("/api/reminders/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };

    try {
      const removed = await reminderStore.remove(id, authUserId);
      if (!removed) {
        return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
      }
      return reply.send({ data: serializeReminder(removed) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to delete reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete reminder");
    }
  });

  // POST /api/reminders/:id/complete
  app.post("/api/reminders/:id/complete", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };

    try {
      const completed = await reminderStore.complete(id, authUserId);
      if (!completed) {
        return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
      }
      return reply.send({ data: serializeReminder(completed) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to complete reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to complete reminder");
    }
  });

  // POST /api/reminders/:id/cancel
  app.post("/api/reminders/:id/cancel", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };

    try {
      const cancelled = await reminderStore.cancel(id, authUserId);
      if (!cancelled) {
        return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
      }
      return reply.send({ data: serializeReminder(cancelled) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to cancel reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to cancel reminder");
    }
  });

  // POST /api/reminders/:id/dismiss
  app.post("/api/reminders/:id/dismiss", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { id } = request.params as { id: string };

    try {
      const completed = await reminderStore.complete(id, authUserId);
      if (!completed) {
        return sendError(reply, 404, "NOT_FOUND", "Reminder not found");
      }
      return reply.send({ data: serializeReminder(completed) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Reminder");
      }
      request.log.error(error, "Failed to dismiss reminder");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to dismiss reminder");
    }
  });
  // GET /api/reminders/:id/attachments
  app.get("/api/reminders/:id/attachments", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    if (!reminderAttachmentStore) return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Attachments are not available");

    const { id } = request.params as { id: string };

    try {
      const reminder = await reminderStore.getById(id, authUserId);
      if (!reminder) return sendError(reply, 404, "NOT_FOUND", "Reminder not found");

      const attachments = await reminderAttachmentStore.listByReminderId(id, authUserId);
      return reply.send({ data: attachments.map(serializeAttachment) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "ReminderAttachment");
      request.log.error(error, "Failed to list reminder attachments");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list attachments");
    }
  });

  // POST /api/reminders/:id/attachments
  app.post("/api/reminders/:id/attachments", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    if (!reminderAttachmentStore) return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Attachments are not available");

    const { id } = request.params as { id: string };
    const bodyResult = createAttachmentBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const reminder = await reminderStore.getById(id, authUserId);
      if (!reminder) return sendError(reply, 404, "NOT_FOUND", "Reminder not found");

      const attachment = await reminderAttachmentStore.create({
        reminderId: id,
        userId: authUserId,
        name: bodyResult.data.name,
        url: bodyResult.data.url,
        contentType: bodyResult.data.contentType?.trim() || null,
        sizeBytes: bodyResult.data.sizeBytes ?? null,
      });
      return reply.code(201).send({ data: serializeAttachment(attachment) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "ReminderAttachment");
      request.log.error(error, "Failed to create reminder attachment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create attachment");
    }
  });

  // DELETE /api/reminders/:id/attachments/:attachmentId
  app.delete("/api/reminders/:id/attachments/:attachmentId", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    if (!reminderAttachmentStore) return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Attachments are not available");

    const { id, attachmentId } = request.params as { id: string; attachmentId: string };

    try {
      const reminder = await reminderStore.getById(id, authUserId);
      if (!reminder) return sendError(reply, 404, "NOT_FOUND", "Reminder not found");

      const removed = await reminderAttachmentStore.remove(attachmentId, authUserId);
      if (!removed) return sendError(reply, 404, "NOT_FOUND", "Attachment not found");

      return reply.send({ data: serializeAttachment(removed) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "ReminderAttachment");
      request.log.error(error, "Failed to delete reminder attachment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete attachment");
    }
  });
};

export default reminderRoutes;
