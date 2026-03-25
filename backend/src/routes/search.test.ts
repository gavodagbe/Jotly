import { Task } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import { createInMemoryAssistantSearchDocumentStore } from "../assistant/assistant-search-document-store";
import { AssistantSearchSyncService } from "../assistant/assistant-search-sync";
import {
  AuthSession,
  AuthStore,
  AuthUser,
  CreateAuthSessionInput,
  CreateAuthUserInput,
} from "../auth/auth-store";
import { TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

class NoopTaskStore implements TaskStore {
  async listByDate(_targetDate: Date, _userId: string): Promise<Task[]> { return []; }
  async listByUser(_userId: string): Promise<Task[]> { return []; }
  async getById(_id: string, _userId: string): Promise<Task | null> { return null; }
  async create(_input: TaskCreateInput): Promise<Task> { throw new Error("Not implemented"); }
  async update(_id: string, _input: TaskUpdateInput, _userId: string): Promise<Task | null> { return null; }
  async remove(_id: string, _userId: string): Promise<Task | null> { return null; }
}

class MutableTaskStore extends NoopTaskStore {
  private tasks: Task[] = [];

  setTasks(tasks: Task[]) {
    this.tasks = tasks;
  }

  async listByDate(targetDate: Date, userId: string): Promise<Task[]> {
    const targetDateKey = targetDate.toISOString().slice(0, 10);
    return this.tasks.filter(
      (task) =>
        task.userId === userId && task.targetDate.toISOString().slice(0, 10) === targetDateKey
    );
  }

  async listByUser(userId: string): Promise<Task[]> {
    return this.tasks.filter((task) => task.userId === userId);
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

const noopAssistantSearchSyncService: AssistantSearchSyncService = {
  async syncUserWorkspace() {
    return { documentCount: 0, changedCount: 0 };
  },
};

function makeTask(input: { id: string; userId: string; title: string; description: string | null }): Task {
  const now = new Date();
  return {
    id: input.id,
    userId: input.userId,
    rolledFromTaskId: null,
    title: input.title,
    description: input.description,
    status: "todo",
    targetDate: new Date("2026-03-18T00:00:00.000Z"),
    dueDate: null,
    priority: "medium",
    project: "Search",
    assignees: null,
    plannedTime: null,
    recurrenceSourceTaskId: null,
    recurrenceOccurrenceDate: null,
    calendarEventId: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    cancelledAt: null,
  };
}

function makeApp(options?: {
  taskStore?: TaskStore;
  assistantSearchSyncService?: AssistantSearchSyncService | null;
}) {
  const authStore = new InMemoryAuthStore();
  const searchDocumentStore = createInMemoryAssistantSearchDocumentStore();
  const app = buildApp({
    logLevel: "silent",
    authStore,
    taskStore: options?.taskStore ?? new NoopTaskStore(),
    assistantSearchDocumentStore: searchDocumentStore,
    assistantSearchSyncService:
      options?.assistantSearchSyncService === null
        ? undefined
        : options?.assistantSearchSyncService ?? noopAssistantSearchSyncService,
  });
  return { app, authStore, searchDocumentStore };
}

async function registerAndLogin(app: ReturnType<typeof makeApp>["app"]) {
  const email = `search-${Math.random().toString(36).slice(2)}@test.com`;
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password: "password123" },
  });
  assert.equal(response.statusCode, 201);
  const body = JSON.parse(response.body) as { data: { token: string; user: { id: string } } };
  return body.data;
}

test("GET /api/search — requires authentication", async () => {
  const { app } = makeApp();
  const response = await app.inject({ method: "GET", url: "/api/search?q=task" });
  assert.equal(response.statusCode, 401);
});

