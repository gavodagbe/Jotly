import Fastify, { FastifyInstance } from "fastify";
import {
  createPrismaAssistantContextStore,
  AssistantContextStore,
} from "./assistant/assistant-context-store";
import {
  createAssistantEmbeddingClient,
  AssistantEmbeddingClient,
} from "./assistant/assistant-embedding-client";
import {
  createAssistantDocumentExtractor,
  AssistantDocumentExtractor,
} from "./assistant/assistant-document-extractor";
import {
  createPrismaAssistantSearchDocumentStore,
  AssistantSearchDocumentStore,
} from "./assistant/assistant-search-document-store";
import {
  createAssistantSearchRetriever,
  AssistantSearchRetriever,
} from "./assistant/assistant-search-retriever";
import {
  createAssistantSearchSyncService,
  AssistantSearchSyncService,
  SearchIndexPlugin,
} from "./assistant/assistant-search-sync";
import { createTaskSearchPlugin } from "./tasks/task-search-plugin";
import { createAssistantContextSearchPlugin } from "./assistant/assistant-context-search-plugin";
import { createNoteSearchPlugin } from "./notes/note-search-plugin";
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
import noteRoutes from "./routes/notes";
import reminderRoutes from "./routes/reminders";
import searchRoutes from "./routes/search";
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
  createPrismaCalendarEventNoteAttachmentStore,
  CalendarEventNoteAttachmentStore,
} from "./google-calendar/calendar-event-note-attachment-store";
import {
  createGoogleCalendarSyncService,
  GoogleCalendarSyncService,
} from "./google-calendar/google-calendar-sync-service";
import { createPrismaRecurrenceStore, RecurrenceStore } from "./recurrence/recurrence-store";
import { createPrismaNoteAttachmentStore, NoteAttachmentStore } from "./notes/note-attachment-store";
import { createPrismaNoteStore, NoteStore } from "./notes/note-store";
import { createPrismaReminderAttachmentStore, ReminderAttachmentStore } from "./reminders/reminder-attachment-store";
import { createPrismaReminderStore, ReminderStore } from "./reminders/reminder-store";
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
  noteStore?: NoteStore;
  noteAttachmentStore?: NoteAttachmentStore;
  reminderStore?: ReminderStore;
  reminderAttachmentStore?: ReminderAttachmentStore;
  profileStore?: ProfileStore;
  assistantContextStore?: AssistantContextStore;
  assistantSearchDocumentStore?: AssistantSearchDocumentStore;
  assistantSearchRetriever?: AssistantSearchRetriever;
  assistantSearchSyncService?: AssistantSearchSyncService;
  assistantService?: AssistantService;
  assistantProvider?: "openai" | "heuristic";
  openAiApiKey?: string;
  openAiModel?: string;
  openAiEmbeddingModel?: string;
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
  calendarEventNoteAttachmentStore?: CalendarEventNoteAttachmentStore;
  googleCalendarSyncService?: GoogleCalendarSyncService;
};

const APP_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

