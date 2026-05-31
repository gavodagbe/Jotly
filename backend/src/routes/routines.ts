import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { RoutineCompletionRecord, RoutineStore, RoutineTemplateRecord } from "../routines/routine-store";
import { parseDateOnly } from "../tasks/task-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type RoutineRoutesOptions = {
  authService: AuthService;
  routineStore: RoutineStore;
};

const routineChallengeSchema = z.enum(["normal", "bonus"]);
const routineTimeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "time must use HH:MM format")
  .optional()
  .nullable();

const createRoutineBodySchema = z.object({
  challenge: routineChallengeSchema.default("normal"),
  startTime: routineTimeSchema,
  endTime: routineTimeSchema,
  title: z.string().trim().min(1, "title is required").max(300, "title is too long"),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
});

const updateRoutineBodySchema = z.object({
  challenge: routineChallengeSchema.optional(),
  startTime: routineTimeSchema,
  endTime: routineTimeSchema,
  title: z.string().trim().min(1, "title is required").max(300, "title is too long").optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
});

const completionBodySchema = z.object({
  routineId: z.string().trim().min(1, "routineId is required"),
  targetDate: z.string().refine((value) => parseDateOnly(value) !== null, {
    message: "targetDate must be a valid date in YYYY-MM-DD format",
  }),
  isCompleted: z.boolean(),
});

const monthQuerySchema = z.string().regex(/^\d{4}-\d{2}$/, "month must use YYYY-MM format");

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
}

function serializeRoutine(routine: RoutineTemplateRecord) {
  return {
    id: routine.id,
    challenge: routine.challenge,
    startTime: routine.startTime,
    endTime: routine.endTime,
    title: routine.title,
    sortOrder: routine.sortOrder,
    isActive: routine.isActive,
    createdAt: routine.createdAt.toISOString(),
    updatedAt: routine.updatedAt.toISOString(),
  };
}

function serializeCompletion(completion: RoutineCompletionRecord) {
  return {
    id: completion.id,
    routineId: completion.routineId,
    targetDate: completion.targetDate.toISOString().substring(0, 10),
    isCompleted: completion.isCompleted,
    completedAt: completion.completedAt ? completion.completedAt.toISOString() : null,
    createdAt: completion.createdAt.toISOString(),
    updatedAt: completion.updatedAt.toISOString(),
  };
}

function getMonthRange(month: string): { start: Date; endExclusive: Date; days: string[] } | null {
  const [yearValue, monthValue] = month.split("-").map(Number);
  if (!yearValue || !monthValue || monthValue < 1 || monthValue > 12) {
    return null;
  }

  const start = new Date(Date.UTC(yearValue, monthValue - 1, 1));
  const endExclusive = new Date(Date.UTC(yearValue, monthValue, 1));
  const days: string[] = [];
  for (const cursor = new Date(start); cursor < endExclusive; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push(cursor.toISOString().substring(0, 10));
  }

  return { start, endExclusive, days };
}

function calculatePercentages(input: {
  routines: RoutineTemplateRecord[];
  completions: RoutineCompletionRecord[];
  days: string[];
}) {
  const normalRoutines = input.routines.filter((routine) => routine.challenge !== "bonus");
  const scoredRoutines = normalRoutines.length > 0 ? normalRoutines : input.routines;
  const completionKeys = new Set(
    input.completions
      .filter((completion) => completion.isCompleted)
      .map((completion) => `${completion.routineId}:${completion.targetDate.toISOString().substring(0, 10)}`)
  );

  const dailyPercentages = input.days.map((date) => {
    if (scoredRoutines.length === 0) return { date, percentage: 0 };
    const completed = scoredRoutines.filter((routine) => completionKeys.has(`${routine.id}:${date}`)).length;
    return {
      date,
      percentage: Math.round((completed / scoredRoutines.length) * 100),
    };
  });

  const totalSlots = scoredRoutines.length * input.days.length;
  const completedSlots = input.days.reduce(
    (sum, date) => sum + scoredRoutines.filter((routine) => completionKeys.has(`${routine.id}:${date}`)).length,
    0
  );

  return {
    dailyPercentages,
    monthPercentage: totalSlots === 0 ? 0 : Math.round((completedSlots / totalSlots) * 100),
  };
}

