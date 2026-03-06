import { Prisma, Task, TaskStatus } from "@prisma/client";
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { formatDateOnly, parseDateOnly, TaskStore, TaskUpdateInput } from "../tasks/task-store";

type TasksRouteOptions = {
  taskStore: TaskStore;
  authService: AuthService;
};

const taskStatusSchema = z.enum(["todo", "in_progress", "done", "cancelled"]);
const taskPrioritySchema = z.enum(["low", "medium", "high"]);

const targetDateSchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, {
    message: "targetDate must be a valid date in YYYY-MM-DD format"
  });

const createTaskBodySchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional().nullable(),
  status: taskStatusSchema.optional(),
  targetDate: targetDateSchema,
  priority: taskPrioritySchema.optional(),
  project: z.string().trim().optional().nullable(),
  plannedTime: z.number().int().nonnegative().optional().nullable()
});

const updateTaskBodySchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").optional(),
    description: z.string().trim().optional().nullable(),
    status: taskStatusSchema.optional(),
    targetDate: targetDateSchema.optional(),
    priority: taskPrioritySchema.optional(),
    project: z.string().trim().optional().nullable(),
    plannedTime: z.number().int().nonnegative().optional().nullable()
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided"
  });

const taskIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Task id is required")
});

const listTasksQuerySchema = z.object({
  date: targetDateSchema
});

type ApiErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "NOT_FOUND" | "INTERNAL_ERROR";

function sendError(
  reply: {
    code: (statusCode: number) => {
      send: (payload: unknown) => unknown;
    };
  },
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: string[]
) {
  const payload: {
    error: { code: ApiErrorCode; message: string; details?: string[] };
  } = {
    error: {
      code,
      message
    }
  };

  if (details && details.length > 0) {
    payload.error.details = details;
  }

  return reply.code(statusCode).send(payload);
}

function zodIssuesToStrings(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function isTaskTableMissingError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

function sendTaskStorageNotInitializedError(
  reply: {
    code: (statusCode: number) => {
      send: (payload: unknown) => unknown;
    };
  }
) {
  return sendError(
    reply,
    503,
    "INTERNAL_ERROR",
    "Task storage is not initialized. Apply Prisma migrations and retry."
  );
}

function getBearerToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const [scheme, token] = value.trim().split(/\s+/, 2);

  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function serializeTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    targetDate: formatDateOnly(task.targetDate),
    priority: task.priority,
    project: task.project,
    plannedTime: task.plannedTime,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
    cancelledAt: task.cancelledAt?.toISOString() ?? null
  };
}

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value === "" ? null : value;
}

function getTimestampsForNewStatus(status: TaskStatus, now: Date) {
  if (status === "done") {
    return { completedAt: now, cancelledAt: null };
  }

  if (status === "cancelled") {
    return { completedAt: null, cancelledAt: now };
  }

  return { completedAt: null, cancelledAt: null };
}

function getTimestampsForStatusTransition(task: Task, nextStatus: TaskStatus, now: Date) {
  if (nextStatus === "done") {
    return {
      completedAt: task.completedAt ?? now,
      cancelledAt: null
    };
  }

  if (nextStatus === "cancelled") {
    return {
      completedAt: null,
      cancelledAt: task.cancelledAt ?? now
    };
  }

  return {
    completedAt: null,
    cancelledAt: null
  };
}

