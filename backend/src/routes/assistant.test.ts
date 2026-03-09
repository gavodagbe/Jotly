import { Task, TaskComment, TaskPriority, TaskStatus } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { AssistantReplyInput, AssistantService } from "../assistant/assistant-service";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import { CommentStore, TaskCommentCreateInput, TaskCommentUpdateInput } from "../comments/comment-store";
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
    return matches.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async listByUser(userId: string): Promise<Task[]> {
    const matches = [...this.tasks.values()].filter((task) => task.userId === userId);
    return matches.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
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

class InMemoryCommentStore implements CommentStore {
  private readonly comments = new Map<string, TaskComment>();
  private idCounter = 1;

  async listByTaskId(taskId: string): Promise<TaskComment[]> {
    return [...this.comments.values()]
      .filter((comment) => comment.taskId === taskId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async getById(id: string): Promise<TaskComment | null> {
    return this.comments.get(id) ?? null;
  }

  async create(input: TaskCommentCreateInput): Promise<TaskComment> {
    const now = new Date();
    const comment: TaskComment = {
      id: `comment-${this.idCounter++}`,
      taskId: input.taskId,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    };

    this.comments.set(comment.id, comment);
    return comment;
  }

  async update(id: string, input: TaskCommentUpdateInput): Promise<TaskComment | null> {
    const existing = this.comments.get(id);

    if (!existing) {
      return null;
    }

    const updated: TaskComment = {
      ...existing,
      body: input.body,
      updatedAt: new Date(),
    };

    this.comments.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<TaskComment | null> {
    const existing = this.comments.get(id);

    if (!existing) {
      return null;
    }

    this.comments.delete(id);
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

class EchoAssistantService implements AssistantService {
  async generateReply(input: AssistantReplyInput) {
    const firstTaskTitle = input.tasks[0]?.title ?? "none";

    return {
      answer: `tasks=${input.tasks.length};first=${firstTaskTitle};question=${input.question}`,
      source: "heuristic" as const,
      warning: null,
    };
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
    commentStore: new InMemoryCommentStore(),
    authStore: new InMemoryAuthStore(),
    assistantService: new EchoAssistantService(),
  });
}

function createAppForHeuristicLanguageTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new InMemoryTaskStore(),
    commentStore: new InMemoryCommentStore(),
    authStore: new InMemoryAuthStore(),
    assistantProvider: "heuristic",
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

async function createTask(
  app: ReturnType<typeof createAppForTest>,
  token: string,
  title: string,
  targetDate = "2026-03-06"
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title,
      targetDate,
      status: "todo" satisfies TaskStatus,
      priority: "high" satisfies TaskPriority,
    },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  return (body.data as { id: string }).id;
}

test("POST /api/assistant/reply returns assistant guidance with usage metadata across all user dates", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const firstTaskId = await createTask(app, token, "Finish release note", "2026-03-06");
  await createTask(app, token, "Prepare sprint recap", "2026-03-07");

  const commentResponse = await app.inject({
    method: "POST",
    url: `/api/tasks/${firstTaskId}/comments`,
    headers: authHeaders(token),
    payload: {
      body: "Waiting for copy review",
    },
  });

  assert.equal(commentResponse.statusCode, 201);

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "What should I do first?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.equal(data.source, "heuristic");
  assert.equal(data.usedTaskCount, 2);
  assert.equal(data.usedCommentCount, 1);
  assert.match(String(data.answer), /tasks=2/);
});

test("POST /api/assistant/reply requires authentication", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    payload: {
      question: "What is next?",
    },
  });

  assert.equal(response.statusCode, 401);
});

test("POST /api/assistant/reply only uses tasks from authenticated user", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const ownerToken = await registerAndGetToken(app);
  const otherUserToken = await registerAndGetToken(app);

  await createTask(app, ownerToken, "Owner private task");

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(otherUserToken),
    payload: {
      question: "What should I focus on?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.equal(data.usedTaskCount, 0);
  assert.match(String(data.answer), /tasks=0/);
});

test("POST /api/assistant/reply validates body", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "",
    },
  });

  assert.equal(response.statusCode, 400);
  const body = parsePayload(response.payload);
  const error = body.error as { code: string; details?: string[] };

  assert.equal(error.code, "VALIDATION_ERROR");
  assert.ok(Array.isArray(error.details));
  assert.ok(error.details && error.details.length >= 1);
});

test("POST /api/assistant/reply keeps English planning response for English 'comment' prompts", async (t) => {
  const app = createAppForHeuristicLanguageTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  await createTask(app, token, "Finish roadmap review");

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "Can you comment on my priorities?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as { answer: string; source: string };

  assert.equal(data.source, "heuristic");
  assert.match(data.answer, /User task overview/);
  assert.doesNotMatch(data.answer, /Vue d'ensemble des taches utilisateur/);
});
