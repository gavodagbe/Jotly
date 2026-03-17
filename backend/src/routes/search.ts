import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import {
  AssistantSearchDocumentStore,
  AssistantSearchSourceType,
} from "../assistant/assistant-search-document-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type SearchRoutesOptions = {
  authService: AuthService;
  searchDocumentStore: AssistantSearchDocumentStore;
};

const VALID_SOURCE_TYPES: AssistantSearchSourceType[] = [
  "task",
  "comment",
  "affirmation",
  "bilan",
  "reminder",
  "calendarEvent",
  "calendarNote",
  "attachment",
];

const searchQuerySchema = z.object({
  q: z.string().min(2, "Query must be at least 2 characters"),
  types: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
}

const searchRoutes: FastifyPluginAsync<SearchRoutesOptions> = async (app, options) => {
  const { authService, searchDocumentStore } = options;

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

  // GET /api/search?q=...&types=task,reminder&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20
  app.get("/api/search", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      const details = zodIssuesToStrings(parsed.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid query parameters", details);
    }

    const { q, types, from, to, page, limit } = parsed.data;

    const sourceTypes =
      types !== undefined && types.trim().length > 0
        ? types
            .split(",")
            .map((t) => t.trim())
            .filter((t): t is AssistantSearchSourceType =>
              VALID_SOURCE_TYPES.includes(t as AssistantSearchSourceType)
            )
        : undefined;

    let fromDate: Date | undefined;
    if (from !== undefined) {
      fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        return sendError(reply, 400, "VALIDATION_ERROR", "from must be a valid ISO date");
      }
    }

    let toDate: Date | undefined;
    if (to !== undefined) {
      toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        return sendError(reply, 400, "VALIDATION_ERROR", "to must be a valid ISO date");
      }
    }

    try {
      const result = await searchDocumentStore.searchDirect(authUserId, q, {
        sourceTypes,
        from: fromDate,
        to: toDate,
        page,
        limit,
      });

      return reply.send({
        data: {
          results: result.results.map((r) => ({
            sourceType: r.sourceType,
            sourceId: r.sourceId,
            title: r.title,
            snippet: r.snippet,
            score: r.score,
            matchedBy: r.matchedBy,
            metadataJson: r.metadataJson,
            updatedAt: r.updatedAt.toISOString(),
          })),
          totalCount: result.totalCount,
          page,
          limit,
          hasMore: page * limit < result.totalCount,
        },
      });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        return sendStorageNotInitializedError(reply, "Search");
      }
      request.log.error(error, "Failed to perform search");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to perform search");
    }
  });
};

export default searchRoutes;
