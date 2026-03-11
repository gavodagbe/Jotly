import Fastify, { FastifyInstance } from "fastify";
import {
  createAssistantService,
  AssistantService,
} from "./assistant/assistant-service";
import { createPrismaAttachmentStore, AttachmentStore } from "./attachments/attachment-store";
import { createAuthService } from "./auth/auth-service";
import { createPrismaAuthStore, AuthStore } from "./auth/auth-store";
import { createPrismaCommentStore, CommentStore } from "./comments/comment-store";
import { createPrismaDayAffirmationStore, DayAffirmationStore } from "./day-affirmation/day-affirmation-store";
import { createPrismaDayBilanStore, DayBilanStore } from "./day-bilan/day-bilan-store";
import { createPrismaGamingTrackStore, GamingTrackStore } from "./gaming-track/gaming-track-store";
import { createGamingTrackService, GamingTrackService } from "./gaming-track/gaming-track-service";
import { createPrismaProfileStore, ProfileStore } from "./profile/profile-store";
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import attachmentsRoutes from "./routes/attachments";
import assistantRoutes from "./routes/assistant";
import commentsRoutes from "./routes/comments";
import dayAffirmationRoutes from "./routes/day-affirmation";
import dayBilanRoutes from "./routes/day-bilan";
import gamingTrackRoutes from "./routes/gaming-track";
import profileRoutes from "./routes/profile";
import recurrenceRoutes from "./routes/recurrence";
import tasksRoutes from "./routes/tasks";
import {
  createPrismaGoogleCalendarConnectionStore,
  GoogleCalendarConnectionStore,
} from "./google-calendar/google-calendar-store";
import {
  createGoogleCalendarOAuthService,
  GoogleCalendarOAuthService,
} from "./google-calendar/google-calendar-oauth-service";
import {
  createGoogleOAuth2ClientFactory,
  GoogleOAuth2ClientFactory,
} from "./google-auth/google-oauth2-client-factory";
import googleCalendarOAuthRoutes from "./routes/google-calendar-oauth";
import googleCalendarEventsRoutes from "./routes/google-calendar-events";
import {
  createPrismaCalendarEventStore,
  CalendarEventStore,
} from "./google-calendar/calendar-event-store";
import {
  createPrismaCalendarEventNoteStore,
  CalendarEventNoteStore,
} from "./google-calendar/calendar-event-note-store";
import {
  createGoogleCalendarSyncService,
  GoogleCalendarSyncService,
} from "./google-calendar/google-calendar-sync-service";
import { createPrismaRecurrenceStore, RecurrenceStore } from "./recurrence/recurrence-store";
import { createPrismaTaskStore, TaskStore } from "./tasks/task-store";

export type BuildAppOptions = {
  logLevel: string;
  taskStore?: TaskStore;
  authStore?: AuthStore;
  commentStore?: CommentStore;
  attachmentStore?: AttachmentStore;
  recurrenceStore?: RecurrenceStore;
  dayAffirmationStore?: DayAffirmationStore;
  dayBilanStore?: DayBilanStore;
  gamingTrackStore?: GamingTrackStore;
  gamingTrackService?: GamingTrackService;
  profileStore?: ProfileStore;
  assistantService?: AssistantService;
  assistantProvider?: "openai" | "heuristic";
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
  assistantRequestTimeoutMs?: number;
  authSessionTtlHours?: number;
  googleCalendarConnectionStore?: GoogleCalendarConnectionStore;
  googleCalendarOAuthService?: GoogleCalendarOAuthService;
  googleOAuth2ClientFactory?: GoogleOAuth2ClientFactory;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  googleCalendarEncryptionKey?: string;
  frontendOrigin?: string;
  calendarEventStore?: CalendarEventStore;
  calendarEventNoteStore?: CalendarEventNoteStore;
  googleCalendarSyncService?: GoogleCalendarSyncService;
};

