import { Task, TaskPriority, TaskRecurrenceRule, TaskStatus } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import { buildApp } from "../app";
import { RecurrenceStore, TaskRecurrenceRuleUpsertInput } from "../recurrence/recurrence-store";
import { formatDateOnly, TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

type RecurrenceFrequency = "daily" | "weekly" | "monthly";

class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, Task>();
  private idCounter = 1;

  async listByDate(targetDate: Date): Promise<Task[]> {
    const selectedDate = formatDateOnly(targetDate);
    const matches = [...this.tasks.values()].filter(
      (task) => formatDateOnly(task.targetDate) === selectedDate
    );
    return matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async create(input: TaskCreateInput): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: `task-${this.idCounter++}`,
      title: input.title,
      description: input.description,
      status: input.status,
      targetDate: input.targetDate,
      priority: input.priority,
      project: input.project,
      plannedTime: input.plannedTime,
      recurrenceSourceTaskId: input.recurrenceSourceTaskId ?? null,
      recurrenceOccurrenceDate: input.recurrenceOccurrenceDate ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: input.completedAt,
      cancelledAt: input.cancelledAt,
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async update(id: string, input: TaskUpdateInput): Promise<Task | null> {
    const existing = this.tasks.get(id);

    if (!existing) {
      return null;
    }

    const updated: Task = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };

    this.tasks.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<Task | null> {
    const existing = this.tasks.get(id);

    if (!existing) {
      return null;
    }

    this.tasks.delete(id);
    return existing;
  }
}

class InMemoryRecurrenceStore implements RecurrenceStore {
  private readonly rules = new Map<string, TaskRecurrenceRule>();
  private idCounter = 1;

  async listForDate(targetDate: Date): Promise<TaskRecurrenceRule[]> {
    return [...this.rules.values()].filter((rule) => {
      if (!rule.endsOn) {
        return true;
      }

      return rule.endsOn.getTime() >= targetDate.getTime();
    });
  }

  async getByTaskId(taskId: string): Promise<TaskRecurrenceRule | null> {
    return this.rules.get(taskId) ?? null;
  }

  async upsertByTaskId(taskId: string, input: TaskRecurrenceRuleUpsertInput): Promise<TaskRecurrenceRule> {
    const existing = this.rules.get(taskId);
    const now = new Date();

    if (existing) {
      const updated: TaskRecurrenceRule = {
        ...existing,
        frequency: input.frequency,
        interval: input.interval,
        weekdays: [...input.weekdays],
        endsOn: input.endsOn,
        updatedAt: now,
      };

      this.rules.set(taskId, updated);
      return updated;
    }

    const created: TaskRecurrenceRule = {
      id: `rule-${this.idCounter++}`,
      taskId,
      frequency: input.frequency,
      interval: input.interval,
      weekdays: [...input.weekdays],
      endsOn: input.endsOn,
      createdAt: now,
      updatedAt: now,
    };

    this.rules.set(taskId, created);
    return created;
  }

  async removeByTaskId(taskId: string): Promise<TaskRecurrenceRule | null> {
    const existing = this.rules.get(taskId);

    if (!existing) {
      return null;
    }

    this.rules.delete(taskId);
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

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

function authHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
  };
}

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new InMemoryTaskStore(),
    recurrenceStore: new InMemoryRecurrenceStore(),
    authStore: new InMemoryAuthStore(),
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

async function createTask(app: ReturnType<typeof createAppForTest>, token: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Daily sync",
      targetDate: "2026-03-06",
      status: "todo" satisfies TaskStatus,
      priority: "medium" satisfies TaskPriority,
    },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  return (body.data as { id: string }).id;
}

test("recurrence rules can be upserted and auto-generate future task instances", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const taskId = await createTask(app, token);

  const upsertResponse = await app.inject({
    method: "PUT",
    url: `/api/tasks/${taskId}/recurrence`,
    headers: authHeaders(token),
    payload: {
      frequency: "daily" satisfies RecurrenceFrequency,
      interval: 1,
    },
  });

  assert.equal(upsertResponse.statusCode, 200);

  const listFutureResponse = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-07",
    headers: authHeaders(token),
  });

  assert.equal(listFutureResponse.statusCode, 200);
  const listFuturePayload = parsePayload(listFutureResponse.payload);
  const futureTasks = listFuturePayload.data as Array<{ id: string; recurrenceSourceTaskId: string | null }>;

  assert.equal(futureTasks.length, 1);
  assert.equal(futureTasks[0].recurrenceSourceTaskId, taskId);

  const listFutureAgainResponse = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-07",
    headers: authHeaders(token),
  });

  assert.equal(listFutureAgainResponse.statusCode, 200);
  const listFutureAgainPayload = parsePayload(listFutureAgainResponse.payload);
  const futureTasksAgain = listFutureAgainPayload.data as Array<{ id: string }>;
  assert.equal(futureTasksAgain.length, 1);

  const deleteRuleResponse = await app.inject({
    method: "DELETE",
    url: `/api/tasks/${taskId}/recurrence`,
    headers: authHeaders(token),
  });

  assert.equal(deleteRuleResponse.statusCode, 200);

  const listAfterDeleteResponse = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-08",
    headers: authHeaders(token),
  });

  assert.equal(listAfterDeleteResponse.statusCode, 200);
  const listAfterDeletePayload = parsePayload(listAfterDeleteResponse.payload);
  const tasksAfterDelete = listAfterDeletePayload.data as Array<unknown>;
  assert.equal(tasksAfterDelete.length, 0);
});

test("recurrence cannot be configured on generated task instances", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const taskId = await createTask(app, token);

  await app.inject({
    method: "PUT",
    url: `/api/tasks/${taskId}/recurrence`,
    headers: authHeaders(token),
    payload: {
      frequency: "daily" satisfies RecurrenceFrequency,
      interval: 1,
    },
  });

  const generatedTasksResponse = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-07",
    headers: authHeaders(token),
  });

  assert.equal(generatedTasksResponse.statusCode, 200);
  const generatedTasksPayload = parsePayload(generatedTasksResponse.payload);
  const generatedTask = (generatedTasksPayload.data as Array<{ id: string }>)[0];

  const conflictResponse = await app.inject({
    method: "PUT",
    url: `/api/tasks/${generatedTask.id}/recurrence`,
    headers: authHeaders(token),
    payload: {
      frequency: "weekly" satisfies RecurrenceFrequency,
      interval: 1,
      weekdays: [1],
    },
  });

  assert.equal(conflictResponse.statusCode, 409);
  const conflictPayload = parsePayload(conflictResponse.payload);
  assert.deepEqual(conflictPayload.error, {
    code: "CONFLICT",
    message: "Recurrence can only be configured on source tasks.",
  });
});
