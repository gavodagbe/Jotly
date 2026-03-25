import { Task, TaskPriority, TaskStatus } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import { buildApp } from "../app";
import {
  CalendarEventStore,
  CalendarEventUpsertInput,
} from "../google-calendar/calendar-event-store";
import { formatDateOnly, TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, Task>();
  private idCounter = 1;

  async listByDate(targetDate: Date, userId: string): Promise<Task[]> {
    const selectedDate = formatDateOnly(targetDate);
    const matches = [...this.tasks.values()].filter(
      (task) => task.userId === userId && formatDateOnly(task.targetDate) === selectedDate
    );
    return matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async listByUser(userId: string): Promise<Task[]> {
    const matches = [...this.tasks.values()].filter((task) => task.userId === userId);
    return matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getById(id: string, userId: string): Promise<Task | null> {
    const task = this.tasks.get(id) ?? null;
    return task && task.userId === userId ? task : null;
  }

  async create(input: TaskCreateInput): Promise<Task> {
    if (input.rolledFromTaskId) {
      const duplicate = [...this.tasks.values()].find(
        (task) =>
          task.rolledFromTaskId === input.rolledFromTaskId &&
          formatDateOnly(task.targetDate) === formatDateOnly(input.targetDate)
      );

      if (duplicate) {
        throw { code: "P2002" };
      }
    }

    const now = new Date();
    const task: Task = {
      id: `task-${this.idCounter++}`,
      userId: input.userId,
      title: input.title,
      description: input.description,
      status: input.status,
      targetDate: input.targetDate,
      dueDate: input.dueDate,
      priority: input.priority,
      project: input.project,
      assignees: input.assignees ?? null,
      plannedTime: input.plannedTime,
      rolledFromTaskId: input.rolledFromTaskId ?? null,
      recurrenceSourceTaskId: input.recurrenceSourceTaskId ?? null,
      recurrenceOccurrenceDate: input.recurrenceOccurrenceDate ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: input.completedAt,
      cancelledAt: input.cancelledAt,
      calendarEventId: input.calendarEventId ?? null,
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async update(id: string, input: TaskUpdateInput, userId: string): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const updated: Task = {
      ...existing,
      ...input,
      updatedAt: new Date()
    };

    this.tasks.set(id, updated);
    return updated;
  }

  async remove(id: string, userId: string): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    this.tasks.delete(id);
    return existing;
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
      updatedAt: now
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
      revokedAt: null
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

class InMemoryCalendarEventStore implements CalendarEventStore {
  private readonly now = new Date("2026-03-11T09:00:00.000Z");

  constructor(private readonly events: Array<{ id: string; userId: string }> = []) {}

  async listByDate(): Promise<never[]> {
    return [];
  }

  async listByDateRange(): Promise<never[]> {
    return [];
  }

  async getById(id: string, userId: string) {
    return (
      this.events.find((event) => event.id === id && event.userId === userId) ?? null
    ) as Awaited<ReturnType<CalendarEventStore["getById"]>>;
  }

  async getByGoogleEventId() {
    return null;
  }

  async upsertFromGoogle(input: CalendarEventUpsertInput) {
    return {
      id: "calendar-event-store-result",
      userId: input.userId,
      connectionId: input.connectionId,
      googleEventId: input.googleEventId,
      title: input.title,
      description: input.description,
      location: input.location,
      startTime: input.startTime,
      endTime: input.endTime,
      isAllDay: input.isAllDay,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
      htmlLink: input.htmlLink,
      attendees: input.attendees,
      organizer: input.organizer,
      recurringEventId: input.recurringEventId,
      syncedAt: this.now,
      createdAt: this.now,
      updatedAt: this.now,
    };
  }

  async markCancelled() {
    return null;
  }

  async deleteByConnectionId(): Promise<void> {}
}

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

function createAppForTest(options?: { calendarEventStore?: CalendarEventStore; taskStore?: TaskStore }) {
  return buildApp({
    logLevel: "silent",
    taskStore: options?.taskStore ?? new InMemoryTaskStore(),
    authStore: new InMemoryAuthStore(),
    calendarEventStore: options?.calendarEventStore,
  });
}

async function registerAndGetToken(app: ReturnType<typeof createAppForTest>): Promise<string> {
  const auth = await registerAndGetAuth(app);
  return auth.token;
}

async function registerAndGetAuth(
  app: ReturnType<typeof createAppForTest>
): Promise<{ token: string; userId: string }> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: `user-${Math.random().toString(36).slice(2)}@example.com`,
      password: "password123"
    }
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  const data = body.data as { token: string; user: { id: string } };
  return { token: data.token, userId: data.user.id };
}

function authHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`
  };
}

test("POST /api/tasks creates a task with defaults", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Write tests",
      targetDate: "2026-03-06"
    }
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.equal(data.title, "Write tests");
  assert.equal(data.status, "todo");
  assert.equal(data.priority, "medium");
  assert.equal(data.targetDate, "2026-03-06");
  assert.equal(data.dueDate, "2026-03-06");
  assert.equal(data.completedAt, null);
  assert.equal(data.cancelledAt, null);
});

test("GET /api/tasks/alerts returns actionable tasks due today, tomorrow, and overdue", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Overdue",
      targetDate: "2026-03-05",
      dueDate: "2026-03-07",
      status: "todo",
      priority: "high",
    },
  });

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Due today",
      targetDate: "2026-03-06",
      dueDate: "2026-03-08",
      status: "todo",
      priority: "high",
    },
  });

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Due tomorrow",
      targetDate: "2026-03-07",
      dueDate: "2026-03-09",
      status: "in_progress",
      priority: "medium",
    },
  });

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Done today",
      targetDate: "2026-03-06",
      dueDate: "2026-03-08",
      status: "done",
    },
  });

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Due later",
      targetDate: "2026-03-10",
      dueDate: "2026-03-10",
      status: "todo",
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/tasks/alerts?date=2026-03-08",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as {
    count: number;
    dueTodayCount: number;
    dueTomorrowCount: number;
    tasks: Array<{ title: string; dueDate: string }>;
  };

  assert.equal(data.count, 3);
  assert.equal(data.dueTodayCount, 1);
  assert.equal(data.dueTomorrowCount, 1);
  assert.deepEqual(
    data.tasks.map((task) => task.title),
    ["Overdue", "Due today", "Due tomorrow"]
  );
});

test("GET /api/tasks filters tasks by selected date", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Task for selected date",
      targetDate: "2026-03-06"
    }
  });

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Task for another date",
      targetDate: "2026-03-07"
    }
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-06",
    headers: authHeaders(token)
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Array<Record<string, unknown>>;

  assert.equal(data.length, 1);
  assert.equal(data[0].title, "Task for selected date");
});

test("task endpoints isolate data by authenticated user", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const ownerToken = await registerAndGetToken(app);
  const otherUserToken = await registerAndGetToken(app);

  const created = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(ownerToken),
    payload: {
      title: "Owner only task",
      targetDate: "2026-03-06"
    }
  });

  assert.equal(created.statusCode, 201);
  const createdBody = parsePayload(created.payload);
  const taskId = (createdBody.data as Record<string, unknown>).id as string;

  const otherUserList = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-06",
    headers: authHeaders(otherUserToken)
  });

  assert.equal(otherUserList.statusCode, 200);
  const listPayload = parsePayload(otherUserList.payload);
  const listData = listPayload.data as Array<unknown>;
  assert.equal(listData.length, 0);

  const otherUserGet = await app.inject({
    method: "GET",
    url: `/api/tasks/${taskId}`,
    headers: authHeaders(otherUserToken)
  });

  assert.equal(otherUserGet.statusCode, 404);

  const otherUserPatch = await app.inject({
    method: "PATCH",
    url: `/api/tasks/${taskId}`,
    headers: authHeaders(otherUserToken),
    payload: {
      title: "Should fail"
    }
  });

  assert.equal(otherUserPatch.statusCode, 404);
});

test("PATCH /api/tasks manages status timestamps consistently", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  const created = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Transition me",
      targetDate: "2026-03-06",
      status: "todo" satisfies TaskStatus,
      priority: "high" satisfies TaskPriority
    }
  });

  const createdBody = parsePayload(created.payload);
  const taskId = (createdBody.data as Record<string, unknown>).id as string;

  const doneResponse = await app.inject({
    method: "PATCH",
    url: `/api/tasks/${taskId}`,
    headers: authHeaders(token),
    payload: {
      status: "done"
    }
  });

  assert.equal(doneResponse.statusCode, 200);
  const donePayload = parsePayload(doneResponse.payload);
  const doneData = donePayload.data as Record<string, unknown>;
  assert.equal(doneData.status, "done");
  assert.notEqual(doneData.completedAt, null);
  assert.equal(doneData.cancelledAt, null);

  const cancelledResponse = await app.inject({
    method: "PATCH",
    url: `/api/tasks/${taskId}`,
    headers: authHeaders(token),
    payload: {
      status: "cancelled"
    }
  });

  assert.equal(cancelledResponse.statusCode, 200);
  const cancelledPayload = parsePayload(cancelledResponse.payload);
  const cancelledData = cancelledPayload.data as Record<string, unknown>;
  assert.equal(cancelledData.status, "cancelled");
  assert.equal(cancelledData.completedAt, null);
  assert.notEqual(cancelledData.cancelledAt, null);

  const todoResponse = await app.inject({
    method: "PATCH",
    url: `/api/tasks/${taskId}`,
    headers: authHeaders(token),
    payload: {
      status: "todo"
    }
  });

  assert.equal(todoResponse.statusCode, 200);
  const todoPayload = parsePayload(todoResponse.payload);
  const todoData = todoPayload.data as Record<string, unknown>;
  assert.equal(todoData.status, "todo");
  assert.equal(todoData.completedAt, null);
  assert.equal(todoData.cancelledAt, null);
});

test("POST /api/tasks links an owned calendar event", async (t) => {
  const app = createAppForTest({
    calendarEventStore: new InMemoryCalendarEventStore([{ id: "calendar-event-1", userId: "user-1" }]),
  });
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Follow up on meeting",
      targetDate: "2026-03-06",
      calendarEventId: "calendar-event-1",
    },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.calendarEventId, "calendar-event-1");
});

test("POST /api/tasks rejects linking a foreign calendar event", async (t) => {
  const app = createAppForTest({
    calendarEventStore: new InMemoryCalendarEventStore([{ id: "calendar-event-1", userId: "user-2" }]),
  });
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Should fail",
      targetDate: "2026-03-06",
      calendarEventId: "calendar-event-1",
    },
  });

  assert.equal(response.statusCode, 404);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "NOT_FOUND",
    message: "Calendar event not found",
  });
});

test("PATCH /api/tasks can unlink a linked calendar event", async (t) => {
  const app = createAppForTest({
    calendarEventStore: new InMemoryCalendarEventStore([{ id: "calendar-event-1", userId: "user-1" }]),
  });
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  const created = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Linked task",
      targetDate: "2026-03-06",
      calendarEventId: "calendar-event-1",
    },
  });
  const createdBody = parsePayload(created.payload);
  const taskId = (createdBody.data as Record<string, unknown>).id as string;

  const response = await app.inject({
    method: "PATCH",
    url: `/api/tasks/${taskId}`,
    headers: authHeaders(token),
    payload: {
      calendarEventId: null,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.calendarEventId, null);
});

test("PATCH /api/tasks does not revalidate an unchanged calendarEventId", async (t) => {
  const taskStore = new InMemoryTaskStore();
  const app = createAppForTest({ taskStore });
  t.after(async () => {
    await app.close();
  });
  const { token, userId } = await registerAndGetAuth(app);
  const existingTask = await taskStore.create({
    userId,
    title: "Linked task",
    description: null,
    status: "todo",
    targetDate: new Date("2026-03-06T00:00:00.000Z"),
    dueDate: null,
    priority: "medium",
    project: null,
    plannedTime: null,
    completedAt: null,
    cancelledAt: null,
    calendarEventId: "calendar-event-1",
  });

  const response = await app.inject({
    method: "PATCH",
    url: `/api/tasks/${existingTask.id}`,
    headers: authHeaders(token),
    payload: {
      title: "Renamed task",
      calendarEventId: "calendar-event-1",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.title, "Renamed task");
  assert.equal(data.calendarEventId, "calendar-event-1");
});

test("DELETE /api/tasks removes a task", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  const created = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Delete me",
      targetDate: "2026-03-06"
    }
  });

  const createdBody = parsePayload(created.payload);
  const taskId = (createdBody.data as Record<string, unknown>).id as string;

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/tasks/${taskId}`,
    headers: authHeaders(token)
  });

  assert.equal(deleteResponse.statusCode, 200);

  const getAfterDelete = await app.inject({
    method: "GET",
    url: `/api/tasks/${taskId}`,
    headers: authHeaders(token)
  });

  assert.equal(getAfterDelete.statusCode, 404);
  const getPayload = parsePayload(getAfterDelete.payload);
  assert.deepEqual(getPayload.error, {
    code: "NOT_FOUND",
    message: "Task not found"
  });
});

