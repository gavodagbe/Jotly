import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
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
  locale: z.enum(["en", "fr"]).optional(),
  date: targetDateSchema.optional(),
});

const reformatBodySchema = z.object({
  text: z.string().trim().min(1, "text is required").max(20000, "text is too long"),
  instruction: z.string().trim().max(500).optional(),
  locale: z.enum(["en", "fr"]).optional(),
  date: targetDateSchema.optional(),
});

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

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

    const { imageDataUrl, locale, date } = bodyResult.data;

    if (!imageDataUrl.startsWith("data:image/")) {
      return sendError(reply, 400, "VALIDATION_ERROR", "imageDataUrl must be a data URL of an image");
    }

    const { openAiApiKey, openAiModel, openAiBaseUrl, requestTimeoutMs } = options;

    if (!openAiApiKey || !openAiModel || !openAiBaseUrl) {
      return sendError(reply, 503, "AI_UNAVAILABLE", "AI vision is not configured");
    }

    const isFrench = locale === "fr";

    const systemPrompt = isFrench
      ? "Tu es un assistant spécialisé dans la transcription fidèle et intégrale de textes imprimés ou manuscrits visibles sur des photos."
      : "You are an assistant specialized in faithful and complete transcription of printed or handwritten text visible in photos.";

    const userPrompt = isFrench
      ? "Retranscris intégralement tout le texte visible sur cette image, mot pour mot, de haut en bas. Inclus absolument tout : les titres, sous-titres, textes en encadré ou en grisé, paragraphes du corps du texte, citations en italique, attributions d'auteurs, numéros de page. N'omets, ne résume, ne reformule, ne saute aucun mot. Reproduis chaque mot exactement tel qu'il est écrit, dans l'ordre d'apparition."
      : "Transcribe all text visible in this image, word for word, from top to bottom. Include everything: titles, subtitles, boxed or shaded text, body paragraphs, italic quotes, author attributions, page numbers. Do not omit, summarize, rephrase, or skip any word. Reproduce each word exactly as written, in order of appearance.";

    const visionTimeoutMs = Math.max(requestTimeoutMs ?? 60000, 60000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), visionTimeoutMs);

    try {
      const response = await fetch(`${openAiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify({
          model: openAiModel,
          temperature: 0.1,
          max_tokens: 2000,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const payload = (await response.json().catch(() => null)) as OpenAiChatResponse | null;

      if (!response.ok) {
        const message = payload?.error?.message ?? `OpenAI request failed (HTTP ${response.status})`;
        request.log.error({ status: response.status }, message);
        return sendError(reply, 502, "AI_ERROR", "Vision extraction failed");
      }

      const content = payload?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return sendError(reply, 502, "AI_ERROR", "AI returned an empty response");
      }

      return reply.send({
        data: {
          text: content,
          status: "ready",
          warning: null,
        },
      });
    } catch (error) {
      clearTimeout(timeout);
      request.log.error(error, "Failed to extract text from image via Vision");
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

    const { text, instruction, locale, date } = bodyResult.data;

    const { openAiApiKey, openAiModel, openAiBaseUrl, requestTimeoutMs } = options;

    if (!openAiApiKey || !openAiModel || !openAiBaseUrl) {
      return sendError(reply, 503, "AI_UNAVAILABLE", "AI reformatting is not configured");
    }

    const isFrench = locale === "fr";
    const targetDate = date ? parseDateOnly(date) : new Date();
    const dayOfMonth = targetDate ? targetDate.getDate() : new Date().getDate();

    const defaultInstruction = isFrench
      ? `Analyse ce texte et crée un contenu structuré en 3 sections pour mon journal du ${dayOfMonth} :\n\n**1. Citation du ${dayOfMonth}** : Retranscris la citation principale ou l'idée centrale du texte (quelques lignes).\n\n**2. Enseignements à retenir** : Donne 2-3 enseignements clés ou insights issus de ce texte.\n\n**3. Exercices pour la journée** : Propose 2-3 exercices concrets ou actions inspirés par ce contenu.\n\nRéponds uniquement avec le contenu structuré, sans introduction ni conclusion.`
      : `Analyze this text and create structured content in 3 sections for my journal entry on the ${dayOfMonth}th:\n\n**1. Quote of the ${dayOfMonth}th**: Transcribe the main quote or central idea from the text (a few lines).\n\n**2. Key lessons**: Give 2-3 key teachings or insights from this text.\n\n**3. Exercises for the day**: Suggest 2-3 concrete exercises or actions inspired by this content.\n\nRespond only with the structured content, no introduction or conclusion.`;

    const effectiveInstruction = instruction?.trim() || defaultInstruction;

    const systemPrompt = isFrench
      ? "Tu es un assistant qui structure et reformate des textes pour un journal personnel. Réponds uniquement avec le texte demandé, sans explications."
      : "You are an assistant that structures and reformats texts for a personal journal. Respond only with the requested text, no explanations.";

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
          max_tokens: 1500,
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
