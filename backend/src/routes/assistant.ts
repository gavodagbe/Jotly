import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AssistantService } from "../assistant/assistant-service";
import { AuthService } from "../auth/auth-service";
import { CommentStore } from "../comments/comment-store";
import { formatDateOnly, TaskStore } from "../tasks/task-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type AssistantRoutesOptions = {
  taskStore: TaskStore;
  commentStore?: CommentStore;
  authService: AuthService;
  assistantService: AssistantService;
};

const assistantReplyBodySchema = z.object({
  question: z.string().trim().min(1, "question is required").max(3000, "question is too long"),
});

function isAssistantStorageMissingError(error: unknown): boolean {
  return isStorageNotInitializedPrismaError(error);
}

function getAuthenticatedUser(request: { authUserId?: string; authDisplayName?: string }) {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }

  return {
    id: request.authUserId,
    displayName: request.authDisplayName ?? null,
  };
}

const assistantRoutes: FastifyPluginAsync<AssistantRoutesOptions> = async (app, options) => {
  const { taskStore, commentStore, authService, assistantService } = options;

  app.addHook("preHandler", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const authContext = await authService.authenticateBearerToken(token);

    if (!authContext) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    (request as { authUserId?: string; authDisplayName?: string }).authUserId = authContext.user.id;
    (request as { authUserId?: string; authDisplayName?: string }).authDisplayName =
      authContext.user.displayName ?? undefined;
  });

  app.post("/api/assistant/reply", async (request, reply) => {
    const authUser = getAuthenticatedUser(request as { authUserId?: string; authDisplayName?: string });

    if (!authUser) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = assistantReplyBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const tasks = await taskStore.listByUser(authUser.id);

      const tasksWithComments = await Promise.all(
        tasks.map(async (task) => {
          const comments = commentStore ? await commentStore.listByTaskId(task.id) : [];

          return {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            targetDate: formatDateOnly(task.targetDate),
            priority: task.priority,
            project: task.project,
            plannedTime: task.plannedTime,
            comments: comments.map((comment) => comment.body).filter((value) => value.trim().length > 0),
          };
        })
      );

      const usedCommentCount = tasksWithComments.reduce((total, task) => total + task.comments.length, 0);

      const assistantReply = await assistantService.generateReply({
        question: bodyResult.data.question,
        userDisplayName: authUser.displayName,
        tasks: tasksWithComments,
      });

      return reply.send({
        data: {
          answer: assistantReply.answer,
          source: assistantReply.source,
          warning: assistantReply.warning,
          generatedAt: new Date().toISOString(),
          usedTaskCount: tasksWithComments.length,
          usedCommentCount,
        },
      });
    } catch (error) {
      if (isAssistantStorageMissingError(error)) {
        request.log.warn(error, "Assistant storage dependency is missing");
        return sendStorageNotInitializedError(reply, "Assistant");
      }

      request.log.error(error, "Failed to create assistant reply");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to generate assistant reply");
    }
  });
};

export default assistantRoutes;
