import { Task, TaskAttachment, TaskPriority, TaskStatus } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { AttachmentStore, TaskAttachmentCreateInput } from "../attachments/attachment-store";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import { buildApp } from "../app";
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
      plannedTime: input.plannedTime,
      rolledFromTaskId: input.rolledFromTaskId ?? null,
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

  async update(id: string, input: TaskUpdateInput, userId: string): Promise<Task | null> {
    const existing = this.tasks.get(id);

    if (!existing || existing.userId !== userId) {
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

  async remove(id: string, userId: string): Promise<Task | null> {
    const existing = this.tasks.get(id);

    if (!existing || existing.userId !== userId) {
      return null;
    }

    this.tasks.delete(id);
    return existing;
  }
}

class InMemoryAttachmentStore implements AttachmentStore {
  private readonly attachments = new Map<string, TaskAttachment>();
  private idCounter = 1;

  async listByTaskId(taskId: string): Promise<TaskAttachment[]> {
    return [...this.attachments.values()]
      .filter((attachment) => attachment.taskId === taskId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async getById(id: string): Promise<TaskAttachment | null> {
    return this.attachments.get(id) ?? null;
  }

  async create(input: TaskAttachmentCreateInput): Promise<TaskAttachment> {
    const attachment: TaskAttachment = {
      id: `attachment-${this.idCounter++}`,
      taskId: input.taskId,
      name: input.name,
      url: input.url,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      createdAt: new Date(),
    };

    this.attachments.set(attachment.id, attachment);
    return attachment;
  }

  async remove(id: string): Promise<TaskAttachment | null> {
    const existing = this.attachments.get(id);

    if (!existing) {
      return null;
    }

    this.attachments.delete(id);
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
    attachmentStore: new InMemoryAttachmentStore(),
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
      title: "Task with attachments",
      targetDate: "2026-03-06",
      status: "todo" satisfies TaskStatus,
      priority: "medium" satisfies TaskPriority,
    },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  return (body.data as { id: string }).id;
}

test("attachments endpoints support create, list, and delete", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const taskId = await createTask(app, token);

  const createResponse = await app.inject({
    method: "POST",
    url: `/api/tasks/${taskId}/attachments`,
    headers: authHeaders(token),
    payload: {
      name: "Spec",
      url: "data:text/plain;base64,SGVsbG8gSm90bHk=",
      contentType: "application/pdf",
      sizeBytes: 2048,
    },
  });

  assert.equal(createResponse.statusCode, 201);
  const createPayload = parsePayload(createResponse.payload);
  const createdAttachment = createPayload.data as { id: string; name: string; url: string };
  assert.equal(createdAttachment.name, "Spec");

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/tasks/${taskId}/attachments`,
    headers: authHeaders(token),
  });

  assert.equal(listResponse.statusCode, 200);
  const listPayload = parsePayload(listResponse.payload);
  const listedAttachments = listPayload.data as Array<{ id: string; url: string }>;
  assert.equal(listedAttachments.length, 1);
  assert.equal(listedAttachments[0].url, "data:text/plain;base64,SGVsbG8gSm90bHk=");

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/tasks/${taskId}/attachments/${createdAttachment.id}`,
    headers: authHeaders(token),
  });

  assert.equal(deleteResponse.statusCode, 200);

  const listAfterDelete = await app.inject({
    method: "GET",
    url: `/api/tasks/${taskId}/attachments`,
    headers: authHeaders(token),
  });

  assert.equal(listAfterDelete.statusCode, 200);
  const listAfterDeletePayload = parsePayload(listAfterDelete.payload);
  const listAfterDeleteData = listAfterDeletePayload.data as Array<unknown>;
  assert.equal(listAfterDeleteData.length, 0);
});

test("attachments endpoints reject files larger than upload limit", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const taskId = await createTask(app, token);

  const oversizedResponse = await app.inject({
    method: "POST",
    url: `/api/tasks/${taskId}/attachments`,
    headers: authHeaders(token),
    payload: {
      name: "Too big",
      url: "data:text/plain;base64,SGVsbG8=",
      sizeBytes: 5 * 1024 * 1024 + 1,
    },
  });

  assert.equal(oversizedResponse.statusCode, 400);
});

test("attachments endpoints enforce task ownership boundaries", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const ownerToken = await registerAndGetToken(app);
  const otherUserToken = await registerAndGetToken(app);
  const taskId = await createTask(app, ownerToken);

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/tasks/${taskId}/attachments`,
    headers: authHeaders(otherUserToken),
  });

  assert.equal(listResponse.statusCode, 404);

  const createResponse = await app.inject({
    method: "POST",
    url: `/api/tasks/${taskId}/attachments`,
    headers: authHeaders(otherUserToken),
    payload: {
      name: "Spec",
      url: "https://example.com/spec.pdf",
    },
  });

  assert.equal(createResponse.statusCode, 404);
});

test("attachments endpoints require authentication", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/tasks/task-1/attachments",
  });

  assert.equal(response.statusCode, 401);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "UNAUTHORIZED",
    message: "Authentication is required",
  });
});
