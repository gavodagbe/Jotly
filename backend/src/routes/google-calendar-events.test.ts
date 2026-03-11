import { CalendarEvent, Task } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import {
  AuthSession,
  AuthStore,
  AuthUser,
  CreateAuthSessionInput,
  CreateAuthUserInput,
} from "../auth/auth-store";
import {
  CalendarEventStore,
  getTimedEventRangeForDate,
} from "../google-calendar/calendar-event-store";
import { CalendarEventNoteStore } from "../google-calendar/calendar-event-note-store";
import { GoogleCalendarSyncService } from "../google-calendar/google-calendar-sync-service";
import { formatDateOnly, parseDateOnly, TaskCreateInput, TaskStore } from "../tasks/task-store";

class NoopTaskStore implements TaskStore {
  constructor(private readonly tasks: Task[] = []) {}

  async listByDate(): Promise<Task[]> {
    return this.tasks;
  }

  async listByUser(): Promise<Task[]> {
    return this.tasks;
  }

  async getById(): Promise<Task | null> {
    return null;
  }

  async create(_input: TaskCreateInput): Promise<Task> {
    throw new Error("Not implemented");
  }

  async update(): Promise<Task | null> {
    return null;
  }

  async remove(): Promise<Task | null> {
    return null;
  }
}

class InMemoryCalendarEventNoteStore implements CalendarEventNoteStore {
  private readonly notes = new Map<string, {
    id: string;
    calendarEventId: string;
    userId: string;
    body: string;
    createdAt: Date;
    updatedAt: Date;
  }>();
  private idCounter = 1;

