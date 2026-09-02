import { Task } from "@prisma/client";
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
import { TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

class NoopTaskStore implements TaskStore {
  async listByDate(): Promise<Task[]> { return []; }
  async listByUser(): Promise<Task[]> { return []; }
  async getById(): Promise<Task | null> { return null; }
  async create(_input: TaskCreateInput): Promise<Task> { throw new Error("Not implemented"); }
  async update(_id: string, _input: TaskUpdateInput, _userId: string): Promise<Task | null> { return null; }
  async remove(): Promise<Task | null> { return null; }
}

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

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new NoopTaskStore(),
    authStore: new InMemoryAuthStore(),
    projectStore: new InMemoryProjectStore(),
  });
}

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

async function registerAndGetToken(app: ReturnType<typeof createAppForTest>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: `project-${Math.random().toString(36).slice(2)}@example.com`, password: "password123" },
  });
  assert.equal(response.statusCode, 201);
  return (parsePayload(response.payload).data as { token: string }).token;
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function createProject(
  app: ReturnType<typeof createAppForTest>,
  token: string,
  payload: { name: string; parentId?: string }
) {
  return app.inject({
    method: "POST",
    url: "/api/projects",
    headers: authHeaders(token),
    payload,
  });
}

test("GET /api/projects returns an empty tree for a new user", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const response = await app.inject({ method: "GET", url: "/api/projects", headers: authHeaders(token) });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(parsePayload(response.payload).data, []);
});

test("POST /api/projects creates a top-level project then a sub-project, returned as a tree", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const parentResponse = await createProject(app, token, { name: "  Acme   Corp  " });
  assert.equal(parentResponse.statusCode, 201);
  const parent = parsePayload(parentResponse.payload).data as { id: string; name: string; parentId: string | null };
  assert.equal(parent.name, "Acme Corp");
  assert.equal(parent.parentId, null);

  const childResponse = await createProject(app, token, { name: "Website", parentId: parent.id });
  assert.equal(childResponse.statusCode, 201);
  const child = parsePayload(childResponse.payload).data as { parentId: string | null };
  assert.equal(child.parentId, parent.id);

  const treeResponse = await app.inject({ method: "GET", url: "/api/projects", headers: authHeaders(token) });
  const tree = parsePayload(treeResponse.payload).data as Array<{
    id: string;
    name: string;
    children: Array<{ name: string }>;
  }>;
  assert.equal(tree.length, 1);
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].name, "Website");
});

test("POST /api/projects rejects a third nesting level", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const parent = parsePayload((await createProject(app, token, { name: "Parent" })).payload).data as { id: string };
  const child = parsePayload(
    (await createProject(app, token, { name: "Child", parentId: parent.id })).payload
  ).data as { id: string };

  const grandChildResponse = await createProject(app, token, { name: "GrandChild", parentId: child.id });
  assert.equal(grandChildResponse.statusCode, 400);
  assert.equal((parsePayload(grandChildResponse.payload).error as { code: string }).code, "VALIDATION_ERROR");
});

test("POST /api/projects rejects a duplicate sibling name (case-insensitive)", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  assert.equal((await createProject(app, token, { name: "Marketing" })).statusCode, 201);
  const duplicate = await createProject(app, token, { name: "  marketing " });
  assert.equal(duplicate.statusCode, 409);
  assert.equal((parsePayload(duplicate.payload).error as { code: string }).code, "CONFLICT");
});

test("POST /api/projects allows the same name under different parents", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const a = parsePayload((await createProject(app, token, { name: "Client A" })).payload).data as { id: string };
  const b = parsePayload((await createProject(app, token, { name: "Client B" })).payload).data as { id: string };

  assert.equal((await createProject(app, token, { name: "Onboarding", parentId: a.id })).statusCode, 201);
  assert.equal((await createProject(app, token, { name: "Onboarding", parentId: b.id })).statusCode, 201);
});

test("POST /api/projects returns 404 for an unknown parent", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const response = await createProject(app, token, { name: "Orphan", parentId: "does-not-exist" });
  assert.equal(response.statusCode, 404);
});

test("PATCH /api/projects/:id renames a project", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const project = parsePayload((await createProject(app, token, { name: "Old" })).payload).data as { id: string };

  const response = await app.inject({
    method: "PATCH",
    url: `/api/projects/${project.id}`,
    headers: authHeaders(token),
    payload: { name: "New Name" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal((parsePayload(response.payload).data as { name: string }).name, "New Name");
});

test("DELETE /api/projects/:id removes a leaf project but blocks one with sub-projects", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const parent = parsePayload((await createProject(app, token, { name: "Parent" })).payload).data as { id: string };
  const child = parsePayload(
    (await createProject(app, token, { name: "Child", parentId: parent.id })).payload
  ).data as { id: string };

  const blocked = await app.inject({
    method: "DELETE",
    url: `/api/projects/${parent.id}`,
    headers: authHeaders(token),
  });
  assert.equal(blocked.statusCode, 409);
  assert.equal((parsePayload(blocked.payload).error as { code: string }).code, "CONFLICT");

  const removeChild = await app.inject({
    method: "DELETE",
    url: `/api/projects/${child.id}`,
    headers: authHeaders(token),
  });
  assert.equal(removeChild.statusCode, 200);

  const removeParent = await app.inject({
    method: "DELETE",
    url: `/api/projects/${parent.id}`,
    headers: authHeaders(token),
  });
  assert.equal(removeParent.statusCode, 200);
});

test("project endpoints require authentication", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const response = await app.inject({ method: "GET", url: "/api/projects" });
  assert.equal(response.statusCode, 401);
});

test("projects are scoped per user", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const tokenA = await registerAndGetToken(app);
  const tokenB = await registerAndGetToken(app);

  const project = parsePayload((await createProject(app, tokenA, { name: "A only" })).payload).data as { id: string };

  const readByB = await app.inject({ method: "GET", url: "/api/projects", headers: authHeaders(tokenB) });
  assert.deepEqual(parsePayload(readByB.payload).data, []);

  const deleteByB = await app.inject({
    method: "DELETE",
    url: `/api/projects/${project.id}`,
    headers: authHeaders(tokenB),
  });
  assert.equal(deleteByB.statusCode, 404);
});