const routineRoutes: FastifyPluginAsync<RoutineRoutesOptions> = async (app, options) => {
  const { authService, routineStore } = options;

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

  app.get("/api/routines", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    try {
      await routineStore.ensureDefaults(authUserId);
      const query = request.query as { includeInactive?: string };
      const routines = await routineStore.listTemplates(authUserId, query.includeInactive === "true");
      return reply.send({ data: routines.map(serializeRoutine) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Routine");
      request.log.error(error, "Failed to list routines");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list routines");
    }
  });

  app.post("/api/routines", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    const bodyResult = createRoutineBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const routine = await routineStore.createTemplate({ ...bodyResult.data, userId: authUserId });
      return reply.code(201).send({ data: serializeRoutine(routine) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Routine");
      request.log.error(error, "Failed to create routine");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create routine");
    }
  });

  app.patch("/api/routines/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    const params = request.params as { id: string };
    const bodyResult = updateRoutineBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const routine = await routineStore.updateTemplate(params.id, authUserId, bodyResult.data);
      if (!routine) return sendError(reply, 404, "NOT_FOUND", "Routine not found");
      return reply.send({ data: serializeRoutine(routine) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Routine");
      request.log.error(error, "Failed to update routine");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to update routine");
    }
  });

  app.delete("/api/routines/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    const params = request.params as { id: string };
    try {
      const routine = await routineStore.removeTemplate(params.id, authUserId);
      if (!routine) return sendError(reply, 404, "NOT_FOUND", "Routine not found");
      return reply.send({ data: serializeRoutine(routine) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Routine");
      request.log.error(error, "Failed to delete routine");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete routine");
    }
  });

  app.get("/api/routine-completions", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    const query = request.query as { month?: string };
    const monthResult = monthQuerySchema.safeParse(query.month);
    if (!monthResult.success) {
      const details = zodIssuesToStrings(monthResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid month", details);
    }

    const range = getMonthRange(monthResult.data);
    if (!range) return sendError(reply, 400, "VALIDATION_ERROR", "month must use YYYY-MM format");

    try {
      await routineStore.ensureDefaults(authUserId);
      const [routines, completions] = await Promise.all([
        routineStore.listTemplates(authUserId),
        routineStore.listCompletionsForRange(authUserId, range.start, range.endExclusive),
      ]);
      const percentages = calculatePercentages({ routines, completions, days: range.days });
      return reply.send({
        data: {
          month: monthResult.data,
          days: range.days,
          routines: routines.map(serializeRoutine),
          completions: completions.map(serializeCompletion),
          dailyPercentages: percentages.dailyPercentages,
          monthPercentage: percentages.monthPercentage,
        },
      });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Routine");
      request.log.error(error, "Failed to list routine completions");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list routine completions");
    }
  });

  app.put("/api/routine-completions", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    const bodyResult = completionBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    const targetDate = parseDateOnly(bodyResult.data.targetDate);
    if (!targetDate) {
      return sendError(reply, 400, "VALIDATION_ERROR", "targetDate must be a valid date in YYYY-MM-DD format");
    }

    try {
      const completion = await routineStore.upsertCompletion({
        userId: authUserId,
        routineId: bodyResult.data.routineId,
        targetDate,
        isCompleted: bodyResult.data.isCompleted,
      });
      if (!completion) return sendError(reply, 404, "NOT_FOUND", "Routine not found");
      return reply.send({ data: serializeCompletion(completion) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Routine");
      request.log.error(error, "Failed to update routine completion");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to update routine completion");
    }
  });
};

export default routineRoutes;
