import { Task } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import { buildApp } from "../app";
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
    throw new Error("Not implemented for auth tests");
  }

  async update(_id: string, _input: TaskUpdateInput, _userId: string): Promise<Task | null> {
    return null;
  }

  async remove(_id: string, _userId: string): Promise<Task | null> {
    return null;
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

class DuplicateOnCreateAuthStore implements AuthStore {
  async createUser(_input: CreateAuthUserInput): Promise<AuthUser> {
    throw { code: "P2002" };
  }

  async findUserByEmail(_email: string): Promise<AuthUser | null> {
    return null;
  }

  async findUserById(_id: string): Promise<AuthUser | null> {
    return null;
  }

  async createSession(_input: CreateAuthSessionInput): Promise<AuthSession> {
    throw new Error("Unexpected createSession call");
  }

  async findSessionByTokenHash(_tokenHash: string): Promise<AuthSession | null> {
    return null;
  }

  async revokeSession(_sessionId: string): Promise<void> {}

  async deleteExpiredSessions(_now: Date): Promise<void> {}
}

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new NoopTaskStore(),
    authStore: new InMemoryAuthStore(),
    authSessionTtlHours: 24
  });
}

function authHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`
  };
}

async function registerAndGetToken(app: ReturnType<typeof createAppForTest>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: "user@example.com",
      password: "password123",
      displayName: "User Test"
    }
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  return (body.data as { token: string }).token;
}

test("POST /api/auth/register creates a user session", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: "user@example.com",
      password: "password123",
      displayName: "User Test"
    }
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  const data = body.data as { token: string; user: { email: string; displayName: string | null } };

  assert.equal(typeof data.token, "string");
  assert.equal(data.user.email, "user@example.com");
  assert.equal(data.user.displayName, "User Test");
});

test("POST /api/auth/register rejects duplicate email", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  await registerAndGetToken(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: "user@example.com",
      password: "password123"
    }
  });

  assert.equal(response.statusCode, 409);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "CONFLICT",
    message: "Email already in use"
  });
});

test("POST /api/auth/register maps storage unique conflicts to 409", async (t) => {
  const app = buildApp({
    logLevel: "silent",
    taskStore: new NoopTaskStore(),
    authStore: new DuplicateOnCreateAuthStore(),
    authSessionTtlHours: 24
  });

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: "user@example.com",
      password: "password123"
    }
  });

  assert.equal(response.statusCode, 409);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "CONFLICT",
    message: "Email already in use"
  });
});

test("POST /api/auth/login authenticates registered user", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  await registerAndGetToken(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: "user@example.com",
      password: "password123"
    }
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as { token: string; user: { email: string } };

  assert.equal(typeof data.token, "string");
  assert.equal(data.user.email, "user@example.com");
});

test("POST /api/auth/login rejects invalid credentials", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  await registerAndGetToken(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: "user@example.com",
      password: "wrong-password"
    }
  });

  assert.equal(response.statusCode, 401);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "UNAUTHORIZED",
    message: "Invalid credentials"
  });
});

test("GET /api/auth/me requires authentication", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/auth/me"
  });

  assert.equal(response.statusCode, 401);
});

test("GET /api/auth/me returns the authenticated user", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authHeaders(token)
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as { user: { email: string } };

  assert.equal(data.user.email, "user@example.com");
});

test("POST /api/auth/logout revokes current token", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const logoutResponse = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: authHeaders(token)
  });

  assert.equal(logoutResponse.statusCode, 200);

  const meResponse = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authHeaders(token)
  });

  assert.equal(meResponse.statusCode, 401);
});
