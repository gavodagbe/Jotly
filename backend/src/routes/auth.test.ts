import { Task } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthPasswordResetToken,
  AuthSession,
  AuthStore,
  AuthUser,
  CreateAuthPasswordResetTokenInput,
  CreateAuthSessionInput,
  CreateAuthUserInput
} from "../auth/auth-store";
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
  private readonly passwordResetTokens = new Map<string, AuthPasswordResetToken>();
  private readonly passwordResetTokensByHash = new Map<string, AuthPasswordResetToken>();
  private userIdCounter = 1;
  private sessionIdCounter = 1;
  private passwordResetTokenCounter = 1;

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

  async updateUserPasswordHash(userId: string, passwordHash: string): Promise<AuthUser | null> {
    const existing = this.users.get(userId);

    if (!existing) {
      return null;
    }

    const updated: AuthUser = {
      ...existing,
      passwordHash,
      updatedAt: new Date()
    };

    this.users.set(userId, updated);
    this.usersByEmail.set(updated.email, updated);
    return updated;
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

  async revokeSessionsByUserId(userId: string): Promise<void> {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId !== userId || session.revokedAt) {
        continue;
      }

      const revoked = { ...session, revokedAt: new Date() };
      this.sessions.set(sessionId, revoked);
      this.sessionsByTokenHash.set(revoked.tokenHash, revoked);
    }
  }

  async deleteExpiredSessions(now: Date): Promise<void> {
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt.getTime() <= now.getTime() || session.revokedAt) {
        this.sessions.delete(id);
        this.sessionsByTokenHash.delete(session.tokenHash);
      }
    }
  }

  async createPasswordResetToken(
    input: CreateAuthPasswordResetTokenInput
  ): Promise<AuthPasswordResetToken> {
    const resetToken: AuthPasswordResetToken = {
      id: `password-reset-token-${this.passwordResetTokenCounter++}`,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      usedAt: null
    };

    this.passwordResetTokens.set(resetToken.id, resetToken);
    this.passwordResetTokensByHash.set(resetToken.tokenHash, resetToken);
    return resetToken;
  }

  async findPasswordResetTokenByTokenHash(tokenHash: string): Promise<AuthPasswordResetToken | null> {
    return this.passwordResetTokensByHash.get(tokenHash) ?? null;
  }

  async markPasswordResetTokenUsed(resetTokenId: string): Promise<void> {
    const existing = this.passwordResetTokens.get(resetTokenId);

    if (!existing) {
      return;
    }

    const updated = { ...existing, usedAt: new Date() };
    this.passwordResetTokens.set(resetTokenId, updated);
    this.passwordResetTokensByHash.set(updated.tokenHash, updated);
  }

  async revokePasswordResetTokensByUserId(userId: string): Promise<void> {
    for (const [resetTokenId, resetToken] of this.passwordResetTokens.entries()) {
      if (resetToken.userId !== userId || resetToken.usedAt) {
        continue;
      }

      const updated = { ...resetToken, usedAt: new Date() };
      this.passwordResetTokens.set(resetTokenId, updated);
      this.passwordResetTokensByHash.set(updated.tokenHash, updated);
    }
  }

  async deleteExpiredPasswordResetTokens(now: Date): Promise<void> {
    for (const [resetTokenId, resetToken] of this.passwordResetTokens.entries()) {
      if (resetToken.expiresAt.getTime() > now.getTime() && resetToken.usedAt === null) {
        continue;
      }

      this.passwordResetTokens.delete(resetTokenId);
      this.passwordResetTokensByHash.delete(resetToken.tokenHash);
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

test("POST /api/auth/forgot-password returns a reset token payload", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  await registerAndGetToken(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/forgot-password",
    payload: {
      email: "user@example.com"
    }
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as { success: boolean; resetToken: string | null; expiresAt: string | null };

  assert.equal(data.success, true);
  assert.equal(typeof data.resetToken, "string");
  assert.equal(typeof data.expiresAt, "string");
});

test("POST /api/auth/reset-password updates the password and revokes previous sessions", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const originalToken = await registerAndGetToken(app);
  const forgotResponse = await app.inject({
    method: "POST",
    url: "/api/auth/forgot-password",
    payload: {
      email: "user@example.com"
    }
  });

  assert.equal(forgotResponse.statusCode, 200);
  const forgotBody = parsePayload(forgotResponse.payload);
  const resetToken = (forgotBody.data as { resetToken: string | null }).resetToken;
  assert.equal(typeof resetToken, "string");

  const resetResponse = await app.inject({
    method: "POST",
    url: "/api/auth/reset-password",
    payload: {
      token: resetToken,
      password: "new-password-123"
    }
  });

  assert.equal(resetResponse.statusCode, 200);
  const resetBody = parsePayload(resetResponse.payload);
  const resetData = resetBody.data as { token: string; user: { email: string } };
  assert.equal(resetData.user.email, "user@example.com");
  assert.equal(typeof resetData.token, "string");

  const staleSessionResponse = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authHeaders(originalToken)
  });
  assert.equal(staleSessionResponse.statusCode, 401);

  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: "user@example.com",
      password: "new-password-123"
    }
  });

  assert.equal(loginResponse.statusCode, 200);

  const oldPasswordResponse = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: "user@example.com",
      password: "password123"
    }
  });

  assert.equal(oldPasswordResponse.statusCode, 401);
});

test("POST /api/auth/reset-password rejects an invalid token", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/auth/reset-password",
    payload: {
      token: "invalid-token",
      password: "new-password-123"
    }
  });

  assert.equal(response.statusCode, 401);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "INVALID_RESET_TOKEN",
    message: "Invalid or expired reset token"
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
