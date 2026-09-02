import { Reminder, Task } from "@prisma/client";
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
import { InMemoryProjectStore } from "../projects/project-store.in-memory";
import { TaskStore } from "../tasks/task-store";
import { ReminderStore } from "../reminders/reminder-store";

class InMemoryAuthStore implements AuthStore {
  private readonly users = new Map<string, AuthUser>();
  private readonly usersByEmail = new Map<string, AuthUser>();
  private readonly sessionsByTokenHash = new Map<string, AuthSession>();
  private userCounter = 1;
  private sessionCounter = 1;

  async createUser(input: CreateAuthUserInput): Promise<AuthUser> {
    const now = new Date();
    const user: AuthUser = {
      id: `user-${this.userCounter++}`,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      preferredLocale: "en",
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user);
    return user;
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> { return this.usersByEmail.get(email) ?? null; }
  async findUserById(id: string): Promise<AuthUser | null> { return this.users.get(id) ?? null; }
  async createSession(input: CreateAuthSessionInput): Promise<AuthSession> {
    const session: AuthSession = {
      id: `session-${this.sessionCounter++}`,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      revokedAt: null,
    };
    this.sessionsByTokenHash.set(session.tokenHash, session);
    return session;
  }
  async findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null> {
    return this.sessionsByTokenHash.get(tokenHash) ?? null;
  }
  async revokeSession(): Promise<void> {}
  async deleteExpiredSessions(): Promise<void> {}
}

type DenormCall = { projectIds: string[]; fields: { project?: string | null; subProject?: string | null } };

/** Minimal task store that only exercises the project-facing hooks. */
class ProjectAwareTaskStore implements TaskStore {
  readonly denormCalls: DenormCall[] = [];
  counts: Record<string, number> = {};

  async listByDate(): Promise<Task[]> { return []; }
  async listByUser(): Promise<Task[]> { return []; }
  async getById(): Promise<Task | null> { return null; }
  async create(): Promise<Task> { throw new Error("Not implemented"); }
  async update(): Promise<Task | null> { return null; }
  async remove(): Promise<Task | null> { return null; }

  async countByProjectIds(_userId: string, projectIds: string[]): Promise<number> {
    return projectIds.reduce((total, id) => total + (this.counts[id] ?? 0), 0);
  }
  async groupCountByProject(): Promise<Record<string, number>> {
    return { ...this.counts };
  }
  async updateDenormalizedProjectFields(
    projectIds: string[],
    fields: { project?: string | null; subProject?: string | null }
  ): Promise<number> {
    this.denormCalls.push({ projectIds, fields });
    return projectIds.length;
  }
}

class ProjectAwareReminderStore implements ReminderStore {
  readonly denormCalls: DenormCall[] = [];
  counts: Record<string, number> = {};

  async listByUser(): Promise<Reminder[]> { return []; }
  async listPending(): Promise<Reminder[]> { return []; }
  async getById(): Promise<Reminder | null> { return null; }
  async create(): Promise<Reminder> { throw new Error("Not implemented"); }
  async update(): Promise<Reminder | null> { return null; }
  async remove(): Promise<Reminder | null> { return null; }
  async markFired(): Promise<Reminder | null> { return null; }
  async complete(): Promise<Reminder | null> { return null; }
  async cancel(): Promise<Reminder | null> { return null; }

  async countByProjectIds(_userId: string, projectIds: string[]): Promise<number> {
    return projectIds.reduce((total, id) => total + (this.counts[id] ?? 0), 0);
  }
  async groupCountByProject(): Promise<Record<string, number>> {
    return { ...this.counts };
  }
  async updateDenormalizedProjectFields(
    projectIds: string[],
    fields: { project?: string | null; subProject?: string | null }
  ): Promise<number> {
    this.denormCalls.push({ projectIds, fields });
    return projectIds.length;
  }
}

function createAppForTest() {
  const taskStore = new ProjectAwareTaskStore();
  const reminderStore = new ProjectAwareReminderStore();
  const app = buildApp({
    logLevel: "silent",
    taskStore,
    reminderStore,
    authStore: new InMemoryAuthStore(),
    projectStore: new InMemoryProjectStore(),
  });
  return { app, taskStore, reminderStore };
}

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

async function registerAndGetToken(app: ReturnType<typeof createAppForTest>["app"]): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: `admin-${Math.random().toString(36).slice(2)}@example.com`, password: "password123" },
  });
  assert.equal(response.statusCode, 201);
  return (parsePayload(response.payload).data as { token: string }).token;
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function createProject(
  app: ReturnType<typeof createAppForTest>["app"],
  token: string,
  payload: { name: string; parentId?: string }
): Promise<{ id: string; name: string; parentId: string | null }> {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects",
    headers: authHeaders(token),
    payload,
  });
  assert.equal(response.statusCode, 201, response.payload);
  return parsePayload(response.payload).data as { id: string; name: string; parentId: string | null };
}

