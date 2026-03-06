import Fastify, { FastifyInstance } from "fastify";
import healthRoutes from "./routes/health";
import tasksRoutes from "./routes/tasks";
import { createPrismaTaskStore, TaskStore } from "./tasks/task-store";

export type BuildAppOptions = {
  logLevel: string;
  taskStore?: TaskStore;
};

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger: {
      level: options.logLevel
    }
  });

  const taskStore = options.taskStore ?? createPrismaTaskStore();

  app.register(healthRoutes);
  app.register(tasksRoutes, { taskStore });

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
  });

  return app;
}
