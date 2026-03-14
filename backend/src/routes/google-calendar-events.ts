import { FastifyPluginAsync } from "fastify";
import { CalendarEventNote, Task } from "@prisma/client";
import { z } from "zod";
import { AssistantSearchSyncService } from "../assistant/assistant-search-sync";
import { AuthService } from "../auth/auth-service";
import { CalendarEventStore } from "../google-calendar/calendar-event-store";
import { CalendarEventNoteStore } from "../google-calendar/calendar-event-note-store";
import { GoogleCalendarSyncService } from "../google-calendar/google-calendar-sync-service";
import { parseDateOnly, formatDateOnly, TaskStore } from "../tasks/task-store";
import {
  getBearerToken,
  sendError,
} from "./route-helpers";
import { triggerAssistantSearchSync } from "./assistant-search-sync-helpers";

type GoogleCalendarEventsRoutesOptions = {
  authService: AuthService;
  calendarEventStore: CalendarEventStore;
  calendarEventNoteStore?: CalendarEventNoteStore;
  taskStore: TaskStore;
  googleCalendarSyncService: GoogleCalendarSyncService;
  assistantSearchSyncService?: AssistantSearchSyncService;
};

const dateQuerySchema = z.object({
  date: z.string().refine((v) => parseDateOnly(v) !== null, {
    message: "date must be a valid date in YYYY-MM-DD format",
  }),
});

const dateRangeQuerySchema = z.object({
  start: z.string().refine((v) => parseDateOnly(v) !== null, {
    message: "start must be a valid date in YYYY-MM-DD format",
  }),
  end: z.string().refine((v) => parseDateOnly(v) !== null, {
    message: "end must be a valid date in YYYY-MM-DD format",
  }),
});

const calendarEventIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Calendar event id is required"),
});

const updateCalendarEventNoteBodySchema = z.object({
  body: z.string().trim().min(1, "Note body is required").max(5000, "Note body is too long"),
});

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
}

function getAuthenticatedUserTimeZone(request: { authUserTimeZone?: string | null }): string | null {
  return request.authUserTimeZone ?? null;
}

function serializeLinkedTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    targetDate: formatDateOnly(task.targetDate),
    dueDate: task.dueDate ? formatDateOnly(task.dueDate) : null,
    priority: task.priority,
    project: task.project,
  };
}