function move(
  app: ReturnType<typeof createAppForTest>["app"],
  token: string,
  id: string,
  parentId: string | null
) {
  return app.inject({
    method: "PATCH",
    url: `/api/projects/${id}/move`,
    headers: authHeaders(token),
    payload: { parentId },
  });
}

test("GET /api/projects/overview returns the tree with per-node reference counts", async (t) => {
  const built = createAppForTest();
  t.after(async () => { await built.app.close(); });
  const token = await registerAndGetToken(built.app);

  const parent = await createProject(built.app, token, { name: "Acme" });
  const child = await createProject(built.app, token, { name: "Website", parentId: parent.id });

  built.taskStore.counts = { [parent.id]: 3, [child.id]: 1 };
  built.reminderStore.counts = { [child.id]: 2 };

  const response = await built.app.inject({
    method: "GET",
    url: "/api/projects/overview",
    headers: authHeaders(token),
  });
  assert.equal(response.statusCode, 200);
  const data = parsePayload(response.payload).data as Array<{
    id: string;
    taskCount: number;
    reminderCount: number;
    children: Array<{ id: string; taskCount: number; reminderCount: number }>;
  }>;
  assert.equal(data.length, 1);
  assert.equal(data[0].id, parent.id);
  assert.equal(data[0].taskCount, 3);
  assert.equal(data[0].reminderCount, 0);
  assert.equal(data[0].children.length, 1);
  assert.equal(data[0].children[0].id, child.id);
  assert.equal(data[0].children[0].taskCount, 1);
  assert.equal(data[0].children[0].reminderCount, 2);
});

test("PATCH /api/projects/:id/move downgrades a top-level project to a sub-project", async (t) => {
  const built = createAppForTest();
  t.after(async () => { await built.app.close(); });
  const token = await registerAndGetToken(built.app);

  const keep = await createProject(built.app, token, { name: "Portfolio" });
  const demoted = await createProject(built.app, token, { name: "Side Project" });

  const response = await move(built.app, token, demoted.id, keep.id);
  assert.equal(response.statusCode, 200, response.payload);
  assert.equal((parsePayload(response.payload).data as { parentId: string | null }).parentId, keep.id);

  assert.deepEqual(built.taskStore.denormCalls, [
    { projectIds: [demoted.id], fields: { project: "Portfolio", subProject: "Side Project" } },
  ]);
  assert.deepEqual(built.reminderStore.denormCalls, [
    { projectIds: [demoted.id], fields: { project: "Portfolio", subProject: "Side Project" } },
  ]);
});

test("PATCH /api/projects/:id/move blocks downgrading a project that still has sub-projects", async (t) => {
  const built = createAppForTest();
  t.after(async () => { await built.app.close(); });
  const token = await registerAndGetToken(built.app);

  const keep = await createProject(built.app, token, { name: "Keep" });
  const demoted = await createProject(built.app, token, { name: "HasChild" });
  await createProject(built.app, token, { name: "Leaf", parentId: demoted.id });

  const response = await move(built.app, token, demoted.id, keep.id);
  assert.equal(response.statusCode, 409);
  assert.equal((parsePayload(response.payload).error as { code: string }).code, "CONFLICT");
  assert.equal(built.taskStore.denormCalls.length, 0);
});

