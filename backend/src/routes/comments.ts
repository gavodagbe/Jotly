import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { CommentStore } from "../comments/comment-store";
import { TaskStore } from "../tasks/task-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";
import { baseUpdatedAtSchema, clientIdSchema, conflictPayload, hasConcurrentChange, isUniqueConstraintError } from "./offline-sync-helpers";

type CommentsRouteOptions = {
  taskStore: TaskStore;
  commentStore: CommentStore;
  authService: AuthService;
};

const taskParamsSchema = z.object({
  id: z.string().trim().min(1, "Task id is required"),
});

const commentParamsSchema = z.object({
  id: z.string().trim().min(1, "Task id is required"),
  commentId: z.string().trim().min(1, "Comment id is required"),
});

const commentBodyField = z.string().trim().min(1, "Comment body is required").max(5000, "Comment body is too long");

const createCommentBodySchema = z.object({
  id: clientIdSchema.optional(),
  body: commentBodyField,
});

const updateCommentBodySchema = z.object({
  body: commentBodyField,
  baseUpdatedAt: baseUpdatedAtSchema.optional(),
});

function serializeComment(comment: Awaited<ReturnType<CommentStore["create"]>>) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
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

const commentsRoutes: FastifyPluginAsync<CommentsRouteOptions> = async (app, options) => {
  const { taskStore, commentStore, authService } = options;

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

  app.get("/api/tasks/:id/comments", async (request, reply) => {
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

      const comments = await commentStore.listByTaskId(paramsResult.data.id);

      return reply.send({
        data: comments.map(serializeComment),
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Comments table is missing");
        return sendStorageNotInitializedError(reply, "Comment");
      }

      request.log.error(error, "Failed to list comments");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load comments");
    }
  });

  app.post("/api/tasks/:id/comments", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = taskParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request params", details);
    }

    const bodyResult = createCommentBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const taskExists = await ensureTaskExists(taskStore, paramsResult.data.id, authUserId);

      if (!taskExists) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      const clientId = bodyResult.data.id;
      if (clientId) {
        // Offline replay of a create that already reached the server.
        const alreadyCreated = await commentStore.getById(clientId);
        if (alreadyCreated) {
          return alreadyCreated.taskId === paramsResult.data.id
            ? reply.code(200).send({ data: serializeComment(alreadyCreated) })
            : sendError(reply, 409, "CONFLICT", "Comment id is already in use");
        }
      }

      const comment = await commentStore.create({
        ...(clientId ? { id: clientId } : {}),
        taskId: paramsResult.data.id,
        body: bodyResult.data.body,
      });

      return reply.code(201).send({
        data: serializeComment(comment),
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Comments table is missing");
        return sendStorageNotInitializedError(reply, "Comment");
      }

      if (bodyResult.data.id && isUniqueConstraintError(error)) {
        return sendError(reply, 409, "CONFLICT", "Comment id is already in use");
      }

      request.log.error(error, "Failed to create comment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create comment");
    }
  });

  app.patch("/api/tasks/:id/comments/:commentId", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = commentParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request params", details);
    }

    const bodyResult = updateCommentBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const taskExists = await ensureTaskExists(taskStore, paramsResult.data.id, authUserId);

      if (!taskExists) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      const existingComment = await commentStore.getById(paramsResult.data.commentId);

      if (!existingComment || existingComment.taskId !== paramsResult.data.id) {
        return sendError(reply, 404, "NOT_FOUND", "Comment not found");
      }

      if (hasConcurrentChange(existingComment, bodyResult.data.baseUpdatedAt)) {
        return reply
          .code(409)
          .send(conflictPayload("Comment was modified since this change was made", serializeComment(existingComment)));
      }

      const updatedComment = await commentStore.update(existingComment.id, {
        body: bodyResult.data.body,
      });

      if (!updatedComment) {
        return sendError(reply, 404, "NOT_FOUND", "Comment not found");
      }

      return reply.send({
        data: serializeComment(updatedComment),
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Comments table is missing");
        return sendStorageNotInitializedError(reply, "Comment");
      }

      request.log.error(error, "Failed to update comment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to update comment");
    }
  });

  app.delete("/api/tasks/:id/comments/:commentId", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = commentParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request params", details);
    }

    try {
      const taskExists = await ensureTaskExists(taskStore, paramsResult.data.id, authUserId);

      if (!taskExists) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      const existingComment = await commentStore.getById(paramsResult.data.commentId);

      if (!existingComment || existingComment.taskId !== paramsResult.data.id) {
        return sendError(reply, 404, "NOT_FOUND", "Comment not found");
      }

      const deletedComment = await commentStore.remove(existingComment.id);

      if (!deletedComment) {
        return sendError(reply, 404, "NOT_FOUND", "Comment not found");
      }

      return reply.send({
        data: serializeComment(deletedComment),
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Comments table is missing");
        return sendStorageNotInitializedError(reply, "Comment");
      }

      request.log.error(error, "Failed to delete comment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete comment");
    }
  });
};

export default commentsRoutes;