function serializeCalendarEventNote(note: CalendarEventNote | null) {
  if (!note) {
    return null;
  }

  return {
    id: note.id,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

function serializeCalendarEvent(
  event: {
  id: string;
  connectionId: string;
  googleEventId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  htmlLink: string | null;
  attendees: string | null;
  organizer: string | null;
  recurringEventId: string | null;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
},
  options?: {
    note?: CalendarEventNote | null;
    linkedTasks?: Task[];
  }
) {
  return {
    id: event.id,
    connectionId: event.connectionId,
    googleEventId: event.googleEventId,
    title: event.title,
    description: event.description,
    location: event.location,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
    isAllDay: event.isAllDay,
    startDate: event.startDate ? formatDateOnly(event.startDate) : null,
    endDate: event.endDate ? formatDateOnly(event.endDate) : null,
    status: event.status,
    htmlLink: event.htmlLink,
    attendees: event.attendees ? JSON.parse(event.attendees) : null,
    organizer: event.organizer ? JSON.parse(event.organizer) : null,
    recurringEventId: event.recurringEventId,
    syncedAt: event.syncedAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    note: serializeCalendarEventNote(options?.note ?? null),
    linkedTasks: (options?.linkedTasks ?? []).map(serializeLinkedTask),
  };
}

const googleCalendarEventsRoutes: FastifyPluginAsync<GoogleCalendarEventsRoutesOptions> = async (
  app,
  options
) => {
  const {
    authService,
    calendarEventStore,
    calendarEventNoteStore,
    taskStore,
    googleCalendarSyncService,
    assistantSearchSyncService,
  } = options;

  async function hydrateCalendarEvents(
    events: Awaited<ReturnType<CalendarEventStore["listByDate"]>>,
    userId: string
  ) {
    const eventIds = events.map((event) => event.id);
    const [notes, tasks] = await Promise.all([
      calendarEventNoteStore?.listByCalendarEventIds(eventIds, userId) ?? Promise.resolve([]),
      taskStore.listByUser(userId),
    ]);

    const noteByEventId = new Map(notes.map((note) => [note.calendarEventId, note]));
    const linkedTasksByEventId = new Map<string, Task[]>();

    for (const task of tasks) {
      if (!task.calendarEventId || !eventIds.includes(task.calendarEventId)) {
        continue;
      }

      const existing = linkedTasksByEventId.get(task.calendarEventId) ?? [];
      existing.push(task);
      linkedTasksByEventId.set(task.calendarEventId, existing);
    }

    return events.map((event) =>
      serializeCalendarEvent(event, {
        note: noteByEventId.get(event.id) ?? null,
        linkedTasks: linkedTasksByEventId.get(event.id) ?? [],
      })
    );
  }

  app.addHook("preHandler", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    if (!token) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
    const authContext = await authService.authenticateBearerToken(token);
    if (!authContext) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
    (request as { authUserId?: string; authUserTimeZone?: string | null }).authUserId =
      authContext.user.id;
    (request as { authUserTimeZone?: string | null }).authUserTimeZone =
      authContext.user.preferredTimeZone ?? null;
  });

  // POST /api/google-calendar/sync — trigger sync
  app.post("/api/google-calendar/sync", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    try {
      const result = await googleCalendarSyncService.syncEventsForUser(authUserId);

      triggerAssistantSearchSync(
        assistantSearchSyncService,
        authUserId,
        request.log,
        "google calendar sync"
      );

      return reply.send({
        data: {
          syncedCount: result.syncedCount,
          lastSyncedAt: result.lastSyncedAt.toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      if (message === "GOOGLE_CALENDAR_NOT_CONNECTED") {
        return sendError(reply, 400, "VALIDATION_ERROR", "Google Calendar is not connected");
      }
      if (message === "GOOGLE_CALENDAR_RECONNECT_REQUIRED") {
        return sendError(reply, 400, "VALIDATION_ERROR", "Google Calendar reconnection required. Please reconnect your account.");
      }
      request.log.error(error, "Google Calendar sync failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to sync calendar events");
    }
  });

  // GET /api/google-calendar/events?date=YYYY-MM-DD or ?start=...&end=...
  app.get("/api/google-calendar/events", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const query = request.query as Record<string, string>;

    // Try single date query first
    if (query.date) {
      const dateResult = dateQuerySchema.safeParse(query);
      if (!dateResult.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid date parameter");
      }
      const date = parseDateOnly(dateResult.data.date)!;
      const timeZone = getAuthenticatedUserTimeZone(
        request as { authUserTimeZone?: string | null }
      );
      try {
        const events = await calendarEventStore.listByDate(date, authUserId, timeZone);
        return reply.send({ data: await hydrateCalendarEvents(events, authUserId) });
      } catch (error) {
        request.log.error(error, "Failed to load calendar events");
        return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load calendar events");
      }
    }

    // Try date range query
    if (query.start && query.end) {
      const rangeResult = dateRangeQuerySchema.safeParse(query);
      if (!rangeResult.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid start/end date parameters");
      }
      const startDate = parseDateOnly(rangeResult.data.start)!;
      const endDate = parseDateOnly(rangeResult.data.end)!;
      const timeZone = getAuthenticatedUserTimeZone(
        request as { authUserTimeZone?: string | null }
      );

      if (endDate <= startDate) {
        return sendError(reply, 400, "VALIDATION_ERROR", "end date must be after start date");
      }

      // Max 90-day range
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 90) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Date range must not exceed 90 days");
      }

      try {
        const events = await calendarEventStore.listByDateRange(
          startDate,
          endDate,
          authUserId,
          timeZone
        );
        return reply.send({ data: await hydrateCalendarEvents(events, authUserId) });
      } catch (error) {
        request.log.error(error, "Failed to load calendar events");
        return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load calendar events");
      }
    }

    return sendError(reply, 400, "VALIDATION_ERROR", "Either date or start+end query parameters are required");
  });

  // GET /api/google-calendar/events/:id
  app.get("/api/google-calendar/events/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = calendarEventIdParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Calendar event id is required");
    }

    try {
      const event = await calendarEventStore.getById(paramsResult.data.id, authUserId);
      if (!event) {
        return sendError(reply, 404, "NOT_FOUND", "Calendar event not found");
      }
      const [note, tasks] = await Promise.all([
        calendarEventNoteStore?.getByCalendarEventId(event.id, authUserId) ?? Promise.resolve(null),
        taskStore.listByUser(authUserId),
      ]);
      return reply.send({
        data: serializeCalendarEvent(event, {
          note,
          linkedTasks: tasks.filter((task) => task.calendarEventId === event.id),
        }),
      });
    } catch (error) {
      request.log.error(error, "Failed to load calendar event");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load calendar event");
    }
  });

  app.put("/api/google-calendar/events/:id/note", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = calendarEventIdParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Calendar event id is required");
    }

    const bodyResult = updateCalendarEventNoteBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Note body is required");
    }

    try {
      const event = await calendarEventStore.getById(paramsResult.data.id, authUserId);
      if (!event) {
        return sendError(reply, 404, "NOT_FOUND", "Calendar event not found");
      }

      if (!calendarEventNoteStore) {
        return sendError(reply, 500, "INTERNAL_ERROR", "Calendar event note storage is unavailable");
      }

      const note = await calendarEventNoteStore.upsert(event.id, authUserId, bodyResult.data.body);

      triggerAssistantSearchSync(
        assistantSearchSyncService,
        authUserId,
        request.log,
        "calendar note save"
      );

      return reply.send({ data: serializeCalendarEventNote(note) });
    } catch (error) {
      request.log.error(error, "Failed to save calendar event note");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to save calendar event note");
    }
  });

  app.delete("/api/google-calendar/events/:id/note", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = calendarEventIdParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Calendar event id is required");
    }

    try {
      const event = await calendarEventStore.getById(paramsResult.data.id, authUserId);
      if (!event) {
        return sendError(reply, 404, "NOT_FOUND", "Calendar event not found");
      }

      if (!calendarEventNoteStore) {
        return sendError(reply, 500, "INTERNAL_ERROR", "Calendar event note storage is unavailable");
      }

      await calendarEventNoteStore.deleteByCalendarEventId(event.id, authUserId);

      triggerAssistantSearchSync(
        assistantSearchSyncService,
        authUserId,
        request.log,
        "calendar note delete"
      );

      return reply.send({ data: { deleted: true } });
    } catch (error) {
      request.log.error(error, "Failed to delete calendar event note");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete calendar event note");
    }
  });
};

export default googleCalendarEventsRoutes;
