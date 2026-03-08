import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { DayBilanStore } from "../day-bilan/day-bilan-store";
import { formatDateOnly, parseDateOnly } from "../tasks/task-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type DayBilanRoutesOptions = {
  authService: AuthService;
  dayBilanStore: DayBilanStore;
};

const targetDateSchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, {
    message: "date must be a valid date in YYYY-MM-DD format",
  });

const getDayBilanQuerySchema = z.object({
  date: targetDateSchema,
});

const upsertDayBilanBodySchema = z.object({
  date: targetDateSchema,
  mood: z.number().int().min(1).max(5).nullable().optional(),
  wins: z.string().max(10000, "Wins text is too long").nullable().optional(),
  blockers: z.string().max(10000, "Blockers text is too long").nullable().optional(),
  lessonsLearned: z.string().max(10000, "Lessons text is too long").nullable().optional(),
  tomorrowTop3: z.string().max(10000, "Top 3 text is too long").nullable().optional(),
});

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }

  return request.authUserId;
}

function isStorageMissingError(error: unknown): boolean {
  return isStorageNotInitializedPrismaError(error);
}

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function serializeDayBilan(bilan: {
  id: string;
  targetDate: Date;
  mood: number | null;
  wins: string | null;
  blockers: string | null;
  lessonsLearned: string | null;
  tomorrowTop3: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: bilan.id,
    targetDate: formatDateOnly(bilan.targetDate),
    mood: bilan.mood,
    wins: bilan.wins,
    blockers: bilan.blockers,
    lessonsLearned: bilan.lessonsLearned,
    tomorrowTop3: bilan.tomorrowTop3,
    createdAt: bilan.createdAt.toISOString(),
    updatedAt: bilan.updatedAt.toISOString(),
  };
}

const dayBilanRoutes: FastifyPluginAsync<DayBilanRoutesOptions> = async (app, options) => {
  const { authService, dayBilanStore } = options;

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

  app.get("/api/day-bilan", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const queryResult = getDayBilanQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      const details = zodIssuesToStrings(queryResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request query", details);
    }

    const targetDate = parseDateOnly(queryResult.data.date);

    if (!targetDate) {
      return sendError(reply, 400, "VALIDATION_ERROR", "date must be a valid date in YYYY-MM-DD format");
    }

    try {
      const bilan = await dayBilanStore.getByDate(targetDate, authUserId);

      return reply.send({
        data: bilan ? serializeDayBilan(bilan) : null,
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Day bilan table is missing");
        return sendStorageNotInitializedError(reply, "DayBilan");
      }

      request.log.error(error, "Failed to load day bilan");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load day bilan");
    }
  });

  app.put("/api/day-bilan", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = upsertDayBilanBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    const targetDate = parseDateOnly(bodyResult.data.date);

    if (!targetDate) {
      return sendError(reply, 400, "VALIDATION_ERROR", "date must be a valid date in YYYY-MM-DD format");
    }

    try {
      const existingBilan = await dayBilanStore.getByDate(targetDate, authUserId);

      const mood = bodyResult.data.mood !== undefined ? bodyResult.data.mood : existingBilan?.mood ?? null;
      const winsInput = normalizeOptionalText(bodyResult.data.wins);
      const blockersInput = normalizeOptionalText(bodyResult.data.blockers);
      const lessonsInput = normalizeOptionalText(bodyResult.data.lessonsLearned);
      const top3Input = normalizeOptionalText(bodyResult.data.tomorrowTop3);

      const savedBilan = await dayBilanStore.upsert({
        userId: authUserId,
        targetDate,
        mood,
        wins: winsInput !== undefined ? winsInput : existingBilan?.wins ?? null,
        blockers: blockersInput !== undefined ? blockersInput : existingBilan?.blockers ?? null,
        lessonsLearned: lessonsInput !== undefined ? lessonsInput : existingBilan?.lessonsLearned ?? null,
        tomorrowTop3: top3Input !== undefined ? top3Input : existingBilan?.tomorrowTop3 ?? null,
      });

      return reply.send({
        data: serializeDayBilan(savedBilan),
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Day bilan table is missing");
        return sendStorageNotInitializedError(reply, "DayBilan");
      }

      request.log.error(error, "Failed to save day bilan");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to save day bilan");
    }
  });
};

export default dayBilanRoutes;