test("PATCH /api/projects/:id/move promotes a sub-project to top level", async (t) => {
  const built = createAppForTest();
  t.after(async () => { await built.app.close(); });
  const token = await registerAndGetToken(built.app);

  const parent = await createProject(built.app, token, { name: "Parent" });
  const child = await createProject(built.app, token, { name: "Child", parentId: parent.id });

  const response = await move(built.app, token, child.id, null);
  assert.equal(response.statusCode, 200, response.payload);
  assert.equal((parsePayload(response.payload).data as { parentId: string | null }).parentId, null);
  assert.deepEqual(built.taskStore.denormCalls, [
    { projectIds: [child.id], fields: { project: "Child", subProject: null } },
  ]);
});

test("PATCH /api/projects/:id/move re-parents a sub-project to another project", async (t) => {
  const built = createAppForTest();
  t.after(async () => { await built.app.close(); });
  const token = await registerAndGetToken(built.app);

  const from = await createProject(built.app, token, { name: "From" });
  const to = await createProject(built.app, token, { name: "To" });
  const child = await createProject(built.app, token, { name: "Feature", parentId: from.id });

  const response = await move(built.app, token, child.id, to.id);
  assert.equal(response.statusCode, 200, response.payload);
  assert.equal((parsePayload(response.payload).data as { parentId: string | null }).parentId, to.id);
  assert.deepEqual(built.taskStore.denormCalls, [
    { projectIds: [child.id], fields: { project: "To", subProject: "Feature" } },
  ]);
});

test("PATCH /api/projects/:id/move rejects moving under a sub-project (would nest 3 levels)", async (t) => {
  const built = createAppForTest();
  t.after(async () => { await built.app.close(); });
  const token = await registerAndGetToken(built.app);

  const parent = await createProject(built.app, token, { name: "Parent" });
  const child = await createProject(built.app, token, { name: "Child", parentId: parent.id });
  const loner = await createProject(built.app, token, { name: "Loner" });

  const response = await move(built.app, token, loner.id, child.id);
  assert.equal(response.statusCode, 400);
  assert.equal((parsePayload(response.payload).error as { code: string }).code, "VALIDATION_ERROR");
});

test("PATCH /api/projects/:id/move rejects moving a project into itself", async (t) => {
  const built = createAppForTest();
  t.after(async () => { await built.app.close(); });
  const token = await registerAndGetToken(built.app);

  const project = await createProject(built.app, token, { name: "Self" });
  const response = await move(built.app, token, project.id, project.id);
  assert.equal(response.statusCode, 400);
  assert.equal((parsePayload(response.payload).error as { code: string }).code, "VALIDATION_ERROR");
});

test("PATCH /api/projects/:id/move rejects a name clash in the target parent", async (t) => {
  const built = createAppForTest();
  t.after(async () => { await built.app.close(); });
  const token = await registerAndGetToken(built.app);

  const target = await createProject(built.app, token, { name: "Target" });
  await createProject(built.app, token, { name: "Shared", parentId: target.id });
  const conflicting = await createProject(built.app, token, { name: "Shared" });

  const response = await move(built.app, token, conflicting.id, target.id);
  assert.equal(response.statusCode, 409);
  assert.equal((parsePayload(response.payload).error as { code: string }).code, "CONFLICT");
});

test("PATCH /api/projects/:id/move returns 404 for an unknown parent", async (t) => {
  const built = createAppForTest();
  t.after(async () => { await built.app.close(); });
  const token = await registerAndGetToken(built.app);

  const project = await createProject(built.app, token, { name: "Orphan" });
  const response = await move(built.app, token, project.id, "missing-parent");
  assert.equal(response.statusCode, 404);
});

test("project admin endpoints require authentication", async (t) => {
  const built = createAppForTest();
  t.after(async () => { await built.app.close(); });

  assert.equal((await built.app.inject({ method: "GET", url: "/api/projects/overview" })).statusCode, 401);
  assert.equal(
    (await built.app.inject({ method: "PATCH", url: "/api/projects/x/move", payload: { parentId: null } })).statusCode,
    401
  );
});

test("PATCH /api/projects/:id/move is scoped per user", async (t) => {
  const built = createAppForTest();
  t.after(async () => { await built.app.close(); });
  const tokenA = await registerAndGetToken(built.app);
  const tokenB = await registerAndGetToken(built.app);

  const owned = await createProject(built.app, tokenA, { name: "A owned" });
  const response = await move(built.app, tokenB, owned.id, null);
  assert.equal(response.statusCode, 404);
});