  constructor(
    initialNotes: Array<{
      id?: string;
      calendarEventId: string;
      userId: string;
      body: string;
    }> = []
  ) {
    const now = new Date("2026-03-11T09:00:00.000Z");
    for (const note of initialNotes) {
      const id = note.id ?? `event-note-${this.idCounter++}`;
      this.notes.set(note.calendarEventId, {
        id,
        calendarEventId: note.calendarEventId,
        userId: note.userId,
        body: note.body,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async listByCalendarEventIds(calendarEventIds: string[], userId: string) {
    return [...this.notes.values()].filter(
      (note) => note.userId === userId && calendarEventIds.includes(note.calendarEventId)
    );
  }

  async getByCalendarEventId(calendarEventId: string, userId: string) {
    const note = this.notes.get(calendarEventId) ?? null;
    return note && note.userId === userId ? note : null;
  }

  async upsert(calendarEventId: string, userId: string, body: string) {
    const existing = this.notes.get(calendarEventId);
    const now = new Date("2026-03-11T10:00:00.000Z");
    const note = {
      id: existing?.id ?? `event-note-${this.idCounter++}`,
      calendarEventId,
      userId,
      body,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.notes.set(calendarEventId, note);
    return note;
  }

  async deleteByCalendarEventId(calendarEventId: string, userId: string): Promise<void> {
    const note = this.notes.get(calendarEventId);
    if (note && note.userId === userId) {
      this.notes.delete(calendarEventId);
    }
  }
}

class InMemoryAuthStore implements AuthStore {
  private readonly users = new Map<string, AuthUser>();
  private readonly usersByEmail = new Map<string, AuthUser>();
  private readonly sessions = new Map<string, AuthSession>();
  private readonly sessionsByTokenHash = new Map<string, AuthSession>();
  private userIdCounter = 1;
  private sessionIdCounter = 1;

  constructor(private readonly defaultPreferredTimeZone: string | null = "Asia/Tokyo") {}

  async createUser(input: CreateAuthUserInput): Promise<AuthUser> {
    const now = new Date();
    const user: AuthUser = {
      id: `user-${this.userIdCounter++}`,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      preferredLocale: "en",
      preferredTimeZone: this.defaultPreferredTimeZone,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user);
    return user;
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    return this.usersByEmail.get(email) ?? null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    return this.users.get(id) ?? null;
  }

  async createSession(input: CreateAuthSessionInput): Promise<AuthSession> {
    const session: AuthSession = {
      id: `session-${this.sessionIdCounter++}`,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      revokedAt: null,
    };
    this.sessions.set(session.id, session);
    this.sessionsByTokenHash.set(session.tokenHash, session);
    return session;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null> {
    return this.sessionsByTokenHash.get(tokenHash) ?? null;
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    const revoked = { ...session, revokedAt: new Date() };
    this.sessions.set(sessionId, revoked);
    this.sessionsByTokenHash.set(revoked.tokenHash, revoked);
  }

  async deleteExpiredSessions(now: Date): Promise<void> {
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt.getTime() <= now.getTime() || session.revokedAt) {
        this.sessions.delete(id);
        this.sessionsByTokenHash.delete(session.tokenHash);
      }
    }
  }
}

class SpyCalendarEventStore implements CalendarEventStore {
  lastListByDateCall:
    | { date: string; userId: string; timeZone: string | null }
    | null = null;

  constructor(private readonly events: CalendarEvent[] = []) {}

  async listByDate(date: Date, userId: string, timeZone?: string | null): Promise<CalendarEvent[]> {
    this.lastListByDateCall = {
      date: formatDateOnly(date),
      userId,
      timeZone: timeZone ?? null,
    };
    return this.events;
  }

  async listByDateRange(): Promise<CalendarEvent[]> {
    return this.events;
  }

  async getById(id: string, userId: string): Promise<CalendarEvent | null> {
    return this.events.find((event) => event.id === id && event.userId === userId) ?? null;
  }

  async getByGoogleEventId(): Promise<CalendarEvent | null> {
    return null;
  }

  async upsertFromGoogle(): Promise<CalendarEvent> {
    throw new Error("Not implemented");
  }

  async markCancelled(): Promise<CalendarEvent | null> {
    return null;
  }

  async deleteByConnectionId(): Promise<void> {}
}

function createSyncServiceStub(
  implementation: GoogleCalendarSyncService["syncEventsForUser"]
): GoogleCalendarSyncService {
  return {
    syncEventsForUser: implementation,
  };
}

function createCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const now = new Date("2026-03-11T09:00:00.000Z");
  return {
    id: "calendar-event-1",
    userId: "user-1",
    connectionId: "connection-1",
    googleEventId: "google-event-1",
    title: "Standup",
    description: null,
    location: "Room 1",
    startTime: now,
    endTime: new Date("2026-03-11T09:30:00.000Z"),
    isAllDay: false,
    startDate: null,
    endDate: null,
    status: "confirmed",
    htmlLink: "https://calendar.google.com/event",
    attendees: null,
    organizer: null,
    recurringEventId: null,
    syncedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

function createAppForTest(options?: {
  authStore?: AuthStore;
  calendarEventStore?: CalendarEventStore;
  calendarEventNoteStore?: CalendarEventNoteStore;
  taskStore?: TaskStore;
  googleCalendarSyncService?: GoogleCalendarSyncService;
}) {
  return buildApp({
    logLevel: "silent",
    taskStore: options?.taskStore ?? new NoopTaskStore(),
    authStore: options?.authStore ?? new InMemoryAuthStore(),
    calendarEventStore: options?.calendarEventStore ?? new SpyCalendarEventStore(),
    calendarEventNoteStore: options?.calendarEventNoteStore ?? new InMemoryCalendarEventNoteStore(),
    googleCalendarSyncService:
      options?.googleCalendarSyncService ??
      createSyncServiceStub(async () => ({
        syncedCount: 0,
        lastSyncedAt: new Date("2026-03-11T09:00:00.000Z"),
      })),
  });
}

async function registerAndGetToken(app: ReturnType<typeof createAppForTest>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: `user-${Math.random().toString(36).slice(2)}@example.com`,
      password: "password123",
    },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  return (body.data as { token: string }).token;
}

function authHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
  };
}

test("GET /api/google-calendar/events forwards authenticated preferred timezone to the store", async (t) => {
  const calendarEventStore = new SpyCalendarEventStore([createCalendarEvent()]);
  const app = createAppForTest({ calendarEventStore });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "GET",
    url: "/api/google-calendar/events?date=2026-03-11",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calendarEventStore.lastListByDateCall, {
    date: "2026-03-11",
    userId: "user-1",
    timeZone: "Asia/Tokyo",
  });
});

test("GET /api/google-calendar/events includes linked tasks and notes", async (t) => {
  const calendarEvent = createCalendarEvent();
  const linkedTask: Task = {
    id: "task-1",
    userId: "user-1",
    title: "Prepare follow-up",
    description: null,
    status: "todo",
    targetDate: parseDateOnly("2026-03-11")!,
    dueDate: parseDateOnly("2026-03-11")!,
    priority: "medium",
    project: "Calendar",
    plannedTime: null,
    rolledFromTaskId: null,
    recurrenceSourceTaskId: null,
    recurrenceOccurrenceDate: null,
    calendarEventId: "calendar-event-1",
    createdAt: new Date("2026-03-11T09:00:00.000Z"),
    updatedAt: new Date("2026-03-11T09:00:00.000Z"),
    completedAt: null,
    cancelledAt: null,
  };

  const app = createAppForTest({
    calendarEventStore: new SpyCalendarEventStore([calendarEvent]),
    calendarEventNoteStore: new InMemoryCalendarEventNoteStore([
      {
        calendarEventId: "calendar-event-1",
        userId: "user-1",
        body: "Bring agenda",
      },
    ]),
    taskStore: new NoopTaskStore([linkedTask]),
  });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "GET",
    url: "/api/google-calendar/events?date=2026-03-11",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Array<{
    note: { body: string } | null;
    linkedTasks: Array<{ id: string; title: string }>;
  }>;
  assert.equal(data.length, 1);
  assert.equal(data[0].note?.body, "Bring agenda");
  assert.deepEqual(
    data[0].linkedTasks.map((task) => ({ id: task.id, title: task.title })),
    [{ id: "task-1", title: "Prepare follow-up" }]
  );
});

test("PUT /api/google-calendar/events/:id/note upserts a note for an owned event", async (t) => {
  const app = createAppForTest({
    calendarEventStore: new SpyCalendarEventStore([createCalendarEvent()]),
  });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "PUT",
    url: "/api/google-calendar/events/calendar-event-1/note",
    headers: authHeaders(token),
    payload: { body: "Prep notes" },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  assert.equal((body.data as { body: string }).body, "Prep notes");
});

test("DELETE /api/google-calendar/events/:id/note deletes a note for an owned event", async (t) => {
  const app = createAppForTest({
    calendarEventStore: new SpyCalendarEventStore([createCalendarEvent()]),
    calendarEventNoteStore: new InMemoryCalendarEventNoteStore([
      {
        calendarEventId: "calendar-event-1",
        userId: "user-1",
        body: "Prep notes",
      },
    ]),
  });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "DELETE",
    url: "/api/google-calendar/events/calendar-event-1/note",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.data, { deleted: true });
});

test("POST /api/google-calendar/sync returns reconnect-required validation error", async (t) => {
  const app = createAppForTest({
    googleCalendarSyncService: createSyncServiceStub(async () => {
      throw new Error("GOOGLE_CALENDAR_RECONNECT_REQUIRED");
    }),
  });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/google-calendar/sync",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 400);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "VALIDATION_ERROR",
    message: "Google Calendar reconnection required. Please reconnect your account.",
  });
});

test("calendar day boundaries use the authenticated timezone for timed events", () => {
  const date = parseDateOnly("2026-03-11");
  assert.ok(date);

  const range = getTimedEventRangeForDate(date, "Asia/Tokyo");
  assert.equal(range.start.toISOString(), "2026-03-10T15:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-03-11T15:00:00.000Z");
});
