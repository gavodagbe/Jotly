import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AttachmentStore } from "../attachments/attachment-store";
import { AuthService } from "../auth/auth-service";
import { TaskStore } from "../tasks/task-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type AttachmentsRouteOptions = {
  taskStore: TaskStore;
  attachmentStore: AttachmentStore;
  authService: AuthService;
};

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_URL_LENGTH = 7_100_000;

const taskParamsSchema = z.object({
  id: z.string().trim().min(1, "Task id is required"),
});

const attachmentParamsSchema = z.object({
  id: z.string().trim().min(1, "Task id is required"),
  attachmentId: z.string().trim().min(1, "Attachment id is required"),
});

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

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function serializeAttachment(attachment: Awaited<ReturnType<AttachmentStore["create"]>>) {
  return {
    id: attachment.id,
    taskId: attachment.taskId,
    name: attachment.name,
    url: attachment.url,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt.toISOString(),
  };
}

function isStorageMissingError(error: unknown): boolean {
  return isStorageNotInitializedPrismaError(error);
}

async function ensureTaskExists(taskStore: TaskStore, taskId: string, userId: string): Promise<boolean> {
  const task = await taskStore.getById(taskId, userId);
  return task !== null;
}

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }

  return request.authUserId;
}

const attachmentsRoutes: FastifyPluginAsync<AttachmentsRouteOptions> = async (app, options) => {
  const { taskStore, attachmentStore, authService } = options;

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

  app.get("/api/tasks/:id/attachments", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = taskParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request params", details);
    }

    try {
      const taskExists = await ensureTaskExists(taskStore, paramsResult.data.id, authUserId);

      if (!taskExists) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      const attachments = await attachmentStore.listByTaskId(paramsResult.data.id);

      return reply.send({
        data: attachments.map(serializeAttachment),
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Attachments table is missing");
        return sendStorageNotInitializedError(reply, "Attachment");
      }

      request.log.error(error, "Failed to list attachments");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load attachments");
    }
  });

  app.post("/api/tasks/:id/attachments", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = taskParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request params", details);
    }

    const bodyResult = createAttachmentBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const taskExists = await ensureTaskExists(taskStore, paramsResult.data.id, authUserId);

      if (!taskExists) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      const attachment = await attachmentStore.create({
        taskId: paramsResult.data.id,
        name: bodyResult.data.name,
        url: bodyResult.data.url,
        contentType: normalizeNullableText(bodyResult.data.contentType),
        sizeBytes: bodyResult.data.sizeBytes ?? null,
      });

      return reply.code(201).send({
        data: serializeAttachment(attachment),
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Attachments table is missing");
        return sendStorageNotInitializedError(reply, "Attachment");
      }

      request.log.error(error, "Failed to create attachment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create attachment");
    }
  });

  app.delete("/api/tasks/:id/attachments/:attachmentId", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = attachmentParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request params", details);
    }

    try {
      const taskExists = await ensureTaskExists(taskStore, paramsResult.data.id, authUserId);

      if (!taskExists) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      const existingAttachment = await attachmentStore.getById(paramsResult.data.attachmentId);

      if (!existingAttachment || existingAttachment.taskId !== paramsResult.data.id) {
        return sendError(reply, 404, "NOT_FOUND", "Attachment not found");
      }

      const deletedAttachment = await attachmentStore.remove(existingAttachment.id);

      if (!deletedAttachment) {
        return sendError(reply, 404, "NOT_FOUND", "Attachment not found");
      }

      return reply.send({
        data: serializeAttachment(deletedAttachment),
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Attachments table is missing");
        return sendStorageNotInitializedError(reply, "Attachment");
      }

      request.log.error(error, "Failed to delete attachment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete attachment");
    }
  });
};

export default attachmentsRoutes;
