import { FastifyPluginAsync } from "fastify";
import { NoteAttachment, Task } from "@prisma/client";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { CalendarEventStore } from "../google-calendar/calendar-event-store";
import { GoogleCalendarSyncService } from "../google-calendar/google-calendar-sync-service";
import { NoteAttachmentStore } from "../notes/note-attachment-store";
import { NoteStore, StoredNote } from "../notes/note-store";
import { parseDateOnly, formatDateOnly, TaskStore } from "../tasks/task-store";
import {
  getBearerToken,
  sendError,
} from "./route-helpers";

const MAX_CALENDAR_NOTE_ATTACHMENT_BYTES = 5 * 1024 * 1024;

type GoogleCalendarEventsRoutesOptions = {
  authService: AuthService;
  calendarEventStore: CalendarEventStore;
  noteStore: NoteStore;
  noteAttachmentStore?: NoteAttachmentStore;
  taskStore: TaskStore;
  googleCalendarSyncService: GoogleCalendarSyncService;
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

function serializeCalendarEventNote(note: StoredNote | null) {
  if (!note) {
    return null;
  }

  return {
    id: note.id,
    title: note.title,
    body: note.body,
    color: note.color,
    targetDate: note.targetDate ? formatDateOnly(note.targetDate) : null,
    calendarEventId: note.calendarEventId,
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
    note?: StoredNote | null;
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

function serializeCalendarEventNoteAttachment(attachment: NoteAttachment) {
  return {
    id: attachment.id,
    calendarEventNoteId: attachment.noteId,
    name: attachment.name,
    url: attachment.url,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt.toISOString(),
  };
}

function getCalendarEventTargetDate(event: { startDate: Date | null; startTime: Date }): Date | null {
  if (event.startDate) {
    return event.startDate;
  }

  return parseDateOnly(event.startTime.toISOString().substring(0, 10));
}

const googleCalendarEventsRoutes: FastifyPluginAsync<GoogleCalendarEventsRoutesOptions> = async (
  app,
  options
) => {
  const {
    authService,
    calendarEventStore,
    noteStore,
    noteAttachmentStore,
    taskStore,
    googleCalendarSyncService,
  } = options;

  async function hydrateCalendarEvents(
    events: Awaited<ReturnType<CalendarEventStore["listByDate"]>>,
    userId: string
  ) {
    const eventIds = events.map((event) => event.id);
    const [notes, tasks] = await Promise.all([
      noteStore.listByCalendarEventIds(eventIds, userId),
      taskStore.listByUser(userId),
    ]);

    const noteByEventId = new Map(
      notes
        .filter((note) => typeof note.calendarEventId === "string")
        .map((note) => [note.calendarEventId as string, note])
    );
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

  app.post("/api/google-calendar/sync", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    try {
      const result = await googleCalendarSyncService.syncEventsForUser(authUserId);
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
      if (message === "GOOGLE_CALENDAR_INVALID_SELECTION") {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Selected Google Calendar is no longer available. Please choose another calendar."
        );
      }
      if (message === "GOOGLE_CALENDAR_ACCESS_CHANGED") {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Google Calendar access changed. Please reconnect your account or choose another calendar."
        );
      }
      request.log.error(error, "Google Calendar sync failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to sync calendar events");
    }
  });

  app.get("/api/google-calendar/events", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const query = request.query as Record<string, string>;

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
        noteStore.getByCalendarEventId(event.id, authUserId),
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

      const existingNote = await noteStore.getByCalendarEventId(event.id, authUserId);
      const note = existingNote
        ? await noteStore.update(
            existingNote.id,
            {
              body: bodyResult.data.body,
            },
            authUserId
          )
        : await noteStore.create({
            userId: authUserId,
            title: null,
            body: bodyResult.data.body,
            color: null,
            targetDate: getCalendarEventTargetDate(event),
            calendarEventId: event.id,
          });

      if (!note) {
        return sendError(reply, 500, "INTERNAL_ERROR", "Unable to save calendar event note");
      }

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

      const note = await noteStore.getByCalendarEventId(event.id, authUserId);
      if (!note) {
        return reply.send({ data: { deleted: true } });
      }

      await noteStore.remove(note.id, authUserId);
      return reply.send({ data: { deleted: true } });
    } catch (error) {
      request.log.error(error, "Failed to delete calendar event note");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete calendar event note");
    }
  });

  app.get("/api/google-calendar/events/:id/note/attachments", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = calendarEventIdParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Calendar event id is required");
    }

    if (!noteAttachmentStore) {
      return sendError(reply, 500, "INTERNAL_ERROR", "Calendar event note storage is unavailable");
    }

    try {
      const event = await calendarEventStore.getById(paramsResult.data.id, authUserId);
      if (!event) {
        return sendError(reply, 404, "NOT_FOUND", "Calendar event not found");
      }

      const note = await noteStore.getByCalendarEventId(event.id, authUserId);
      if (!note) {
        return reply.send({ data: [] });
      }

      const attachments = await noteAttachmentStore.listByNoteId(note.id, authUserId);
      return reply.send({ data: attachments.map(serializeCalendarEventNoteAttachment) });
    } catch (error) {
      request.log.error(error, "Failed to load calendar event note attachments");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load calendar event note attachments");
    }
  });

  const createCalendarEventNoteAttachmentSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(255, "Name is too long"),
    url: z.string().min(1, "File content is required"),
    contentType: z.string().nullable().optional(),
    sizeBytes: z.number().int().nonnegative().nullable().optional(),
  });

  const calendarEventNoteAttachmentIdParamsSchema = z.object({
    id: z.string().trim().min(1, "Calendar event id is required"),
    attachmentId: z.string().trim().min(1, "Attachment id is required"),
  });

  app.post("/api/google-calendar/events/:id/note/attachments", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = calendarEventIdParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Calendar event id is required");
    }

    const bodyResult = createCalendarEventNoteAttachmentSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", bodyResult.error.issues[0]?.message ?? "Invalid attachment data");
    }

    if (!noteAttachmentStore) {
      return sendError(reply, 500, "INTERNAL_ERROR", "Calendar event note storage is unavailable");
    }

    const sizeBytes = bodyResult.data.sizeBytes ?? null;
    if (sizeBytes !== null && sizeBytes > MAX_CALENDAR_NOTE_ATTACHMENT_BYTES) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Attachment exceeds maximum size of 5 MB");
    }

    try {
      const event = await calendarEventStore.getById(paramsResult.data.id, authUserId);
      if (!event) {
        return sendError(reply, 404, "NOT_FOUND", "Calendar event not found");
      }

      const note = await noteStore.getByCalendarEventId(event.id, authUserId);
      if (!note) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Save the note before adding attachments");
      }

      const attachment = await noteAttachmentStore.create({
        noteId: note.id,
        userId: authUserId,
        name: bodyResult.data.name,
        url: bodyResult.data.url,
        contentType: bodyResult.data.contentType ?? null,
        sizeBytes,
      });

      return reply.code(201).send({ data: serializeCalendarEventNoteAttachment(attachment) });
    } catch (error) {
      request.log.error(error, "Failed to create calendar event note attachment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create calendar event note attachment");
    }
  });

  app.delete("/api/google-calendar/events/:id/note/attachments/:attachmentId", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const paramsResult = calendarEventNoteAttachmentIdParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Calendar event id and attachment id are required");
    }

    if (!noteAttachmentStore) {
      return sendError(reply, 500, "INTERNAL_ERROR", "Calendar event note storage is unavailable");
    }

    try {
      const removed = await noteAttachmentStore.remove(paramsResult.data.attachmentId, authUserId);
      if (!removed) {
        return sendError(reply, 404, "NOT_FOUND", "Attachment not found");
      }
      return reply.send({ data: { deleted: true } });
    } catch (error) {
      request.log.error(error, "Failed to delete calendar event note attachment");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete calendar event note attachment");
    }
  });
};

export default googleCalendarEventsRoutes;