const APP_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    bodyLimit: APP_BODY_LIMIT_BYTES,
    logger: {
      level: options.logLevel
    }
  });

  const taskStore = options.taskStore ?? createPrismaTaskStore();
  const authStore = options.authStore ?? createPrismaAuthStore();
  const commentStore =
    options.commentStore ??
    (options.taskStore ? undefined : createPrismaCommentStore());
  const attachmentStore =
    options.attachmentStore ??
    (options.taskStore ? undefined : createPrismaAttachmentStore());
  const recurrenceStore =
    options.recurrenceStore ??
    (options.taskStore ? undefined : createPrismaRecurrenceStore());
  const dayAffirmationStore =
    options.dayAffirmationStore ??
    (options.taskStore ? undefined : createPrismaDayAffirmationStore());
  const dayBilanStore =
    options.dayBilanStore ??
    (options.taskStore ? undefined : createPrismaDayBilanStore());
  const gamingTrackStore =
    options.gamingTrackStore ??
    (options.taskStore ? undefined : createPrismaGamingTrackStore());
  const gamingTrackService =
    options.gamingTrackService ??
    (gamingTrackStore ? createGamingTrackService(gamingTrackStore) : undefined);
  const profileStore =
    options.profileStore ??
    (options.authStore ? undefined : createPrismaProfileStore());
  const assistantService =
    options.assistantService ??
    createAssistantService({
      provider: options.assistantProvider ?? "heuristic",
      openAiApiKey: options.openAiApiKey,
      openAiModel: options.openAiModel ?? "gpt-4o-mini",
      openAiBaseUrl: options.openAiBaseUrl ?? "https://api.openai.com/v1",
      requestTimeoutMs: options.assistantRequestTimeoutMs ?? 10000,
    });
  const googleCalendarConnectionStore =
    options.googleCalendarConnectionStore ??
    (options.googleClientId ? createPrismaGoogleCalendarConnectionStore() : undefined);
  const googleOAuth2ClientFactory =
    options.googleOAuth2ClientFactory ??
    (options.googleClientId &&
    options.googleClientSecret &&
    options.googleRedirectUri
      ? createGoogleOAuth2ClientFactory({
          clientId: options.googleClientId,
          clientSecret: options.googleClientSecret,
          redirectUri: options.googleRedirectUri,
        })
      : undefined);
  const googleCalendarOAuthService =
    options.googleCalendarOAuthService ??
    (googleCalendarConnectionStore &&
    googleOAuth2ClientFactory &&
    options.googleCalendarEncryptionKey
      ? createGoogleCalendarOAuthService({
          oauth2ClientFactory: googleOAuth2ClientFactory,
          encryptionKey: options.googleCalendarEncryptionKey,
          connectionStore: googleCalendarConnectionStore,
        })
      : undefined);
  const calendarEventStore =
    options.calendarEventStore ??
    (googleCalendarConnectionStore ? createPrismaCalendarEventStore() : undefined);
  const calendarEventNoteStore =
    options.calendarEventNoteStore ??
    (calendarEventStore ? createPrismaCalendarEventNoteStore() : undefined);
  const googleCalendarSyncService =
    options.googleCalendarSyncService ??
    (googleCalendarOAuthService &&
    googleOAuth2ClientFactory &&
    googleCalendarConnectionStore &&
    calendarEventStore
      ? createGoogleCalendarSyncService({
          oauthService: googleCalendarOAuthService,
          oauth2ClientFactory: googleOAuth2ClientFactory,
          connectionStore: googleCalendarConnectionStore,
          eventStore: calendarEventStore,
        })
      : undefined);
  const authService = createAuthService({
    authStore,
    sessionTtlMs: (options.authSessionTtlHours ?? 168) * 60 * 60 * 1000
  });

  app.register(healthRoutes);
  app.register(authRoutes, { authService });
  if (profileStore) {
    app.register(profileRoutes, { authService, profileStore });
  }
  app.register(tasksRoutes, { taskStore, authService, recurrenceStore, calendarEventStore });
  if (commentStore) {
    app.register(commentsRoutes, { taskStore, commentStore, authService });
  }

  if (attachmentStore) {
    app.register(attachmentsRoutes, { taskStore, attachmentStore, authService });
  }

  if (recurrenceStore) {
    app.register(recurrenceRoutes, { taskStore, recurrenceStore, authService });
  }
  if (dayAffirmationStore) {
    app.register(dayAffirmationRoutes, { dayAffirmationStore, authService });
  }
  if (dayBilanStore) {
    app.register(dayBilanRoutes, { dayBilanStore, authService });
  }
  if (gamingTrackService) {
    app.register(gamingTrackRoutes, { gamingTrackService, authService });
  }
  if (googleCalendarOAuthService) {
    app.register(googleCalendarOAuthRoutes, {
      authService,
      googleCalendarOAuthService,
      googleCalendarConnectionStore,
      calendarEventStore,
      frontendOrigin: options.frontendOrigin,
    });
  }
  if (googleCalendarSyncService && calendarEventStore) {
    app.register(googleCalendarEventsRoutes, {
      authService,
      calendarEventStore,
      calendarEventNoteStore,
      taskStore,
      googleCalendarSyncService,
    });
  }
  app.register(assistantRoutes, { taskStore, commentStore, authService, assistantService });

  app.setErrorHandler((error, request, reply) => {
    const candidateStatusCode = (error as { statusCode?: number }).statusCode;
    const statusCode =
      typeof candidateStatusCode === "number" &&
      candidateStatusCode >= 400 &&
      candidateStatusCode < 500
        ? candidateStatusCode
        : 500;
    const isClientError = statusCode >= 400 && statusCode < 500;
    const clientMessage = error instanceof Error ? error.message : "Invalid request";

    if (isClientError) {
      request.log.warn(error, "Client request error");
    } else {
      request.log.error(error, "Unhandled request error");
    }

    return reply.code(statusCode).send({
      error: {
        code: isClientError ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
        message: isClientError ? clientMessage : "An unexpected error occurred"
      }
    });
  });

  app.addHook("onClose", async () => {
    if (taskStore.close) {
      await taskStore.close();
    }

    if (authStore.close) {
      await authStore.close();
    }

    if (commentStore?.close) {
      await commentStore.close();
    }

    if (attachmentStore?.close) {
      await attachmentStore.close();
    }

    if (recurrenceStore?.close) {
      await recurrenceStore.close();
    }

    if (dayAffirmationStore?.close) {
      await dayAffirmationStore.close();
    }

    if (dayBilanStore?.close) {
      await dayBilanStore.close();
    }

    if (gamingTrackStore?.close) {
      await gamingTrackStore.close();
    }

    if (profileStore?.close) {
      await profileStore.close();
    }

    if (googleCalendarConnectionStore?.close) {
      await googleCalendarConnectionStore.close();
    }

    if (calendarEventStore?.close) {
      await calendarEventStore.close();
    }

    if (calendarEventNoteStore?.close) {
      await calendarEventNoteStore.close();
    }
  });

  return app;
}
