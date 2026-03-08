import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { GamingTrackPeriod, GamingTrackService, GamingTrackSummary } from "../gaming-track/gaming-track-service";
import { formatDateOnly, parseDateOnly } from "../tasks/task-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type GamingTrackRoutesOptions = {
  authService: AuthService;
  gamingTrackService: GamingTrackService;
};

const periodSchema = z.enum(["day", "week", "month", "year"]);

const targetDateSchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, {
    message: "date must be a valid date in YYYY-MM-DD format",
  });

const summaryQuerySchema = z.object({
  date: targetDateSchema,
  period: periodSchema.default("week"),
});

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }

  return request.authUserId;
}

function serializeSummary(summary: GamingTrackSummary) {
  const serializeHistoricalPoint = (point: GamingTrackSummary["historicalTrends"]["daily"][number]) => ({
    label: point.label,
    rangeStart: formatDateOnly(point.rangeStart),
    rangeEnd: formatDateOnly(point.rangeEnd),
    trackedDays: point.trackedDays,
    tasksDone: point.tasksDone,
    taskCompletionRate: point.taskCompletionRate,
    affirmationCompletionRate: point.affirmationCompletionRate,
    bilanCompletionRate: point.bilanCompletionRate,
    overallScore: point.overallScore,
  });

  return {
    period: summary.period,
    anchorDate: formatDateOnly(summary.anchorDate),
    rangeStart: formatDateOnly(summary.rangeStart),
    rangeEnd: formatDateOnly(summary.rangeEnd),
    trackedDays: summary.trackedDays,
    tasks: summary.tasks,
    affirmations: summary.affirmations,
    bilans: summary.bilans,
    streaks: summary.streaks,
    scores: summary.scores,
    trend: summary.trend,
    weeklyMissionWindow: {
      rangeStart: formatDateOnly(summary.weeklyMissionWindow.rangeStart),
      rangeEnd: formatDateOnly(summary.weeklyMissionWindow.rangeEnd),
      trackedDays: summary.weeklyMissionWindow.trackedDays,
    },
    missions: summary.missions,
    personalBests: {
      dailyDoneTasks: summary.personalBests.dailyDoneTasks,
      dailyDoneTasksDate: summary.personalBests.dailyDoneTasksDate
        ? formatDateOnly(summary.personalBests.dailyDoneTasksDate)
        : null,
      executionBestStreak: summary.personalBests.executionBestStreak,
      reflectionBestStreak: summary.personalBests.reflectionBestStreak,
    },
    level: summary.level,
    badges: summary.badges,
    streakProtection: summary.streakProtection,
    historicalTrends: {
      daily: summary.historicalTrends.daily.map(serializeHistoricalPoint),
      weekly: summary.historicalTrends.weekly.map(serializeHistoricalPoint),
      monthly: summary.historicalTrends.monthly.map(serializeHistoricalPoint),
    },
    engagement: {
      challenge: {
        ...summary.engagement.challenge,
        expiresOn: formatDateOnly(summary.engagement.challenge.expiresOn),
      },
      leaderboard: {
        ...summary.engagement.leaderboard,
        entries: summary.engagement.leaderboard.entries.map((entry) => ({
          ...entry,
          rangeStart: formatDateOnly(entry.rangeStart),
          rangeEnd: formatDateOnly(entry.rangeEnd),
        })),
      },
      recap: {
        ...summary.engagement.recap,
        periodStart: formatDateOnly(summary.engagement.recap.periodStart),
        periodEnd: formatDateOnly(summary.engagement.recap.periodEnd),
        generatedOn: formatDateOnly(summary.engagement.recap.generatedOn),
      },
      nudges: summary.engagement.nudges,
    },
  };
}

const gamingTrackRoutes: FastifyPluginAsync<GamingTrackRoutesOptions> = async (app, options) => {
  const { authService, gamingTrackService } = options;

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

  app.get("/api/gaming-track/summary", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const queryResult = summaryQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      const details = zodIssuesToStrings(queryResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request query", details);
    }

    const anchorDate = parseDateOnly(queryResult.data.date);

    if (!anchorDate) {
      return sendError(reply, 400, "VALIDATION_ERROR", "date must be a valid date in YYYY-MM-DD format");
    }

    try {
      const summary = await gamingTrackService.getSummary({
        userId: authUserId,
        period: queryResult.data.period as GamingTrackPeriod,
        anchorDate,
      });

      return reply.send({
        data: serializeSummary(summary),
      });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        request.log.warn(error, "Gaming track storage is missing");
        return sendStorageNotInitializedError(reply, "GamingTrack");
      }

      request.log.error(error, "Failed to load gaming track summary");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load gaming track summary");
    }
  });
};

export default gamingTrackRoutes;
