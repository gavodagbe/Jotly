import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AssistantSearchSyncService } from "../assistant/assistant-search-sync";
import { AuthService } from "../auth/auth-service";
import { DayAffirmationStore } from "../day-affirmation/day-affirmation-store";
import { formatDateOnly, parseDateOnly } from "../tasks/task-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";
import { triggerAssistantSearchSync } from "./assistant-search-sync-helpers";

type DayAffirmationRoutesOptions = {
  authService: AuthService;
  dayAffirmationStore: DayAffirmationStore;
  assistantSearchSyncService?: AssistantSearchSyncService;
};

const targetDateSchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, {
    message: "date must be a valid date in YYYY-MM-DD format",
  });

const getDayAffirmationQuerySchema = z.object({
  date: targetDateSchema,
});

const upsertDayAffirmationBodySchema = z.object({
  date: targetDateSchema,
  text: z.string().trim().min(1, "Affirmation text is required").max(5000, "Affirmation is too long"),
  isCompleted: z.boolean(),
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

function serializeDayAffirmation(affirmation: {
  id: string;
  targetDate: Date;
  text: string;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: affirmation.id,
    targetDate: formatDateOnly(affirmation.targetDate),
    text: affirmation.text,
    isCompleted: affirmation.isCompleted,
    completedAt: affirmation.completedAt?.toISOString() ?? null,
    createdAt: affirmation.createdAt.toISOString(),
    updatedAt: affirmation.updatedAt.toISOString(),
  };
}

const dayAffirmationRoutes: FastifyPluginAsync<DayAffirmationRoutesOptions> = async (app, options) => {
  const { authService, dayAffirmationStore, assistantSearchSyncService } = options;

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

  app.get("/api/day-affirmation", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const queryResult = getDayAffirmationQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      const details = zodIssuesToStrings(queryResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request query", details);
    }

    const targetDate = parseDateOnly(queryResult.data.date);

    if (!targetDate) {
      return sendError(reply, 400, "VALIDATION_ERROR", "date must be a valid date in YYYY-MM-DD format");
    }

    try {
      const affirmation = await dayAffirmationStore.getByDate(targetDate, authUserId);

      reply.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      reply.header("Pragma", "no-cache");
      reply.header("Expires", "0");
      return reply.send({
        data: affirmation ? serializeDayAffirmation(affirmation) : null,
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Day affirmation table is missing");
        return sendStorageNotInitializedError(reply, "DayAffirmation");
      }

      request.log.error(error, "Failed to load day affirmation");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load day affirmation");
    }
  });

  app.put("/api/day-affirmation", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = upsertDayAffirmationBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    const targetDate = parseDateOnly(bodyResult.data.date);

    if (!targetDate) {
      return sendError(reply, 400, "VALIDATION_ERROR", "date must be a valid date in YYYY-MM-DD format");
    }

    try {
      const existingAffirmation = await dayAffirmationStore.getByDate(targetDate, authUserId);
      const nextCompletedAt = bodyResult.data.isCompleted
        ? existingAffirmation?.completedAt ?? new Date()
        : null;

      const savedAffirmation = await dayAffirmationStore.upsert({
        userId: authUserId,
        targetDate,
        text: bodyResult.data.text,
        isCompleted: bodyResult.data.isCompleted,
        completedAt: nextCompletedAt,
      });

      triggerAssistantSearchSync(
        assistantSearchSyncService,
        authUserId,
        request.log,
        "day affirmation save"
      );

      reply.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      reply.header("Pragma", "no-cache");
      reply.header("Expires", "0");
      return reply.send({
        data: serializeDayAffirmation(savedAffirmation),
      });
    } catch (error) {
      if (isStorageMissingError(error)) {
        request.log.warn(error, "Day affirmation table is missing");
        return sendStorageNotInitializedError(reply, "DayAffirmation");
      }

      request.log.error(error, "Failed to save day affirmation");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to save day affirmation");
    }
  });
};

export default dayAffirmationRoutes;
