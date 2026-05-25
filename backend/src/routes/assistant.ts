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
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
  requestTimeoutMs?: number;
};

const assistantReplyBodySchema = z.object({
  question: z.string().trim().min(1, "question is required").max(3000, "question is too long"),
  locale: z.enum(["en", "fr"]).optional(),
});

const assistantRewriteBodySchema = z.object({
  text: z.string().trim().min(1, "text is required").max(20000, "text is too long"),
  format: z.enum(["title", "plain", "rich"]).default("plain"),
  fieldLabel: z.string().trim().max(120, "fieldLabel is too long").optional(),
  locale: z.enum(["en", "fr"]).optional(),
});

type AssistantRewriteFormat = z.infer<typeof assistantRewriteBodySchema>["format"];

type OpenAiChatResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string; code?: string };
};

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

function getRewritePrompts(input: {
  format: AssistantRewriteFormat;
  fieldLabel?: string;
  text: string;
}) {
  const fieldContext = input.fieldLabel?.trim()
    ? ` for the field "${input.fieldLabel.trim()}"`
    : "";

  const systemPrompt =
    "You rewrite user-authored text. Preserve the intent, facts, point of view, and the language of the input text. Always answer in the same language as the input text, even if the app locale or field label uses another language. Improve only clarity, flow, and formulation. Reply only with the rewritten text and no explanation.";

  if (input.format === "title") {
    return {
      systemPrompt,
      userPrompt: `Rewrite this title${fieldContext}. Keep it short, natural, precise, and action-oriented when that matches the original meaning. Return a single line with no quotes or list.\n\nText:\n${input.text}`,
      maxTokens: 120,
    };
  }

  if (input.format === "rich") {
    return {
      systemPrompt,
      userPrompt: `Rewrite this text${fieldContext}. Preserve useful structure with paragraphs or simple lists when needed. Keep a natural tone and a length close to the original unless the source is very fragmentary. You may respond in plain text or simple markdown.\n\nText:\n${input.text}`,
      maxTokens: 1200,
    };
  }

  return {
    systemPrompt,
    userPrompt: `Rewrite this text${fieldContext}. Keep the same meaning, language, and a similar length to the original. Make it clearer and more natural.\n\nText:\n${input.text}`,
    maxTokens: 500,
  };
}

async function requestOpenAiRewrite(input: {
  apiKey: string;
  model: string;
  baseUrl: string;
  requestTimeoutMs: number;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.requestTimeoutMs);

  try {
    const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        temperature: 0.4,
        max_tokens: input.maxTokens,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as OpenAiChatResponse | null;

    if (!response.ok) {
      return {
        ok: false as const,
        message: payload?.error?.message ?? `OpenAI request failed (HTTP ${response.status})`,
      };
    }

    const content = payload?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return {
        ok: false as const,
        message: "AI returned an empty response",
      };
    }

    return {
      ok: true as const,
      content,
    };
  } finally {
    clearTimeout(timeout);
  }
}

const assistantRoutes: FastifyPluginAsync<AssistantRoutesOptions> = async (app, options) => {
  const { authService, assistantService, openAiApiKey, openAiModel, openAiBaseUrl, requestTimeoutMs } = options;

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

  app.post("/api/assistant/rewrite", async (request, reply) => {
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

    const bodyResult = assistantRewriteBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    if (!openAiApiKey || !openAiModel || !openAiBaseUrl) {
      return sendError(reply, 503, "AI_UNAVAILABLE", "AI rewriting is not configured");
    }

    const prompts = getRewritePrompts({
      format: bodyResult.data.format,
      fieldLabel: bodyResult.data.fieldLabel,
      text: bodyResult.data.text,
    });

    try {
      const rewriteResult = await requestOpenAiRewrite({
        apiKey: openAiApiKey,
        model: openAiModel,
        baseUrl: openAiBaseUrl,
        requestTimeoutMs: requestTimeoutMs ?? 15000,
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
        maxTokens: prompts.maxTokens,
      });

      if (!rewriteResult.ok) {
        request.log.error({ message: rewriteResult.message }, "AI rewriting failed");
        return sendError(reply, 502, "AI_ERROR", "AI rewriting failed");
      }

      return reply.send({
        data: {
          text: rewriteResult.content,
          source: "openai" as const,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      request.log.error(error, "Failed to rewrite text with AI");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to rewrite text");
    }
  });
};

export default assistantRoutes;