test("GET /api/search — rejects query shorter than 2 chars", async () => {
  const { app } = makeApp();
  const { token } = await registerAndLogin(app);
  const response = await app.inject({
    method: "GET",
    url: "/api/search?q=a",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 400);
});

test("GET /api/search — returns empty results for no matches", async () => {
  const { app } = makeApp();
  const { token } = await registerAndLogin(app);
  const response = await app.inject({
    method: "GET",
    url: "/api/search?q=nonexistent",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as {
    data: { results: unknown[]; totalCount: number; hasMore: boolean };
  };
  assert.equal(body.data.results.length, 0);
  assert.equal(body.data.totalCount, 0);
  assert.equal(body.data.hasMore, false);
});

test("GET /api/search — returns matching documents", async () => {
  const { app, searchDocumentStore } = makeApp();
  const { token, user } = await registerAndLogin(app);

  await searchDocumentStore.replaceUserDocuments(user.id, [
    {
      userId: user.id,
      sourceType: "task",
      sourceId: "task-1",
      title: "Meditation session",
      bodyText: "Deep focus meditation for concentration",
      metadataJson: { status: "todo", priority: "high" },
      contentHash: "hash1",
      sourceUpdatedAt: new Date(),
    },
    {
      userId: user.id,
      sourceType: "affirmation",
      sourceId: "affirmation-1",
      title: null,
      bodyText: "Stay focused and calm throughout the day",
      metadataJson: null,
      contentHash: "hash2",
      sourceUpdatedAt: new Date(),
    },
  ]);

  const response = await app.inject({
    method: "GET",
    url: "/api/search?q=focus",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as {
    data: { results: Array<{ sourceType: string }>; totalCount: number };
  };
  assert.ok(body.data.totalCount > 0, "Should have results");
  const sourceTypes = body.data.results.map((r) => r.sourceType);
  assert.ok(
    sourceTypes.includes("task") || sourceTypes.includes("affirmation"),
    "Should find task or affirmation"
  );
});

test("GET /api/search — returns results from pre-indexed documents", async () => {
  const { app, searchDocumentStore } = makeApp();
  const { token, user } = await registerAndLogin(app);

  await searchDocumentStore.replaceUserDocuments(user.id, [
    {
      userId: user.id,
      sourceType: "task",
      sourceId: "task-sync-1",
      title: "Focus block",
      bodyText: "Deep focus session for the morning",
      metadataJson: null,
      contentHash: "hash-sync-1",
      sourceUpdatedAt: new Date(),
    },
  ]);

  const response = await app.inject({
    method: "GET",
    url: "/api/search?q=focus",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as {
    data: {
      results: Array<{ sourceType: string; sourceId: string; title: string | null }>;
      totalCount: number;
    };
  };
  assert.equal(body.data.totalCount, 1);
  assert.deepEqual(body.data.results.map((result) => ({
    sourceType: result.sourceType,
    sourceId: result.sourceId,
    title: result.title,
  })), [{
    sourceType: "task",
    sourceId: "task-sync-1",
    title: "Focus block",
  }]);
});

test("GET /api/search — filters by sourceType", async () => {
  const { app, searchDocumentStore } = makeApp();
  const { token, user } = await registerAndLogin(app);

  await searchDocumentStore.replaceUserDocuments(user.id, [
    {
      userId: user.id,
      sourceType: "task",
      sourceId: "task-1",
      title: "Focus session",
      bodyText: "Deep focus work block",
      metadataJson: null,
      contentHash: "hash1",
      sourceUpdatedAt: new Date(),
    },
    {
      userId: user.id,
      sourceType: "reminder",
      sourceId: "reminder-1",
      title: "Focus reminder",
      bodyText: "Remember to focus on priorities",
      metadataJson: null,
      contentHash: "hash2",
      sourceUpdatedAt: new Date(),
    },
  ]);

  const response = await app.inject({
    method: "GET",
    url: "/api/search?q=focus&types=reminder",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as {
    data: { results: Array<{ sourceType: string }> };
  };
  for (const result of body.data.results) {
    assert.equal(result.sourceType, "reminder");
  }
});

test("GET /api/search — filters by note sourceType", async () => {
  const { app, searchDocumentStore } = makeApp();
  const { token, user } = await registerAndLogin(app);

  await searchDocumentStore.replaceUserDocuments(user.id, [
    {
      userId: user.id,
      sourceType: "task",
      sourceId: "task-1",
      title: "Focus task",
      bodyText: "Task body for focus",
      metadataJson: null,
      contentHash: "hash-task",
      sourceUpdatedAt: new Date(),
    },
    {
      userId: user.id,
      sourceType: "note",
      sourceId: "note-1",
      title: "Focus note",
      bodyText: "Note body for focus",
      metadataJson: null,
      contentHash: "hash-note",
      sourceUpdatedAt: new Date(),
    },
  ]);

  const response = await app.inject({
    method: "GET",
    url: "/api/search?q=focus&types=note",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as {
    data: { results: Array<{ sourceType: string; sourceId: string }> };
  };
  assert.deepEqual(
    body.data.results.map((result) => ({
      sourceType: result.sourceType,
      sourceId: result.sourceId,
    })),
    [{ sourceType: "note", sourceId: "note-1" }]
  );
});

test("GET /api/search — pagination works", async () => {
  const { app, searchDocumentStore } = makeApp();
  const { token, user } = await registerAndLogin(app);

  const docs = Array.from({ length: 5 }, (_, i) => ({
    userId: user.id,
    sourceType: "task" as const,
    sourceId: `task-${i + 1}`,
    title: `Workout session ${i + 1}`,
    bodyText: `Morning workout routine number ${i + 1}`,
    metadataJson: null,
    contentHash: `hash${i}`,
    sourceUpdatedAt: new Date(),
  }));
  await searchDocumentStore.replaceUserDocuments(user.id, docs);

  const page1 = await app.inject({
    method: "GET",
    url: "/api/search?q=workout&limit=2&page=1",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(page1.statusCode, 200);
  const body1 = JSON.parse(page1.body) as {
    data: { results: unknown[]; totalCount: number; hasMore: boolean; page: number };
  };
  assert.equal(body1.data.results.length, 2);
  assert.equal(body1.data.page, 1);
  assert.equal(body1.data.hasMore, true);

  const page2 = await app.inject({
    method: "GET",
    url: "/api/search?q=workout&limit=2&page=2",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(page2.statusCode, 200);
  const body2 = JSON.parse(page2.body) as {
    data: { results: unknown[]; hasMore: boolean };
  };
  assert.equal(body2.data.results.length, 2);
});

test("GET /api/search — date range filter: to=yesterday excludes recently inserted docs", async () => {
  const { app, searchDocumentStore } = makeApp();
  const { token, user } = await registerAndLogin(app);

  await searchDocumentStore.replaceUserDocuments(user.id, [
    {
      userId: user.id,
      sourceType: "task",
      sourceId: "task-1",
      title: "Planning session",
      bodyText: "Important planning work",
      metadataJson: null,
      contentHash: "hash1",
      sourceUpdatedAt: new Date(),
    },
  ]);

  // Documents are inserted with updatedAt=now. A `to` set to yesterday should exclude them.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const responseExcluded = await app.inject({
    method: "GET",
    url: `/api/search?q=planning&to=${yesterday}`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(responseExcluded.statusCode, 200);
  const bodyExcluded = JSON.parse(responseExcluded.body) as {
    data: { totalCount: number };
  };
  assert.equal(bodyExcluded.data.totalCount, 0, "Document created today should be excluded by to=yesterday");

  // A `from` set to yesterday should include them (today >= yesterday).
  const responseIncluded = await app.inject({
    method: "GET",
    url: `/api/search?q=planning&from=${yesterday}`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(responseIncluded.statusCode, 200);
  const bodyIncluded = JSON.parse(responseIncluded.body) as {
    data: { totalCount: number };
  };
  assert.ok(bodyIncluded.data.totalCount > 0, "Document created today should be included by from=yesterday");
});

test("GET /api/search — does not return other users documents", async () => {
  const { app, searchDocumentStore } = makeApp();
  const { token } = await registerAndLogin(app);

  await searchDocumentStore.replaceUserDocuments("other-user-id", [
    {
      userId: "other-user-id",
      sourceType: "task",
      sourceId: "other-task",
      title: "Secret project",
      bodyText: "Confidential planning for secret project",
      metadataJson: null,
      contentHash: "hash-other",
      sourceUpdatedAt: new Date(),
    },
  ]);

  const response = await app.inject({
    method: "GET",
    url: "/api/search?q=secret",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as {
    data: { results: unknown[]; totalCount: number };
  };
  assert.equal(body.data.totalCount, 0);
  assert.equal(body.data.results.length, 0);
});

test("GET /api/search — rejects invalid from date", async () => {
  const { app } = makeApp();
  const { token } = await registerAndLogin(app);
  const response = await app.inject({
    method: "GET",
    url: "/api/search?q=task&from=not-a-date",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 400);
});

test("searchDirect — returns vector-matched results when embedding is provided", async () => {
  const store = createInMemoryAssistantSearchDocumentStore();
  const userId = "user-vec-1";
  const queryEmbedding = [1, 0, 0];

  // Seed a document with an embedding that will NOT match full-text but WILL match via vector
  await store.replaceUserDocuments(userId, [
    {
      userId,
      sourceType: "note",
      sourceId: "note-vector-1",
      title: "Meeting prep",
      bodyText: "Quarterly review agenda items",
      metadataJson: null,
      contentHash: "hash-vec",
      sourceUpdatedAt: new Date(),
      embedding: [1, 0, 0],
    },
  ]);

  const result = await store.searchDirect(userId, "zz", { embedding: queryEmbedding });

  assert.ok(result.totalCount > 0, "Should return vector-matched result");
  assert.equal(result.results[0].matchedBy, "vector");
  assert.equal(result.results[0].sourceId, "note-vector-1");
});

test("searchDirect — hybrid mode deduplicates and returns highest score per document", async () => {
  const store = createInMemoryAssistantSearchDocumentStore();
  const userId = "user-hybrid-1";
  const queryEmbedding = [1, 0, 0];

  await store.replaceUserDocuments(userId, [
    {
      userId,
      sourceType: "task",
      sourceId: "ft-only",
      title: "Planning session",
      bodyText: "Focus on quarterly planning work",
      metadataJson: null,
      contentHash: "hash-ft",
      sourceUpdatedAt: new Date(),
    },
    {
      userId,
      sourceType: "note",
      sourceId: "vec-only",
      title: "Random note",
      bodyText: "Completely unrelated content here",
      metadataJson: null,
      contentHash: "hash-vec",
      sourceUpdatedAt: new Date(),
      embedding: [1, 0, 0],
    },
    {
      userId,
      sourceType: "reminder",
      sourceId: "both-match",
      title: "Focus planning reminder",
      bodyText: "Remember to focus on quarterly planning",
      metadataJson: null,
      contentHash: "hash-both",
      sourceUpdatedAt: new Date(),
      embedding: [1, 0, 0],
    },
  ]);

  const result = await store.searchDirect(userId, "focus", { embedding: queryEmbedding });
  const sourceIds = result.results.map((r) => r.sourceId);

  assert.ok(sourceIds.includes("ft-only"), "Full-text-only match should be present");
  assert.ok(sourceIds.includes("vec-only"), "Vector-only match should be present");
  assert.ok(sourceIds.includes("both-match"), "Both-match document should appear once");
  assert.equal(new Set(sourceIds).size, sourceIds.length, "No duplicate sourceIds");
});