const tasksRoutes: FastifyPluginAsync<TasksRouteOptions> = async (app, options) => {
  const { taskStore, authService } = options;

  app.addHook("preHandler", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const authContext = await authService.authenticateBearerToken(token);

    if (!authContext) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
  });

  app.get("/api/tasks", async (request, reply) => {
    const queryResult = listTasksQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      const details = zodIssuesToStrings(queryResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request query",
        details
      );
    }

    const targetDate = parseDateOnly(queryResult.data.date);

    if (!targetDate) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "targetDate must be a valid date in YYYY-MM-DD format"
      );
    }

    try {
      const tasks = await taskStore.listByDate(targetDate);
      return reply.send({
        data: tasks.map(serializeTask)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to list tasks");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list tasks");
    }
  });

  app.post("/api/tasks", async (request, reply) => {
    const bodyResult = createTaskBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request body",
        details
      );
    }

    const parsedDate = parseDateOnly(bodyResult.data.targetDate);

    if (!parsedDate) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "targetDate must be a valid date in YYYY-MM-DD format"
      );
    }

    const status = bodyResult.data.status ?? "todo";
    const now = new Date();

    try {
      const task = await taskStore.create({
        title: bodyResult.data.title,
        description: normalizeNullableText(bodyResult.data.description) ?? null,
        status,
        targetDate: parsedDate,
        priority: bodyResult.data.priority ?? "medium",
        project: normalizeNullableText(bodyResult.data.project) ?? null,
        plannedTime: bodyResult.data.plannedTime ?? null,
        ...getTimestampsForNewStatus(status, now)
      });

      return reply.code(201).send({
        data: serializeTask(task)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to create task");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create task");
    }
  });

  app.get("/api/tasks/:id", async (request, reply) => {
    const paramsResult = taskIdParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request params",
        details
      );
    }

    try {
      const task = await taskStore.getById(paramsResult.data.id);

      if (!task) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      return reply.send({
        data: serializeTask(task)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to fetch task");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to fetch task");
    }
  });

  app.patch("/api/tasks/:id", async (request, reply) => {
    const paramsResult = taskIdParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request params",
        details
      );
    }

    const bodyResult = updateTaskBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request body",
        details
      );
    }

    const updateBody = bodyResult.data;

    try {
      const existingTask = await taskStore.getById(paramsResult.data.id);

      if (!existingTask) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      const updateInput: TaskUpdateInput = {};

      if (updateBody.title !== undefined) {
        updateInput.title = updateBody.title;
      }

      if (updateBody.description !== undefined) {
        updateInput.description = normalizeNullableText(updateBody.description) ?? null;
      }

      if (updateBody.targetDate !== undefined) {
        const parsedDate = parseDateOnly(updateBody.targetDate);

        if (!parsedDate) {
          return sendError(
            reply,
            400,
            "VALIDATION_ERROR",
            "targetDate must be a valid date in YYYY-MM-DD format"
          );
        }

        updateInput.targetDate = parsedDate;
      }

      if (updateBody.priority !== undefined) {
        updateInput.priority = updateBody.priority;
      }

      if (updateBody.project !== undefined) {
        updateInput.project = normalizeNullableText(updateBody.project) ?? null;
      }

      if (updateBody.plannedTime !== undefined) {
        updateInput.plannedTime = updateBody.plannedTime;
      }

      const nextStatus = updateBody.status ?? existingTask.status;
      updateInput.status = nextStatus;

      const now = new Date();
      const timestamps = getTimestampsForStatusTransition(existingTask, nextStatus, now);
      updateInput.completedAt = timestamps.completedAt;
      updateInput.cancelledAt = timestamps.cancelledAt;

      const updatedTask = await taskStore.update(paramsResult.data.id, updateInput);

      if (!updatedTask) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      return reply.send({
        data: serializeTask(updatedTask)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to update task");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to update task");
    }
  });

  app.delete("/api/tasks/:id", async (request, reply) => {
    const paramsResult = taskIdParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      const details = zodIssuesToStrings(paramsResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request params",
        details
      );
    }

    try {
      const deletedTask = await taskStore.remove(paramsResult.data.id);

      if (!deletedTask) {
        return sendError(reply, 404, "NOT_FOUND", "Task not found");
      }

      return reply.send({
        data: serializeTask(deletedTask)
      });
    } catch (error) {
      if (isTaskTableMissingError(error)) {
        request.log.warn(error, "Task table is missing");
        return sendTaskStorageNotInitializedError(reply);
      }

      request.log.error(error, "Failed to delete task");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete task");
    }
  });
};

export default tasksRoutes;