test("POST /api/tasks/carry-over-yesterday copies only actionable tasks from previous day", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  const yesterday = "2026-03-07";
  const targetDate = "2026-03-08";

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Todo task",
      targetDate: yesterday,
      status: "todo",
    },
  });

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "In progress task",
      targetDate: yesterday,
      status: "in_progress",
    },
  });

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Done task",
      targetDate: yesterday,
      status: "done",
    },
  });

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Cancelled task",
      targetDate: yesterday,
      status: "cancelled",
    },
  });

  const copyResponse = await app.inject({
    method: "POST",
    url: "/api/tasks/carry-over-yesterday",
    headers: authHeaders(token),
    payload: {
      targetDate,
    },
  });

  assert.equal(copyResponse.statusCode, 200);
  const copyPayload = parsePayload(copyResponse.payload);
  const copyData = copyPayload.data as {
    copiedCount: number;
    skippedCount: number;
    tasks: Array<{ title: string; rolledFromTaskId: string | null }>;
  };

  assert.equal(copyData.copiedCount, 2);
  assert.equal(copyData.skippedCount, 0);
  assert.equal(copyData.tasks.length, 2);
  assert.deepEqual(
    copyData.tasks.map((task) => task.title).sort(),
    ["In progress task", "Todo task"]
  );
  assert.equal(copyData.tasks.every((task) => Boolean(task.rolledFromTaskId)), true);

  const targetListResponse = await app.inject({
    method: "GET",
    url: `/api/tasks?date=${targetDate}`,
    headers: authHeaders(token),
  });

  assert.equal(targetListResponse.statusCode, 200);
  const targetListPayload = parsePayload(targetListResponse.payload);
  const targetTasks = targetListPayload.data as Array<{ title: string }>;
  assert.equal(targetTasks.length, 2);
});