function buildSearchPlugins(options: {
  taskStore: TaskStore;
  commentStore?: CommentStore;
  attachmentStore?: AttachmentStore;
  assistantContextStore?: AssistantContextStore;
  noteStore?: NoteStore;
  noteAttachmentStore?: NoteAttachmentStore;
}): SearchIndexPlugin[] {
  const plugins: SearchIndexPlugin[] = [];

  plugins.push(
    createTaskSearchPlugin({
      taskStore: options.taskStore,
      commentStore: options.commentStore,
      attachmentStore: options.attachmentStore,
    })
  );

  if (options.assistantContextStore) {
    plugins.push(createAssistantContextSearchPlugin(options.assistantContextStore));
  }

  if (options.noteStore) {
    plugins.push(
      createNoteSearchPlugin({
        noteStore: options.noteStore,
        noteAttachmentStore: options.noteAttachmentStore,
      })
    );
  }

  return plugins;
}

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
  const noteStore =
    options.noteStore ??
    (options.taskStore ? undefined : createPrismaNoteStore());
  const noteAttachmentStore =
    options.noteAttachmentStore ??
    (options.taskStore ? undefined : createPrismaNoteAttachmentStore());
  const reminderStore =
    options.reminderStore ??
    (options.taskStore ? undefined : createPrismaReminderStore());
  const reminderAttachmentStore =
    options.reminderAttachmentStore ??
    (options.taskStore ? undefined : createPrismaReminderAttachmentStore());
  const gamingTrackStore =
    options.gamingTrackStore ??
    (options.taskStore ? undefined : createPrismaGamingTrackStore());
  const gamingTrackService =
    options.gamingTrackService ??
    (gamingTrackStore ? createGamingTrackService(gamingTrackStore) : undefined);
  const profileStore =
    options.profileStore ??
    (options.authStore ? undefined : createPrismaProfileStore());
  const assistantContextStore =
    options.assistantContextStore ??
    (options.taskStore || options.authStore ? undefined : createPrismaAssistantContextStore());
  const assistantSearchDocumentStore =
    options.assistantSearchDocumentStore ??
    (options.taskStore || options.authStore
      ? undefined
      : createPrismaAssistantSearchDocumentStore());
  const assistantEmbeddingClient: AssistantEmbeddingClient = createAssistantEmbeddingClient({
    apiKey: options.openAiApiKey,
    baseUrl: options.openAiBaseUrl ?? "https://api.openai.com/v1",
    model: options.openAiEmbeddingModel ?? "text-embedding-3-small",
    requestTimeoutMs: options.assistantRequestTimeoutMs ?? 10000,
  });
  const assistantDocumentExtractor: AssistantDocumentExtractor =
    createAssistantDocumentExtractor();
  const assistantSearchSyncService =
    options.assistantSearchSyncService ??
    (assistantSearchDocumentStore
      ? createAssistantSearchSyncService({
          plugins: buildSearchPlugins({
            taskStore,
            commentStore,
            attachmentStore,
            assistantContextStore,
            noteStore,
            noteAttachmentStore,
          }),
          searchDocumentStore: assistantSearchDocumentStore,
          documentExtractor: assistantDocumentExtractor,
          embeddingClient: assistantEmbeddingClient,
          embeddingModel: options.openAiEmbeddingModel ?? "text-embedding-3-small",
        })
      : undefined);
  const assistantSearchRetriever =
    options.assistantSearchRetriever ??
    (assistantSearchDocumentStore
      ? createAssistantSearchRetriever({
          searchDocumentStore: assistantSearchDocumentStore,
          embeddingClient: assistantEmbeddingClient,
        })
      : undefined);
  const assistantService =
    options.assistantService ??
    createAssistantService({
      provider: options.assistantProvider ?? "heuristic",
      openAiApiKey: options.openAiApiKey,
      openAiModel: options.openAiModel ?? "gpt-4o-mini",
      openAiBaseUrl: options.openAiBaseUrl ?? "https://api.openai.com/v1",
      requestTimeoutMs: options.assistantRequestTimeoutMs ?? 10000,
      taskStore,
      commentStore,
      assistantContextStore,
      assistantSearchRetriever,
      assistantSearchSyncService,
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
  const calendarEventNoteAttachmentStore =
    options.calendarEventNoteAttachmentStore ??
    (calendarEventNoteStore ? createPrismaCalendarEventNoteAttachmentStore() : undefined);
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
    app.register(attachmentsRoutes, {
      taskStore,
      attachmentStore,
      authService,
      assistantSearchSyncService,
    });
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
  if (noteStore) {
    app.register(noteRoutes, {
      noteStore,
      noteAttachmentStore,
      calendarEventStore,
      authService,
      assistantSearchSyncService,
    });
  }
  if (reminderStore) {
    app.register(reminderRoutes, { reminderStore, reminderAttachmentStore, authService });
  }
  if (gamingTrackService) {
    app.register(gamingTrackRoutes, { gamingTrackService, authService });
  }
  if (googleCalendarOAuthService) {
    app.register(googleCalendarOAuthRoutes, {
      authService,
      authStore,
      taskStore,
      googleCalendarOAuthService,
      googleCalendarConnectionStore,
      calendarEventStore,
      frontendOrigin: options.frontendOrigin,
    });
  }
  if (googleCalendarSyncService && calendarEventStore && noteStore) {
    app.register(googleCalendarEventsRoutes, {
      authService,
      calendarEventStore,
      noteStore,
      noteAttachmentStore,
      taskStore,
      googleCalendarSyncService,
    });
  }
  if (assistantSearchDocumentStore) {
    app.register(searchRoutes, {
      authService,
      searchDocumentStore: assistantSearchDocumentStore,
    });
  }
  app.register(assistantRoutes, {
    authService,
    assistantService,
  });

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

    if (assistantContextStore?.close) {
      await assistantContextStore.close();
    }

    if (assistantSearchDocumentStore?.close) {
      await assistantSearchDocumentStore.close();
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

    if (noteStore?.close) {
      await noteStore.close();
    }

    if (noteAttachmentStore?.close) {
      await noteAttachmentStore.close();
    }

    if (reminderStore?.close) {
      await reminderStore.close();
    }

    if (reminderAttachmentStore?.close) {
      await reminderAttachmentStore.close();
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

    if (calendarEventNoteAttachmentStore?.close) {
      await calendarEventNoteAttachmentStore.close();
    }
  });

  return app;
}
