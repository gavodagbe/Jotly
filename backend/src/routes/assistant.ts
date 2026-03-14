import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AssistantService } from "../assistant/assistant-service";
import { AuthService } from "../auth/auth-service";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type AssistantRoutesOptions = {
  authService: AuthService;
  assistantService: AssistantService;
};

const assistantReplyBodySchema = z.object({
  question: z.string().trim().min(1, "question is required").max(3000, "question is too long"),
  locale: z.enum(["en", "fr"]).optional(),
});

function isAssistantStorageMissingError(error: unknown): boolean {
  return isStorageNotInitializedPrismaError(error);
}

function getAuthenticatedUser(request: {
  authUserId?: string;
  authDisplayName?: string;
  authPreferredLocale?: "en" | "fr";
}) {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }

  return {
    id: request.authUserId,
    displayName: request.authDisplayName ?? null,
    preferredLocale: request.authPreferredLocale ?? "en",
  };
}

const assistantRoutes: FastifyPluginAsync<AssistantRoutesOptions> = async (app, options) => {
  const { authService, assistantService } = options;

  app.addHook("preHandler", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const authContext = await authService.authenticateBearerToken(token);

    if (!authContext) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    (request as { authUserId?: string; authDisplayName?: string; authPreferredLocale?: "en" | "fr" }).authUserId =
      authContext.user.id;
    (
      request as { authUserId?: string; authDisplayName?: string; authPreferredLocale?: "en" | "fr" }
    ).authDisplayName =
      authContext.user.displayName ?? undefined;
    (
      request as { authUserId?: string; authDisplayName?: string; authPreferredLocale?: "en" | "fr" }
    ).authPreferredLocale = authContext.user.preferredLocale;
  });

  app.post("/api/assistant/reply", async (request, reply) => {
    const authUser = getAuthenticatedUser(
      request as {
        authUserId?: string;
        authDisplayName?: string;
        authPreferredLocale?: "en" | "fr";
      }
    );

    if (!authUser) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = assistantReplyBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const assistantReply = await assistantService.generateReply({
        question: bodyResult.data.question,
        userId: authUser.id,
        userDisplayName: authUser.displayName,
        preferredLocale: bodyResult.data.locale ?? authUser.preferredLocale,
      });

      return reply.send({
        data: {
          answer: assistantReply.answer,
          source: assistantReply.source,
          warning: assistantReply.warning,
          generatedAt: new Date().toISOString(),
          usedDomains: assistantReply.usedDomains,
          retrievalMode: assistantReply.retrievalMode,
          matchedRecordsCount: assistantReply.matchedRecordsCount,
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
