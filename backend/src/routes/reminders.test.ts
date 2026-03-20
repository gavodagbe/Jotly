import { Reminder, Task } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import {
  ReminderStore,
  ReminderCreateInput,
  ReminderUpdateInput,
  ReminderListFilters,
} from "../reminders/reminder-store";
import { TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

class NoopTaskStore implements TaskStore {
  async listByDate(_targetDate: Date, _userId: string): Promise<Task[]> {
    return [];
  }
  async listByUser(_userId: string): Promise<Task[]> {
    return [];
  }
  async getById(_id: string, _userId: string): Promise<Task | null> {
    return null;
  }
  async create(_input: TaskCreateInput): Promise<Task> {
    throw new Error("Not implemented");
  }
  async update(_id: string, _input: TaskUpdateInput, _userId: string): Promise<Task | null> {
    return null;
  }
  async remove(_id: string, _userId: string): Promise<Task | null> {
    return null;
  }
}

class InMemoryReminderStore implements ReminderStore {
  private readonly reminders = new Map<string, Reminder>();
  private idCounter = 1;

  async listByUser(userId: string, filters?: ReminderListFilters): Promise<Reminder[]> {
    const results: Reminder[] = [];
    for (const r of this.reminders.values()) {
      if (r.userId !== userId) continue;
      if (filters?.activeBefore && r.remindAt >= filters.activeBefore) continue;
      if (!filters?.activeBefore) {
        if (filters?.dateFrom && r.remindAt < filters.dateFrom) continue;
        if (filters?.dateTo && r.remindAt >= filters.dateTo) continue;
      }
      if (filters?.statuses?.length && !filters.statuses.includes(r.status)) continue;
      results.push(r);
    }
    return results.sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
  }

  async listPending(userId: string): Promise<Reminder[]> {
    const now = new Date();
    const results: Reminder[] = [];
    for (const r of this.reminders.values()) {
      if (r.userId === userId && r.remindAt <= now && r.status === "pending") {
        results.push(r);
      }
    }
    return results.sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
  }

  async getById(id: string, userId: string): Promise<Reminder | null> {
    const r = this.reminders.get(id);
    if (!r || r.userId !== userId) return null;
    return r;
  }

  async create(input: ReminderCreateInput): Promise<Reminder> {
    const now = new Date();
    const reminder: Reminder = {
      id: `reminder-${this.idCounter++}`,
      userId: input.userId,
      title: input.title,
      description: input.description ?? null,
      project: input.project ?? null,
      assignees: input.assignees ?? null,
      remindAt: input.remindAt,
      status: "pending",
      isFired: false,
      firedAt: null,
      isDismissed: false,
      dismissedAt: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.reminders.set(reminder.id, reminder);
    return reminder;
  }

  async update(id: string, input: ReminderUpdateInput, userId: string): Promise<Reminder | null> {
    const existing = this.reminders.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: Reminder = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.project !== undefined ? { project: input.project } : {}),
      ...(input.assignees !== undefined ? { assignees: input.assignees } : {}),
      ...(input.remindAt !== undefined ? { remindAt: input.remindAt } : {}),
      ...(input.remindAt !== undefined && existing.status === "fired" && input.remindAt.getTime() > Date.now()
        ? { status: "pending" as const, isFired: false, firedAt: null }
        : {}),
      updatedAt: new Date(),
    };
    this.reminders.set(id, updated);
    return updated;
  }

  async remove(id: string, userId: string): Promise<Reminder | null> {
    const existing = this.reminders.get(id);
    if (!existing || existing.userId !== userId) return null;
    this.reminders.delete(id);
    return existing;
  }

  async markFired(id: string, userId: string): Promise<Reminder | null> {
    const existing = this.reminders.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: Reminder = {
      ...existing,
      status: "fired",
      isFired: true,
      firedAt: new Date(),
      updatedAt: new Date(),
    };
    this.reminders.set(id, updated);
    return updated;
  }

  async complete(id: string, userId: string): Promise<Reminder | null> {
    const existing = this.reminders.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: Reminder = {
      ...existing,
      status: "completed",
      isDismissed: true,
      dismissedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    };
    this.reminders.set(id, updated);
    return updated;
  }

  async cancel(id: string, userId: string): Promise<Reminder | null> {
    const existing = this.reminders.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: Reminder = {
      ...existing,
      status: "cancelled",
      isDismissed: true,
      dismissedAt: new Date(),
      cancelledAt: new Date(),
      updatedAt: new Date(),
    };
    this.reminders.set(id, updated);
    return updated;
  }
}

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
    if (!session) return;
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

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new NoopTaskStore(),
    authStore: new InMemoryAuthStore(),
    reminderStore: new InMemoryReminderStore(),
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
  return { authorization: `Bearer ${token}` };
}

