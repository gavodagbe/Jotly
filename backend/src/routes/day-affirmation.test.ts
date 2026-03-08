import { DayAffirmation, Task } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import { DayAffirmationStore, DayAffirmationUpsertInput } from "../day-affirmation/day-affirmation-store";
import { formatDateOnly, TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

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
    throw new Error("Not implemented");
  }

  async update(_id: string, _input: TaskUpdateInput, _userId: string): Promise<Task | null> {
    return null;
  }

  async remove(_id: string, _userId: string): Promise<Task | null> {
    return null;
  }
}

class InMemoryDayAffirmationStore implements DayAffirmationStore {
  private readonly affirmations = new Map<string, DayAffirmation>();
  private idCounter = 1;

  async getByDate(targetDate: Date, userId: string): Promise<DayAffirmation | null> {
    const key = `${userId}:${formatDateOnly(targetDate)}`;
    return this.affirmations.get(key) ?? null;
  }

  async upsert(input: DayAffirmationUpsertInput): Promise<DayAffirmation> {
    const key = `${input.userId}:${formatDateOnly(input.targetDate)}`;
    const now = new Date();
    const existing = this.affirmations.get(key);

    const nextValue: DayAffirmation = {
      id: existing?.id ?? `day-affirmation-${this.idCounter++}`,
      userId: input.userId,
      targetDate: input.targetDate,
      text: input.text,
      isCompleted: input.isCompleted,
      completedAt: input.completedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.affirmations.set(key, nextValue);
    return nextValue;
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

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new NoopTaskStore(),
    authStore: new InMemoryAuthStore(),
    dayAffirmationStore: new InMemoryDayAffirmationStore(),
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

function authHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
  };
}

test("GET /api/day-affirmation returns null when nothing is saved", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/day-affirmation?date=2026-03-08",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  assert.equal(body.data, null);
});

test("PUT /api/day-affirmation upserts and persists completion state", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);

  const upsertResponse = await app.inject({
    method: "PUT",
    url: "/api/day-affirmation",
    headers: authHeaders(token),
    payload: {
      date: "2026-03-08",
      text: "I act with focus and calm today.",
      isCompleted: true,
    },
  });

  assert.equal(upsertResponse.statusCode, 200);
  const upsertPayload = parsePayload(upsertResponse.payload);
  const upsertData = upsertPayload.data as Record<string, unknown>;
  assert.equal(upsertData.targetDate, "2026-03-08");
  assert.equal(upsertData.isCompleted, true);
  assert.notEqual(upsertData.completedAt, null);

  const resetResponse = await app.inject({
    method: "PUT",
    url: "/api/day-affirmation",
    headers: authHeaders(token),
    payload: {
      date: "2026-03-08",
      text: "I act with focus and calm today.",
      isCompleted: false,
    },
  });

  assert.equal(resetResponse.statusCode, 200);
  const resetPayload = parsePayload(resetResponse.payload);
  const resetData = resetPayload.data as Record<string, unknown>;
  assert.equal(resetData.isCompleted, false);
  assert.equal(resetData.completedAt, null);
});

test("day affirmation endpoints require authentication", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/day-affirmation?date=2026-03-08",
  });

  assert.equal(response.statusCode, 401);
  const body = parsePayload(response.payload);
  assert.deepEqual(body.error, {
    code: "UNAUTHORIZED",
    message: "Authentication is required",
  });
});
