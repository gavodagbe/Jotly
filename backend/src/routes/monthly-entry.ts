import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { MonthlyEntryStore } from "../monthly-entry/monthly-entry-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type MonthlyEntryRoutesOptions = {
  authService: AuthService;
  monthlyEntryStore: MonthlyEntryStore;
};

const getMonthlyEntryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

const upsertMonthlyEntryBodySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  objective: z.string().max(50000).nullable().optional(),
  review: z.string().max(50000).nullable().optional(),
});

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
}

function serializeMonthlyEntry(entry: {
  id: string;
  year: number;
  month: number;
  objective: string | null;
  review: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: entry.id,
    year: entry.year,
    month: entry.month,
    objective: entry.objective,
    review: entry.review,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

const monthlyEntryRoutes: FastifyPluginAsync<MonthlyEntryRoutesOptions> = async (app, options) => {
  const { authService, monthlyEntryStore } = options;

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

  app.get("/api/monthly-entry", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const queryResult = getMonthlyEntryQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      const details = zodIssuesToStrings(queryResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request query", details);
    }

    try {
      const entry = await monthlyEntryStore.getByMonth(
        queryResult.data.year,
        queryResult.data.month,
        authUserId
      );
      return reply.send({ data: entry ? serializeMonthlyEntry(entry) : null });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "MonthlyEntry");
      }
      request.log.error(error, "Failed to load monthly entry");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load monthly entry");
    }
  });

  app.put("/api/monthly-entry", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = upsertMonthlyEntryBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const saved = await monthlyEntryStore.upsert({
        userId: authUserId,
        year: bodyResult.data.year,
        month: bodyResult.data.month,
        objective: bodyResult.data.objective,
        review: bodyResult.data.review,
      });
      return reply.send({ data: serializeMonthlyEntry(saved) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "MonthlyEntry");
      }
      request.log.error(error, "Failed to save monthly entry");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to save monthly entry");
    }
  });
};

export default monthlyEntryRoutes;