test("reminder endpoints require authentication", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const response = await app.inject({ method: "GET", url: "/api/reminders" });
  assert.equal(response.statusCode, 401);
});

test("POST /api/reminders creates a reminder", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  const remindAt = new Date(Date.now() + 60000).toISOString();

  const response = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "Test reminder", description: "Some notes", remindAt },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.title, "Test reminder");
  assert.equal(data.description, "Some notes");
  assert.equal(data.status, "pending");
  assert.equal(data.isFired, false);
  assert.equal(data.isDismissed, false);
});

test("POST /api/reminders validates required fields", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { description: "Missing title" },
  });

  assert.equal(response.statusCode, 400);
});

test("GET /api/reminders?date keeps active overdue reminders visible until completion or cancellation", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "Overdue active", remindAt: "2026-03-07T08:30:00.000Z" },
  });

  const dueTodayResponse = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "Due today", remindAt: "2026-03-08T10:00:00.000Z" },
  });
  const dueTodayId = ((parsePayload(dueTodayResponse.payload).data as Record<string, unknown>).id) as string;

  const toCompleteResponse = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "Completed old", remindAt: "2026-03-07T07:00:00.000Z" },
  });
  const toCompleteId = ((parsePayload(toCompleteResponse.payload).data as Record<string, unknown>).id) as string;

  await app.inject({
    method: "POST",
    url: `/api/reminders/${toCompleteId}/complete`,
    headers: authHeaders(token),
  });

  const toCancelResponse = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "Cancelled old", remindAt: "2026-03-07T06:30:00.000Z" },
  });
  const toCancelId = ((parsePayload(toCancelResponse.payload).data as Record<string, unknown>).id) as string;

  await app.inject({
    method: "POST",
    url: `/api/reminders/${toCancelId}/cancel`,
    headers: authHeaders(token),
  });

  await app.inject({
    method: "POST",
    url: `/api/reminders/${dueTodayId}/complete`,
    headers: authHeaders(token),
  });

  await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "Future", remindAt: "2026-03-09T09:00:00.000Z" },
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/reminders?date=2026-03-08",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Array<Record<string, unknown>>;
  assert.equal(data.length, 1);
  assert.equal(data[0].title, "Overdue active");
  assert.equal(data[0].status, "pending");
});

test("GET /api/reminders/:id returns a specific reminder", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  const remindAt = new Date(Date.now() + 60000).toISOString();

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "My reminder", remindAt },
  });

  const created = (parsePayload(createResponse.payload).data as { id: string });

  const response = await app.inject({
    method: "GET",
    url: `/api/reminders/${created.id}`,
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.title, "My reminder");
});

test("GET /api/reminders/:id returns 404 for non-existent reminder", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/reminders/non-existent-id",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 404);
});

test("PUT /api/reminders/:id updates a reminder", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  const remindAt = new Date(Date.now() + 60000).toISOString();

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "Original", remindAt },
  });

  const created = (parsePayload(createResponse.payload).data as { id: string });

  const response = await app.inject({
    method: "PUT",
    url: `/api/reminders/${created.id}`,
    headers: authHeaders(token),
    payload: { title: "Updated" },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.title, "Updated");
});

