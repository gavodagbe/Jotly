import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { DayAffirmationStore } from "../day-affirmation/day-affirmation-store";
import { createAssistantDocumentExtractor } from "../assistant/assistant-document-extractor";
import { formatDateOnly, parseDateOnly } from "../tasks/task-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type DayAffirmationRoutesOptions = {
  authService: AuthService;
  dayAffirmationStore: DayAffirmationStore;
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
  requestTimeoutMs?: number;
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

const extractTextBodySchema = z.object({
  imageDataUrl: z.string().min(1, "imageDataUrl is required"),
});

const reformatBodySchema = z.object({
  text: z.string().trim().min(1, "text is required").max(20000, "text is too long"),
  instruction: z.string().trim().max(500).optional(),
  locale: z.enum(["en", "fr"]).optional(),
});

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

const documentExtractor = createAssistantDocumentExtractor();

const dayAffirmationRoutes: FastifyPluginAsync<DayAffirmationRoutesOptions> = async (app, options) => {
  const { authService, dayAffirmationStore } = options;

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
  // POST /api/day-affirmation/extract-text
  app.post("/api/day-affirmation/extract-text", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = extractTextBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    const { imageDataUrl } = bodyResult.data;

    if (!imageDataUrl.startsWith("data:image/")) {
      return sendError(reply, 400, "VALIDATION_ERROR", "imageDataUrl must be a data URL of an image");
    }

    try {
      const extraction = await documentExtractor.extractFromAttachment({
        name: "photo",
        url: imageDataUrl,
        contentType: null,
      });

      if (extraction.status === "unsupported") {
        return sendError(reply, 422, "OCR_UNAVAILABLE", extraction.warning ?? "OCR is not available");
      }

      return reply.send({
        data: {
          text: extraction.text,
          status: extraction.status,
          warning: extraction.warning,
        },
      });
    } catch (error) {
      request.log.error(error, "Failed to extract text from image");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to extract text from image");
    }
  });

  // POST /api/day-affirmation/reformat
  app.post("/api/day-affirmation/reformat", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = reformatBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    const { text, instruction, locale } = bodyResult.data;

    const { openAiApiKey, openAiModel, openAiBaseUrl, requestTimeoutMs } = options;

    if (!openAiApiKey || !openAiModel || !openAiBaseUrl) {
      return sendError(reply, 503, "AI_UNAVAILABLE", "AI reformatting is not configured");
    }

    const isFrench = locale === "fr";
    const defaultInstruction = isFrench
      ? "Reformate ce texte en une belle affirmation positive au présent, percutante et personnelle."
      : "Reformat this text into a beautiful, impactful, positive affirmation in the present tense.";

    const effectiveInstruction = instruction?.trim() || defaultInstruction;

    const systemPrompt = isFrench
      ? "Tu es un assistant qui reformate des textes en affirmations positives pour un journal personnel. Réponds uniquement avec le texte reformaté, sans explications."
      : "You are an assistant that reformats texts into positive affirmations for a personal journal. Respond only with the reformatted text, no explanations.";

    const userPrompt = `${effectiveInstruction}\n\nTexte :\n${text}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs ?? 15000);

    try {
      const response = await fetch(`${openAiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify({
          model: openAiModel,
          temperature: 0.5,
          max_tokens: 500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const payload = (await response.json().catch(() => null)) as OpenAiChatResponse | null;

      if (!response.ok) {
        const message = payload?.error?.message ?? `OpenAI request failed (HTTP ${response.status})`;
        request.log.error({ status: response.status }, message);
        return sendError(reply, 502, "AI_ERROR", "AI reformatting failed");
      }

      const content = payload?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return sendError(reply, 502, "AI_ERROR", "AI returned an empty response");
      }

      return reply.send({ data: { text: content } });
    } catch (error) {
      clearTimeout(timeout);
      request.log.error(error, "Failed to reformat affirmation text");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to reformat text");
    }
  });
};

export default dayAffirmationRoutes;
