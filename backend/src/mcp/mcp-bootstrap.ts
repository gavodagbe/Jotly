import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { createPrismaAssistantContextStore } from "../assistant/assistant-context-store";
import { createPrismaAttachmentStore } from "../attachments/attachment-store";
import { createAssistantContextSearchPlugin } from "../assistant/assistant-context-search-plugin";
import { createAssistantDocumentExtractor } from "../assistant/assistant-document-extractor";
import { createAssistantEmbeddingClient } from "../assistant/assistant-embedding-client";
import { createPrismaAssistantSearchDocumentStore } from "../assistant/assistant-search-document-store";
import { createAssistantSearchSyncService } from "../assistant/assistant-search-sync";
import { createPrismaAuthStore } from "../auth/auth-store";
import { createPrismaCommentStore } from "../comments/comment-store";
import type { AppEnv } from "../config/env";
import { createPrismaDayAffirmationStore } from "../day-affirmation/day-affirmation-store";
import { createPrismaDayBilanStore } from "../day-bilan/day-bilan-store";
import { createPrismaCalendarEventNoteStore } from "../google-calendar/calendar-event-note-store";
import { createPrismaCalendarEventStore } from "../google-calendar/calendar-event-store";
import { createPrismaMonthlyEntryStore } from "../monthly-entry/monthly-entry-store";
import { createPrismaNoteAttachmentStore } from "../notes/note-attachment-store";
import { createPrismaNoteStore } from "../notes/note-store";
import { createPeriodicEntrySearchPlugin } from "../periodic-entry/periodic-entry-search-plugin";
import { createPrismaProjectStore } from "../projects/project-store";
import { createPrismaRecurrenceStore } from "../recurrence/recurrence-store";
import { createPrismaReminderStore } from "../reminders/reminder-store";
import { createTaskSearchPlugin } from "../tasks/task-search-plugin";
import { createPrismaTaskStore } from "../tasks/task-store";
import { createPrismaWeeklyEntryStore } from "../weekly-entry/weekly-entry-store";
import { createPrismaMcpActionLogStore } from "./actions/action-log-store";
import { createPrismaMcpAuditStore } from "./audit-log";
import { loadMcpConfig } from "./mcp-config";
import { registerMcp } from "./mcp-plugin";
import { createGoogleIdentityProvider } from "./oauth/google-identity";
import { OAUTH_PATHS } from "./oauth/metadata-routes";
import { createPrismaMcpOAuthStore } from "./oauth/oauth-store";
import { McpDomainStores } from "./tools/tool-kit";

const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Wires the MCP server from the environment, reusing Jotly's existing stores and
 * search services without modifying them. One shared database client for all MCP
 * stores. Off unless MCP_ENABLED=true.
 */
export function registerMcpFromEnv(app: FastifyInstance, env: AppEnv): void {
  const config = loadMcpConfig(process.env);
  if (!config) return;

  const prisma = new PrismaClient();
  const taskStore = createPrismaTaskStore(prisma);
  const commentStore = createPrismaCommentStore(prisma);
  const attachmentStore = createPrismaAttachmentStore(prisma);
  const weeklyEntryStore = createPrismaWeeklyEntryStore(prisma);
  const monthlyEntryStore = createPrismaMonthlyEntryStore(prisma);
  const searchDocumentStore = createPrismaAssistantSearchDocumentStore(prisma);
  const embeddingClient = createAssistantEmbeddingClient({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_API_BASE_URL,
    model: EMBEDDING_MODEL,
    requestTimeoutMs: env.AI_ASSISTANT_TIMEOUT_MS,
  });

  // Same plugins as the app's own index for the types MCP tools write; syncs are scoped to those types.
  const searchSync = createAssistantSearchSyncService({
    plugins: [
      createTaskSearchPlugin({ taskStore, commentStore, attachmentStore }),
      createAssistantContextSearchPlugin(createPrismaAssistantContextStore(prisma)),
      createPeriodicEntrySearchPlugin({ weeklyEntryStore, monthlyEntryStore }),
    ],
    searchDocumentStore,
    documentExtractor: createAssistantDocumentExtractor(),
    embeddingClient,
    embeddingModel: EMBEDDING_MODEL,
  });

  const stores: McpDomainStores = {
    taskStore,
    reminderStore: createPrismaReminderStore(prisma),
    dayAffirmationStore: createPrismaDayAffirmationStore(prisma),
    dayBilanStore: createPrismaDayBilanStore(prisma),
    projectStore: createPrismaProjectStore(prisma),
    weeklyEntryStore,
    monthlyEntryStore,
    recurrenceStore: createPrismaRecurrenceStore(prisma),
    memory: {
      searchDocumentStore,
      embeddingClient,
      noteStore: createPrismaNoteStore(prisma),
      noteAttachmentStore: createPrismaNoteAttachmentStore(prisma),
      calendarEventStore: createPrismaCalendarEventStore(prisma),
      calendarEventNoteStore: createPrismaCalendarEventNoteStore(prisma),
      commentStore,
      attachmentStore,
    },
  };

  registerMcp(app, {
    config,
    oauthStore: createPrismaMcpOAuthStore(prisma),
    authStore: createPrismaAuthStore(prisma),
    auditStore: createPrismaMcpAuditStore(prisma),
    actionLog: createPrismaMcpActionLogStore(prisma),
    stores,
    reindex: (userId, sourceTypes) => {
      searchSync.syncUserWorkspace(userId, { onlySourceTypes: sourceTypes }).catch((error) => {
        app.log.warn({ err: error }, "MCP search reindex failed");
      });
    },
    google: createGoogleIdentityProvider({
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      redirectUri: `${config.baseUrl}${OAUTH_PATHS.googleCallback}`,
    }),
  });
  app.log.info({ resource: config.resourceUrl }, "MCP server enabled");
}