test("POST /api/tasks/carry-over-yesterday is idempotent for the same target date", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Task to carry",
      targetDate: "2026-03-07",
      status: "todo",
    },
  });

  const firstCopyResponse = await app.inject({
    method: "POST",
    url: "/api/tasks/carry-over-yesterday",
    headers: authHeaders(token),
    payload: {
      targetDate: "2026-03-08",
    },
  });

  assert.equal(firstCopyResponse.statusCode, 200);
  const firstCopyPayload = parsePayload(firstCopyResponse.payload);
  const firstCopyData = firstCopyPayload.data as { copiedCount: number; skippedCount: number };
  assert.equal(firstCopyData.copiedCount, 1);
  assert.equal(firstCopyData.skippedCount, 0);

  const secondCopyResponse = await app.inject({
    method: "POST",
    url: "/api/tasks/carry-over-yesterday",
    headers: authHeaders(token),
    payload: {
      targetDate: "2026-03-08",
    },
  });

  assert.equal(secondCopyResponse.statusCode, 200);
  const secondCopyPayload = parsePayload(secondCopyResponse.payload);
  const secondCopyData = secondCopyPayload.data as { copiedCount: number; skippedCount: number };
  assert.equal(secondCopyData.copiedCount, 0);
  assert.equal(secondCopyData.skippedCount, 1);
});

test("validation errors return structured JSON shape", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "",
      targetDate: "invalid-date"
    }
  });

  assert.equal(response.statusCode, 400);
  const body = parsePayload(response.payload);
  const error = body.error as Record<string, unknown>;

  assert.equal(error.code, "VALIDATION_ERROR");
  assert.equal(typeof error.message, "string");
});

test("malformed JSON returns a structured validation error", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });
  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: {
      ...authHeaders(token),
      "content-type": "application/json"
    },
    payload: "{"
  });

  assert.equal(response.statusCode, 400);
  const body = parsePayload(response.payload);
  const error = body.error as Record<string, unknown>;

  assert.equal(error.code, "VALIDATION_ERROR");
  assert.equal(typeof error.message, "string");
});

test("task endpoints require authentication", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-06"
  });

  assert.equal(response.statusCode, 401);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "UNAUTHORIZED",
    message: "Authentication is required"
  });
});
