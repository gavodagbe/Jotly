import { Task } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import { buildApp } from "../app";
import { ProfileStore, UserProfile, UserProfileUpdateInput } from "../profile/profile-store";
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
    throw new Error("Not implemented for profile tests");
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
      preferredLocale: "en",
      preferredTimeZone: null,
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
    this.sessions.set(session.id, revoked);
    this.sessionsByTokenHash.set(session.tokenHash, revoked);
  }

  async deleteExpiredSessions(now: Date): Promise<void> {
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt.getTime() <= now.getTime() || session.revokedAt) {
        this.sessions.delete(id);
        this.sessionsByTokenHash.delete(session.tokenHash);
      }
    }
  }

  readUser(id: string): AuthUser | null {
    return this.users.get(id) ?? null;
  }

  writeUser(id: string, patch: Partial<AuthUser>): AuthUser | null {
    const existing = this.users.get(id);

    if (!existing) {
      return null;
    }

    const updated: AuthUser = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };

    this.users.set(id, updated);
    this.usersByEmail.set(updated.email, updated);
    return updated;
  }
}

class InMemoryProfileStore implements ProfileStore {
  constructor(private readonly authStore: InMemoryAuthStore) {}

  async getByUserId(userId: string): Promise<UserProfile | null> {
    const user = this.authStore.readUser(userId);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      preferredLocale: user.preferredLocale === "fr" ? "fr" : "en",
      preferredTimeZone: user.preferredTimeZone ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateByUserId(userId: string, input: UserProfileUpdateInput): Promise<UserProfile | null> {
    const user = this.authStore.writeUser(userId, {
      ...(input.displayName !== undefined ? { displayName: input.displayName ?? null } : {}),
      ...(input.preferredLocale !== undefined ? { preferredLocale: input.preferredLocale ?? "en" } : {}),
      ...(input.preferredTimeZone !== undefined ? { preferredTimeZone: input.preferredTimeZone ?? null } : {}),
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      preferredLocale: user.preferredLocale === "fr" ? "fr" : "en",
      preferredTimeZone: user.preferredTimeZone ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

function createAppForTest() {
  const authStore = new InMemoryAuthStore();

  return buildApp({
    logLevel: "silent",
    taskStore: new NoopTaskStore(),
    authStore,
    profileStore: new InMemoryProfileStore(authStore),
    authSessionTtlHours: 24,
  });
}

async function registerAndGetToken(app: ReturnType<typeof createAppForTest>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: "profile-user@example.com",
      password: "password123",
      displayName: "Profile User",
    },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  return (body.data as { token: string }).token;
}

test("GET /api/profile requires authentication", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/profile",
  });

  assert.equal(response.statusCode, 401);
});

test("GET /api/profile returns authenticated profile", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "GET",
    url: "/api/profile",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as { email: string; displayName: string | null; preferredLocale: string };

  assert.equal(data.email, "profile-user@example.com");
  assert.equal(data.displayName, "Profile User");
  assert.equal(data.preferredLocale, "en");
});

test("PATCH /api/profile updates display name and preferences", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "PATCH",
    url: "/api/profile",
    headers: authHeaders(token),
    payload: {
      displayName: "Godwin",
      preferredLocale: "fr",
      preferredTimeZone: "Europe/Paris",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as {
    displayName: string | null;
    preferredLocale: string;
    preferredTimeZone: string | null;
  };

  assert.equal(data.displayName, "Godwin");
  assert.equal(data.preferredLocale, "fr");
  assert.equal(data.preferredTimeZone, "Europe/Paris");
});

test("PATCH /api/profile validates timezone", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "PATCH",
    url: "/api/profile",
    headers: authHeaders(token),
    payload: {
      preferredTimeZone: "Mars/Olympus",
    },
  });

  assert.equal(response.statusCode, 400);
  const body = parsePayload(response.payload);
  const error = body.error as { code: string; message: string };

  assert.equal(error.code, "VALIDATION_ERROR");
  assert.match(error.message, /valid IANA timezone/);
});