test("DELETE /api/reminders/:id removes a reminder", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  const remindAt = new Date(Date.now() + 60000).toISOString();

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "To delete", remindAt },
  });

  const created = (parsePayload(createResponse.payload).data as { id: string });

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/reminders/${created.id}`,
    headers: authHeaders(token),
  });

  assert.equal(deleteResponse.statusCode, 200);

  const getResponse = await app.inject({
    method: "GET",
    url: `/api/reminders/${created.id}`,
    headers: authHeaders(token),
  });

  assert.equal(getResponse.statusCode, 404);
});

test("POST /api/reminders/:id/complete marks reminder as completed", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  const remindAt = new Date(Date.now() - 60000).toISOString(); // past time

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "To dismiss", remindAt },
  });

  const created = (parsePayload(createResponse.payload).data as { id: string });

  const completeResponse = await app.inject({
    method: "POST",
    url: `/api/reminders/${created.id}/complete`,
    headers: authHeaders(token),
  });

  assert.equal(completeResponse.statusCode, 200);
  const body = parsePayload(completeResponse.payload);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.status, "completed");
  assert.equal(data.isDismissed, true);
  assert.notEqual(data.completedAt, null);
});

test("POST /api/reminders/:id/cancel marks reminder as cancelled", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  const remindAt = new Date(Date.now() + 60000).toISOString();

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "To cancel", remindAt },
  });

  const created = (parsePayload(createResponse.payload).data as { id: string });

  const cancelResponse = await app.inject({
    method: "POST",
    url: `/api/reminders/${created.id}/cancel`,
    headers: authHeaders(token),
  });

  assert.equal(cancelResponse.statusCode, 200);
  const body = parsePayload(cancelResponse.payload);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.status, "cancelled");
  assert.equal(data.isDismissed, true);
  assert.notEqual(data.cancelledAt, null);
});

test("GET /api/reminders/pending returns and fires pending reminders", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);

  // Create a reminder in the past (should be pending)
  const pastRemindAt = new Date(Date.now() - 60000).toISOString();
  await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "Past reminder", remindAt: pastRemindAt },
  });

  // Create a reminder in the future (should NOT be pending)
  const futureRemindAt = new Date(Date.now() + 3600000).toISOString();
  await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: { title: "Future reminder", remindAt: futureRemindAt },
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/reminders/pending",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Array<Record<string, unknown>>;
  assert.equal(data.length, 1);
  assert.equal(data[0].title, "Past reminder");
  assert.equal(data[0].status, "fired");
  assert.equal(data[0].isFired, true);

  // Second call should return empty (already fired)
  const response2 = await app.inject({
    method: "GET",
    url: "/api/reminders/pending",
    headers: authHeaders(token),
  });

  const body2 = parsePayload(response2.payload);
  const data2 = body2.data as unknown[];
  assert.equal(data2.length, 0);
});

test("reminders are scoped to the owning user", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token1 = await registerAndGetToken(app);
  const token2 = await registerAndGetToken(app);
  const remindAt = new Date(Date.now() + 60000).toISOString();

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token1),
    payload: { title: "User 1 reminder", remindAt },
  });

  const created = (parsePayload(createResponse.payload).data as { id: string });

  // User 2 should not see User 1's reminder
  const getResponse = await app.inject({
    method: "GET",
    url: `/api/reminders/${created.id}`,
    headers: authHeaders(token2),
  });

  assert.equal(getResponse.statusCode, 404);

  // User 2 should not be able to delete User 1's reminder
  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/reminders/${created.id}`,
    headers: authHeaders(token2),
  });

  assert.equal(deleteResponse.statusCode, 404);
});

test("POST /api/reminders creates a reminder with project and assignees", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  const remindAt = new Date(Date.now() + 60000).toISOString();

  const response = await app.inject({
    method: "POST",
    url: "/api/reminders",
    headers: authHeaders(token),
    payload: {
      title: "Project reminder",
      project: "Jotly",
      assignees: "alice@example.com, bob@example.com",
      remindAt,
    },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.title, "Project reminder");
  assert.equal(data.project, "Jotly");
  assert.equal(data.assignees, "alice@example.com, bob@example.com");

  // Verify persistence via GET
  const getResponse = await app.inject({
    method: "GET",
    url: `/api/reminders/${data.id as string}`,
    headers: authHeaders(token),
  });

  assert.equal(getResponse.statusCode, 200);
  const getBody = parsePayload(getResponse.payload);
  const getData = getBody.data as Record<string, unknown>;
  assert.equal(getData.project, "Jotly");
  assert.equal(getData.assignees, "alice@example.com, bob@example.com");
});
