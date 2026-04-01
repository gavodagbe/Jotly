import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { WeeklyEntryStore } from "../weekly-entry/weekly-entry-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type WeeklyEntryRoutesOptions = {
  authService: AuthService;
  weeklyEntryStore: WeeklyEntryStore;
};

const getWeeklyEntryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  week: z.coerce.number().int().min(1).max(53),
});

const upsertWeeklyEntryBodySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  week: z.number().int().min(1).max(53),
  objective: z.string().max(50000).nullable().optional(),
  review: z.string().max(50000).nullable().optional(),
});

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
}

function serializeWeeklyEntry(entry: {
  id: string;
  year: number;
  isoWeek: number;
  objective: string | null;
  review: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: entry.id,
    year: entry.year,
    isoWeek: entry.isoWeek,
    objective: entry.objective,
    review: entry.review,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

const weeklyEntryRoutes: FastifyPluginAsync<WeeklyEntryRoutesOptions> = async (app, options) => {
  const { authService, weeklyEntryStore } = options;

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

  app.get("/api/weekly-entry", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const queryResult = getWeeklyEntryQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      const details = zodIssuesToStrings(queryResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request query", details);
    }

    try {
      const entry = await weeklyEntryStore.getByWeek(
        queryResult.data.year,
        queryResult.data.week,
        authUserId
      );
      return reply.send({ data: entry ? serializeWeeklyEntry(entry) : null });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "WeeklyEntry");
      }
      request.log.error(error, "Failed to load weekly entry");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load weekly entry");
    }
  });

  app.put("/api/weekly-entry", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = upsertWeeklyEntryBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const saved = await weeklyEntryStore.upsert({
        userId: authUserId,
        year: bodyResult.data.year,
        isoWeek: bodyResult.data.week,
        objective: bodyResult.data.objective,
        review: bodyResult.data.review,
      });
      return reply.send({ data: serializeWeeklyEntry(saved) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "WeeklyEntry");
      }
      request.log.error(error, "Failed to save weekly entry");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to save weekly entry");
    }
  });
};

export default weeklyEntryRoutes;
