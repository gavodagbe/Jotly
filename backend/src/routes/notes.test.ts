import { CalendarEvent } from "@prisma/client";
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
import { CalendarEventStore } from "../google-calendar/calendar-event-store";
import { NoteStore, StoredNote } from "../notes/note-store";
import { parseDateOnly } from "../tasks/task-store";

class InMemoryAuthStore implements AuthStore {
  private readonly users = new Map<string, AuthUser>();
  private readonly usersByEmail = new Map<string, AuthUser>();
  private readonly sessions = new Map<string, AuthSession>();
  private readonly sessionsByTokenHash = new Map<string, AuthSession>();
  private userIdCounter = 1;
  private sessionIdCounter = 1;

  async createUser(input: CreateAuthUserInput): Promise<AuthUser> {
    const now = new Date();
    const user: AuthUser = {
      id: `user-${this.userIdCounter++}`,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      preferredLocale: "en",
      preferredTimeZone: "Europe/Paris",
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
  constructor(private readonly events: CalendarEvent[] = []) {}

  async listByDate(): Promise<CalendarEvent[]> {
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

class InMemoryNoteStore implements NoteStore {
  private readonly notes = new Map<string, StoredNote>();
  private idCounter = 1;

  constructor(private readonly eventsById = new Map<string, CalendarEvent>()) {}

  private hydrateCalendarEvent(calendarEventId: string | null | undefined) {
    if (!calendarEventId) {
      return null;
    }

    const event = this.eventsById.get(calendarEventId);
    if (!event) {
      return null;
    }

    return {
      id: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      htmlLink: event.htmlLink,
    };
  }

  async listByUser(userId: string): Promise<StoredNote[]> {
    return [...this.notes.values()].filter((note) => note.userId === userId);
  }

  async listByCalendarEventIds(calendarEventIds: string[], userId: string): Promise<StoredNote[]> {
    return [...this.notes.values()].filter(
      (note) =>
        note.userId === userId &&
        typeof note.calendarEventId === "string" &&
        calendarEventIds.includes(note.calendarEventId)
    );
  }

  async getById(id: string, userId: string): Promise<StoredNote | null> {
    const note = this.notes.get(id) ?? null;
    return note && note.userId === userId ? note : null;
  }

  async getByCalendarEventId(calendarEventId: string, userId: string): Promise<StoredNote | null> {
    return (
      [...this.notes.values()].find(
        (note) => note.userId === userId && note.calendarEventId === calendarEventId
      ) ?? null
    );
  }

  async create(input: {
    userId: string;
    title?: string | null;
    body: string;
    color?: string | null;
    targetDate?: Date | null;
    calendarEventId?: string | null;
  }): Promise<StoredNote> {
    if (input.calendarEventId) {
      const existing = [...this.notes.values()].find(
        (note) => note.calendarEventId === input.calendarEventId
      );
      if (existing) {
        throw { code: "P2002" };
      }
    }

    const now = new Date("2026-03-20T10:00:00.000Z");
    const note: StoredNote = {
      id: `note-${this.idCounter++}`,
      userId: input.userId,
      calendarEventId: input.calendarEventId ?? null,
      title: input.title ?? null,
      body: input.body,
      color: input.color ?? null,
      targetDate: input.targetDate ?? null,
      createdAt: now,
      updatedAt: now,
      calendarEvent: this.hydrateCalendarEvent(input.calendarEventId),
    };
    this.notes.set(note.id, note);
    return note;
  }

  async update(
    id: string,
    input: {
      title?: string | null;
      body?: string;
      color?: string | null;
      targetDate?: Date | null;
      calendarEventId?: string | null;
    },
    userId: string
  ): Promise<StoredNote | null> {
    const existing = this.notes.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    if (input.calendarEventId) {
      const conflict = [...this.notes.values()].find(
        (note) => note.id !== id && note.calendarEventId === input.calendarEventId
      );
      if (conflict) {
        throw { code: "P2002" };
      }
    }

    const updated: StoredNote = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
      ...(input.calendarEventId !== undefined ? { calendarEventId: input.calendarEventId } : {}),
      updatedAt: new Date("2026-03-20T10:30:00.000Z"),
      calendarEvent: this.hydrateCalendarEvent(
        input.calendarEventId !== undefined ? input.calendarEventId : existing.calendarEventId
      ),
    };
    this.notes.set(id, updated);
    return updated;
  }

  async remove(id: string, userId: string): Promise<StoredNote | null> {
    const existing = this.notes.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }
    this.notes.delete(id);
    return existing;
  }
}

function createCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const now = new Date("2026-03-20T09:00:00.000Z");
  return {
    id: "calendar-event-1",
    userId: "user-1",
    connectionId: "connection-1",
    googleEventId: "google-event-1",
    title: "Weekly sync",
    description: null,
    location: null,
    startTime: now,
    endTime: new Date("2026-03-20T09:30:00.000Z"),
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
  noteStore?: NoteStore;
}) {
  return buildApp({
    logLevel: "silent",
    authStore: options?.authStore ?? new InMemoryAuthStore(),
    calendarEventStore: options?.calendarEventStore,
    noteStore: options?.noteStore,
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

test("POST /api/notes can create a note linked to an owned calendar event", async (t) => {
  const event = createCalendarEvent();
  const app = createAppForTest({
    calendarEventStore: new SpyCalendarEventStore([event]),
    noteStore: new InMemoryNoteStore(new Map([[event.id, event]])),
  });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/notes",
    headers: authHeaders(token),
    payload: {
      title: "Meeting note",
      body: "<p>Agenda</p>",
      targetDate: "2026-03-20",
      calendarEventId: event.id,
    },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.data, {
    id: "note-1",
    calendarEventId: "calendar-event-1",
    title: "Meeting note",
    body: "<p>Agenda</p>",
    color: null,
    targetDate: "2026-03-20",
    createdAt: "2026-03-20T10:00:00.000Z",
    updatedAt: "2026-03-20T10:00:00.000Z",
    linkedCalendarEvent: {
      id: "calendar-event-1",
      title: "Weekly sync",
      startTime: "2026-03-20T09:00:00.000Z",
      endTime: "2026-03-20T09:30:00.000Z",
      htmlLink: "https://calendar.google.com/event",
    },
  });
});

test("POST /api/notes rejects linking a note to an unknown calendar event", async (t) => {
  const app = createAppForTest({
    calendarEventStore: new SpyCalendarEventStore([]),
    noteStore: new InMemoryNoteStore(),
  });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/notes",
    headers: authHeaders(token),
    payload: {
      body: "<p>Agenda</p>",
      calendarEventId: "missing-event",
    },
  });

  assert.equal(response.statusCode, 400);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "VALIDATION_ERROR",
    message: "Linked calendar event not found",
  });
});

test("PATCH /api/notes/:id returns a conflict when another note already links the event", async (t) => {
  const event = createCalendarEvent();
  const noteStore = new InMemoryNoteStore(new Map([[event.id, event]]));
  await noteStore.create({
    userId: "user-1",
    title: "First note",
    body: "<p>Existing</p>",
    calendarEventId: event.id,
    targetDate: parseDateOnly("2026-03-20"),
  });
  const otherNote = await noteStore.create({
    userId: "user-1",
    title: "Second note",
    body: "<p>Standalone</p>",
    targetDate: parseDateOnly("2026-03-20"),
  });

  const app = createAppForTest({
    calendarEventStore: new SpyCalendarEventStore([event]),
    noteStore,
  });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "PATCH",
    url: `/api/notes/${otherNote.id}`,
    headers: authHeaders(token),
    payload: {
      calendarEventId: event.id,
    },
  });

  assert.equal(response.statusCode, 409);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "CONFLICT",
    message: "This calendar event is already linked to another note",
  });
});
