import Fastify, { FastifyInstance } from "fastify";
import { createPrismaAttachmentStore, AttachmentStore } from "./attachments/attachment-store";
import { createAuthService } from "./auth/auth-service";
import { createPrismaAuthStore, AuthStore } from "./auth/auth-store";
import { createPrismaCommentStore, CommentStore } from "./comments/comment-store";
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import attachmentsRoutes from "./routes/attachments";
import commentsRoutes from "./routes/comments";
import recurrenceRoutes from "./routes/recurrence";
import tasksRoutes from "./routes/tasks";
import { createPrismaRecurrenceStore, RecurrenceStore } from "./recurrence/recurrence-store";
import { createPrismaTaskStore, TaskStore } from "./tasks/task-store";

export type BuildAppOptions = {
  logLevel: string;
  taskStore?: TaskStore;
  authStore?: AuthStore;
  commentStore?: CommentStore;
  attachmentStore?: AttachmentStore;
  recurrenceStore?: RecurrenceStore;
  authSessionTtlHours?: number;
};

const APP_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    bodyLimit: APP_BODY_LIMIT_BYTES,
    logger: {
      level: options.logLevel
    }
  });

  const taskStore = options.taskStore ?? createPrismaTaskStore();
  const authStore = options.authStore ?? createPrismaAuthStore();
  const commentStore =
    options.commentStore ??
    (options.taskStore ? undefined : createPrismaCommentStore());
  const attachmentStore =
    options.attachmentStore ??
    (options.taskStore ? undefined : createPrismaAttachmentStore());
  const recurrenceStore =
    options.recurrenceStore ??
    (options.taskStore ? undefined : createPrismaRecurrenceStore());
  const authService = createAuthService({
    authStore,
    sessionTtlMs: (options.authSessionTtlHours ?? 168) * 60 * 60 * 1000
  });

  app.register(healthRoutes);
  app.register(authRoutes, { authService });
  app.register(tasksRoutes, { taskStore, authService, recurrenceStore });
  if (commentStore) {
    app.register(commentsRoutes, { taskStore, commentStore, authService });
  }

  if (attachmentStore) {
    app.register(attachmentsRoutes, { taskStore, attachmentStore, authService });
  }

  if (recurrenceStore) {
    app.register(recurrenceRoutes, { taskStore, recurrenceStore, authService });
  }

  app.setErrorHandler((error, request, reply) => {
    const candidateStatusCode = (error as { statusCode?: number }).statusCode;
    const statusCode =
      typeof candidateStatusCode === "number" &&
      candidateStatusCode >= 400 &&
      candidateStatusCode < 500
        ? candidateStatusCode
        : 500;
    const isClientError = statusCode >= 400 && statusCode < 500;
    const clientMessage = error instanceof Error ? error.message : "Invalid request";

    if (isClientError) {
      request.log.warn(error, "Client request error");
    } else {
      request.log.error(error, "Unhandled request error");
    }

    return reply.code(statusCode).send({
      error: {
        code: isClientError ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
        message: isClientError ? clientMessage : "An unexpected error occurred"
      }
    });
  });

  app.addHook("onClose", async () => {
    if (taskStore.close) {
      await taskStore.close();
    }

    if (authStore.close) {
      await authStore.close();
    }

    if (commentStore?.close) {
      await commentStore.close();
    }

    if (attachmentStore?.close) {
      await attachmentStore.close();
    }

    if (recurrenceStore?.close) {
      await recurrenceStore.close();
    }
  });

  return app;
}
