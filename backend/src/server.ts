import { buildApp } from "./app";
import { getEnv } from "./config/env";
import { createPrismaAuthStore } from "./auth/auth-store";
import { loadMcpConfig } from "./mcp/mcp-config";
import { registerMcp } from "./mcp/mcp-plugin";
import { createGoogleIdentityProvider } from "./mcp/oauth/google-identity";
import { OAUTH_PATHS } from "./mcp/oauth/metadata-routes";
import { createPrismaMcpOAuthStore } from "./mcp/oauth/oauth-store";
import { createPrismaMcpAuditStore } from "./mcp/audit-log";
import { createPrismaDayAffirmationStore } from "./day-affirmation/day-affirmation-store";
import { createPrismaDayBilanStore } from "./day-bilan/day-bilan-store";
import { createPrismaProjectStore } from "./projects/project-store";
import { createPrismaRecurrenceStore } from "./recurrence/recurrence-store";
import { createPrismaReminderStore } from "./reminders/reminder-store";
import { createPrismaTaskStore } from "./tasks/task-store";
import { createPrismaWeeklyEntryStore } from "./weekly-entry/weekly-entry-store";
import { createPrismaMonthlyEntryStore } from "./monthly-entry/monthly-entry-store";

async function start(): Promise<void> {
  const env = getEnv();
  const app = buildApp({
    logLevel: env.LOG_LEVEL,
    authSessionTtlHours: env.AUTH_SESSION_TTL_HOURS,
    assistantProvider: env.AI_ASSISTANT_PROVIDER,
    openAiApiKey: env.OPENAI_API_KEY,
    openAiModel: env.OPENAI_MODEL,
    openAiBaseUrl: env.OPENAI_API_BASE_URL,
    assistantRequestTimeoutMs: env.AI_ASSISTANT_TIMEOUT_MS,
    frontendOrigin: env.FRONTEND_ORIGIN,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: env.GOOGLE_REDIRECT_URI,
    googleCalendarEncryptionKey: env.GOOGLE_CALENDAR_ENCRYPTION_KEY,
  });

  // MCP server for LLM clients (ChatGPT, Claude); off unless MCP_ENABLED=true.
  const mcpConfig = loadMcpConfig(process.env);
  if (mcpConfig) {
    registerMcp(app, {
      config: mcpConfig,
      oauthStore: createPrismaMcpOAuthStore(),
      authStore: createPrismaAuthStore(),
      auditStore: createPrismaMcpAuditStore(),
      stores: {
        taskStore: createPrismaTaskStore(),
        reminderStore: createPrismaReminderStore(),
        dayAffirmationStore: createPrismaDayAffirmationStore(),
        dayBilanStore: createPrismaDayBilanStore(),
        projectStore: createPrismaProjectStore(),
        weeklyEntryStore: createPrismaWeeklyEntryStore(),
        monthlyEntryStore: createPrismaMonthlyEntryStore(),
        recurrenceStore: createPrismaRecurrenceStore(),
      },
      google: createGoogleIdentityProvider({
        clientId: mcpConfig.googleClientId,
        clientSecret: mcpConfig.googleClientSecret,
        redirectUri: `${mcpConfig.baseUrl}${OAUTH_PATHS.googleCallback}`,
      }),
    });
    app.log.info({ resource: mcpConfig.resourceUrl }, "MCP server enabled");
  }

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    app.log.error(error, "Unable to start backend server");
    process.exit(1);
  }
}

void start();
