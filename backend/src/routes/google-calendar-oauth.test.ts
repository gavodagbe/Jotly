import { GoogleCalendarConnection, Task } from "@prisma/client";
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
import {
  GoogleCalendarConnectionStore,
  GoogleCalendarConnectionUpsertInput,
} from "../google-calendar/google-calendar-store";
import { GoogleCalendarOAuthService } from "../google-calendar/google-calendar-oauth-service";
import { TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

class NoopTaskStore implements TaskStore {
  async listByDate(): Promise<Task[]> {
    return [];
  }
  async listByUser(): Promise<Task[]> {
    return [];
  }
  async getById(): Promise<Task | null> {
    return null;
  }
  async create(_input: TaskCreateInput): Promise<Task> {
    throw new Error("Not implemented");
  }
  async update(): Promise<Task | null> {
    return null;
  }
  async remove(): Promise<Task | null> {
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

class InMemoryGoogleCalendarConnectionStore implements GoogleCalendarConnectionStore {
  private readonly connections = new Map<string, GoogleCalendarConnection>();
  private idCounter = 1;

  async listByUserId(userId: string): Promise<GoogleCalendarConnection[]> {
    const results: GoogleCalendarConnection[] = [];
    for (const conn of this.connections.values()) {
      if (conn.userId === userId) {
        results.push(conn);
      }
    }
    results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return results;
  }

  async getById(connectionId: string): Promise<GoogleCalendarConnection | null> {
    return this.connections.get(connectionId) ?? null;
  }

  async getByUserAndEmail(userId: string, email: string): Promise<GoogleCalendarConnection | null> {
    for (const conn of this.connections.values()) {
      if (conn.userId === userId && conn.googleAccountEmail === email) {
        return conn;
      }
    }
    return null;
  }

  async upsertConnection(
    input: GoogleCalendarConnectionUpsertInput
  ): Promise<GoogleCalendarConnection> {
    const now = new Date();
    // Find existing by userId + email composite key
    const existing = await this.getByUserAndEmail(input.userId, input.googleAccountEmail);
    const connection: GoogleCalendarConnection = {
      id: existing?.id ?? `gcal-conn-${this.idCounter++}`,
      userId: input.userId,
      googleAccountEmail: input.googleAccountEmail,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      tokenExpiresAt: input.tokenExpiresAt,
      calendarId: input.calendarId ?? "primary",
      color: input.color ?? "#6366f1",
      lastSyncToken: existing?.lastSyncToken ?? null,
      lastSyncedAt: existing?.lastSyncedAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.connections.set(connection.id, connection);
    return connection;
  }

  async deleteById(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  async updateTokens(
    connectionId: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: Date
  ): Promise<GoogleCalendarConnection | null> {
    const conn = this.connections.get(connectionId);
    if (!conn) return null;
    const updated = { ...conn, accessToken, refreshToken, tokenExpiresAt, updatedAt: new Date() };
    this.connections.set(connectionId, updated);
    return updated;
  }

  async updateSyncToken(
    connectionId: string,
    syncToken: string,
    syncedAt: Date
  ): Promise<GoogleCalendarConnection | null> {
    const conn = this.connections.get(connectionId);
    if (!conn) return null;
    const updated = { ...conn, lastSyncToken: syncToken, lastSyncedAt: syncedAt, updatedAt: new Date() };
    this.connections.set(connectionId, updated);
    return updated;
  }

  async updateColor(): Promise<GoogleCalendarConnection | null> {
    return null;
  }

  async updateCalendarId(): Promise<GoogleCalendarConnection | null> {
    return null;
  }
}

type MockConnection = {
  id: string;
  email: string;
  color?: string;
  calendarId?: string;
  lastSyncedAt: Date | null;
  userId: string;
};

type MockOAuthServiceController = {
  service: GoogleCalendarOAuthService;
  exchangeCalls: Array<{ code: string; userId: string }>;
  disconnectCalls: Array<{ connectionId: string; userId: string }>;
  issuedStates: Map<string, { userId: string; sessionId: string }>;
};

function createMockOAuthService(initialConnections: MockConnection[] = []): MockOAuthServiceController {
  const issuedStates = new Map<string, { userId: string; sessionId: string }>();
  const exchangeCalls: Array<{ code: string; userId: string }> = [];
  const disconnectCalls: Array<{ connectionId: string; userId: string }> = [];
  const connections = [...initialConnections];
  let stateCounter = 1;

  return {
    exchangeCalls,
    disconnectCalls,
    issuedStates,
    service: {
      createAuthorizationState(userId, sessionId) {
        const state = `state-${stateCounter++}`;
        issuedStates.set(state, { userId, sessionId });
        return state;
      },
      validateAuthorizationState(state) {
        return issuedStates.get(state) ?? null;
      },
      getAuthorizationUrl(state) {
        return `https://accounts.google.com/o/oauth2/v2/auth?state=${state ?? ""}`;
      },
      async exchangeCode(code, userId) {
        exchangeCalls.push({ code, userId });
        return { email: "test@gmail.com", connectionId: "gcal-conn-1" };
      },
      async getValidAccessToken() {
        return "mock-access-token";
      },
      async disconnect(connectionId, userId) {
        disconnectCalls.push({ connectionId, userId });
        const index = connections.findIndex(
          (connection) => connection.id === connectionId && connection.userId === userId
        );
        if (index === -1) {
          return false;
        }

        connections.splice(index, 1);
        return true;
      },
      async getConnectionStatus(userId) {
        return {
          connections: connections
            .filter((connection) => connection.userId === userId)
            .map((connection) => ({
              id: connection.id,
              email: connection.email,
              color: connection.color ?? "#6366f1",
              calendarId: connection.calendarId ?? "primary",
              lastSyncedAt: connection.lastSyncedAt,
            })),
        };
      },
      async listCalendars() {
        return [];
      },
    },
  };
}

function createConnectedMockOAuthService(): MockOAuthServiceController {
  return createMockOAuthService([
    {
      id: "gcal-conn-1",
      email: "test@gmail.com",
      lastSyncedAt: new Date("2026-03-08T12:00:00Z"),
      userId: "user-1",
    },
  ]);
}

function createMultiConnectedMockOAuthService(): MockOAuthServiceController {
  return createMockOAuthService([
    {
      id: "gcal-conn-1",
      email: "personal@gmail.com",
      lastSyncedAt: new Date("2026-03-08T12:00:00Z"),
      userId: "user-1",
    },
    {
      id: "gcal-conn-2",
      email: "work@company.com",
      lastSyncedAt: new Date("2026-03-09T10:00:00Z"),
      userId: "user-1",
    },
  ]);
}

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

function getStateFromAuthorizationUrl(url: string): string {
  const state = new URL(url).searchParams.get("state");
  assert.ok(state);
  return state;
}

function createAppForTest(options?: {
  oauthService?: GoogleCalendarOAuthService;
  frontendOrigin?: string;
}) {
  return buildApp({
    logLevel: "silent",
    taskStore: new NoopTaskStore(),
    authStore: new InMemoryAuthStore(),
    googleCalendarConnectionStore: new InMemoryGoogleCalendarConnectionStore(),
    googleCalendarOAuthService: options?.oauthService ?? createMockOAuthService().service,
    frontendOrigin: options?.frontendOrigin,
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
      password: "password123",
    },
  });
  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  const data = body.data as { token: string; user: { id: string } };
  return { token: data.token, userId: data.user.id };
}

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

test("GET /api/google-calendar/auth-url returns authorization URL", async (t) => {
  const oauth = createMockOAuthService();
  const app = createAppForTest({ oauthService: oauth.service });
  t.after(async () => {
    await app.close();
  });

  const { token, userId } = await registerAndGetAuth(app);
  const response = await app.inject({
    method: "GET",
    url: "/api/google-calendar/auth-url",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as { url: string };
  assert.ok(data.url.startsWith("https://accounts.google.com"));
  const state = getStateFromAuthorizationUrl(data.url);
  assert.notEqual(state, userId);
  assert.deepEqual(oauth.issuedStates.get(state), {
    userId,
    sessionId: "session-1",
  });
});

test("GET /api/google-calendar/callback exchanges code and redirects to frontend", async (t) => {
  const oauth = createMockOAuthService();
  const app = createAppForTest({ oauthService: oauth.service });
  t.after(async () => {
    await app.close();
  });

  const { token, userId } = await registerAndGetAuth(app);
  const authUrlResponse = await app.inject({
    method: "GET",
    url: "/api/google-calendar/auth-url",
    headers: authHeaders(token),
  });
  const authUrlPayload = parsePayload(authUrlResponse.payload);
  const state = getStateFromAuthorizationUrl((authUrlPayload.data as { url: string }).url);

  const response = await app.inject({
    method: "GET",
    url: `/api/google-calendar/callback?code=test-auth-code&state=${encodeURIComponent(state)}`,
  });

  assert.equal(response.statusCode, 302);
  assert.ok(response.headers.location);
  assert.ok((response.headers.location as string).includes("google-calendar=connected"));
  assert.deepEqual(oauth.exchangeCalls, [{ code: "test-auth-code", userId }]);
});

test("GET /api/google-calendar/callback redirects on missing code", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/google-calendar/callback",
  });

  assert.equal(response.statusCode, 302);
  assert.ok((response.headers.location as string).includes("google-calendar=error"));
});

test("GET /api/google-calendar/callback does not require Bearer auth", async (t) => {
  const oauth = createMockOAuthService();
  const app = createAppForTest({ oauthService: oauth.service });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const authUrlResponse = await app.inject({
    method: "GET",
    url: "/api/google-calendar/auth-url",
    headers: authHeaders(token),
  });
  const authUrlPayload = parsePayload(authUrlResponse.payload);
  const state = getStateFromAuthorizationUrl((authUrlPayload.data as { url: string }).url);

  // No auth header on callback — should still work (redirect, not 401)
  const response = await app.inject({
    method: "GET",
    url: `/api/google-calendar/callback?code=test-auth-code&state=${encodeURIComponent(state)}`,
  });

  assert.notEqual(response.statusCode, 401);
  assert.equal(response.statusCode, 302);
});

test("DELETE /api/google-calendar/connection/:connectionId disconnects", async (t) => {
  const oauth = createMockOAuthService([
    {
      id: "gcal-conn-1",
      email: "test@gmail.com",
      lastSyncedAt: null,
      userId: "user-1",
    },
  ]);
  const app = createAppForTest({ oauthService: oauth.service });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "DELETE",
    url: "/api/google-calendar/connection/gcal-conn-1",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as { disconnected: boolean };
  assert.equal(data.disconnected, true);
  assert.deepEqual(oauth.disconnectCalls, [{ connectionId: "gcal-conn-1", userId: "user-1" }]);
});

test("GET /api/google-calendar/status returns empty connections array", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "GET",
    url: "/api/google-calendar/status",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as { connections: Array<{ id: string; email: string; lastSyncedAt: string | null }> };
  assert.ok(Array.isArray(data.connections));
  assert.equal(data.connections.length, 0);
});

test("GET /api/google-calendar/status returns single connected account", async (t) => {
  const oauth = createConnectedMockOAuthService();
  const app = createAppForTest({ oauthService: oauth.service });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "GET",
    url: "/api/google-calendar/status",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as { connections: Array<{ id: string; email: string; lastSyncedAt: string }> };
  assert.equal(data.connections.length, 1);
  assert.equal(data.connections[0].email, "test@gmail.com");
  assert.ok(data.connections[0].lastSyncedAt);
  assert.ok(data.connections[0].id);
});

test("GET /api/google-calendar/status returns multiple connected accounts", async (t) => {
  const oauth = createMultiConnectedMockOAuthService();
  const app = createAppForTest({ oauthService: oauth.service });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "GET",
    url: "/api/google-calendar/status",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as { connections: Array<{ id: string; email: string; lastSyncedAt: string }> };
  assert.equal(data.connections.length, 2);
  assert.equal(data.connections[0].email, "personal@gmail.com");
  assert.equal(data.connections[1].email, "work@company.com");
});

test("DELETE /api/google-calendar/connection/:connectionId disconnects one of multiple accounts", async (t) => {
  const oauthService = createMultiConnectedMockOAuthService();
  const app = createAppForTest({ oauthService: oauthService.service });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);

  // Disconnect the first connection
  const disconnectResponse = await app.inject({
    method: "DELETE",
    url: "/api/google-calendar/connection/gcal-conn-1",
    headers: authHeaders(token),
  });
  assert.equal(disconnectResponse.statusCode, 200);

  // Verify only the second connection remains
  const statusResponse = await app.inject({
    method: "GET",
    url: "/api/google-calendar/status",
    headers: authHeaders(token),
  });
  assert.equal(statusResponse.statusCode, 200);
  const body = parsePayload(statusResponse.payload);
  const data = body.data as { connections: Array<{ id: string; email: string }> };
  assert.equal(data.connections.length, 1);
  assert.equal(data.connections[0].email, "work@company.com");
});

test("GET /api/google-calendar/callback redirects to the configured frontend origin", async (t) => {
  const oauth = createMockOAuthService();
  const app = createAppForTest({
    oauthService: oauth.service,
    frontendOrigin: "https://app.example.com/",
  });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const authUrlResponse = await app.inject({
    method: "GET",
    url: "/api/google-calendar/auth-url",
    headers: authHeaders(token),
  });
  const authUrlPayload = parsePayload(authUrlResponse.payload);
  const state = getStateFromAuthorizationUrl((authUrlPayload.data as { url: string }).url);

  const response = await app.inject({
    method: "GET",
    url: `/api/google-calendar/callback?code=test-auth-code&state=${encodeURIComponent(state)}`,
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "https://app.example.com/?google-calendar=connected");
});

test("GET /api/google-calendar/callback rejects an invalid OAuth state", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/google-calendar/callback?code=test-auth-code&state=invalid-state",
  });

  assert.equal(response.statusCode, 302);
  assert.ok((response.headers.location as string).includes("google-calendar=error"));
});

test("DELETE /api/google-calendar/connection/:connectionId enforces connection ownership", async (t) => {
  const oauth = createMockOAuthService([
    {
      id: "gcal-conn-1",
      email: "other-user@gmail.com",
      lastSyncedAt: null,
      userId: "user-2",
    },
  ]);
  const app = createAppForTest({ oauthService: oauth.service });
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "DELETE",
    url: "/api/google-calendar/connection/gcal-conn-1",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 404);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "NOT_FOUND",
    message: "Google Calendar connection not found",
  });
});

test("Google Calendar OAuth endpoints require authentication", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const endpoints = [
    { method: "GET" as const, url: "/api/google-calendar/auth-url" },
    { method: "DELETE" as const, url: "/api/google-calendar/connection/some-id" },
    { method: "GET" as const, url: "/api/google-calendar/status" },
  ];

  for (const endpoint of endpoints) {
    const response = await app.inject(endpoint);
    assert.equal(response.statusCode, 401, `${endpoint.method} ${endpoint.url} should require auth`);
  }
});
