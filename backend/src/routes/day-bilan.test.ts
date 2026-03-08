import { DayBilan, Task } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import { DayBilanStore, DayBilanUpsertInput } from "../day-bilan/day-bilan-store";
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

class InMemoryDayBilanStore implements DayBilanStore {
  private readonly bilans = new Map<string, DayBilan>();
  private idCounter = 1;

  async getByDate(targetDate: Date, userId: string): Promise<DayBilan | null> {
    const key = `${userId}:${formatDateOnly(targetDate)}`;
    return this.bilans.get(key) ?? null;
  }

  async upsert(input: DayBilanUpsertInput): Promise<DayBilan> {
    const key = `${input.userId}:${formatDateOnly(input.targetDate)}`;
    const now = new Date();
    const existing = this.bilans.get(key);

    const nextValue: DayBilan = {
      id: existing?.id ?? `day-bilan-${this.idCounter++}`,
      userId: input.userId,
      targetDate: input.targetDate,
      mood: input.mood,
      wins: input.wins,
      blockers: input.blockers,
      lessonsLearned: input.lessonsLearned,
      tomorrowTop3: input.tomorrowTop3,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.bilans.set(key, nextValue);
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
    dayBilanStore: new InMemoryDayBilanStore(),
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

test("GET /api/day-bilan returns null when nothing is saved", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/day-bilan?date=2026-03-08",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  assert.equal(body.data, null);
});

test("PUT /api/day-bilan upserts and returns saved values", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);

  const saveResponse = await app.inject({
    method: "PUT",
    url: "/api/day-bilan",
    headers: authHeaders(token),
    payload: {
      date: "2026-03-08",
      mood: 4,
      wins: "Finished API endpoints and test coverage",
      blockers: "None",
      lessonsLearned: "Batching similar changes reduces regression risk",
      tomorrowTop3: "1. polish UI\n2. validate on staging\n3. update docs",
    },
  });

  assert.equal(saveResponse.statusCode, 200);
  const savePayload = parsePayload(saveResponse.payload);
  const saveData = savePayload.data as Record<string, unknown>;
  assert.equal(saveData.targetDate, "2026-03-08");
  assert.equal(saveData.mood, 4);
  assert.equal(saveData.blockers, "None");

  const getResponse = await app.inject({
    method: "GET",
    url: "/api/day-bilan?date=2026-03-08",
    headers: authHeaders(token),
  });

  assert.equal(getResponse.statusCode, 200);
  const getPayload = parsePayload(getResponse.payload);
  const getData = getPayload.data as Record<string, unknown>;
  assert.equal(getData.wins, "Finished API endpoints and test coverage");
  assert.equal(getData.mood, 4);
});

test("day bilan validation rejects invalid mood", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "PUT",
    url: "/api/day-bilan",
    headers: authHeaders(token),
    payload: {
      date: "2026-03-08",
      mood: 6,
    },
  });

  assert.equal(response.statusCode, 400);
  const payload = parsePayload(response.payload);
  const error = payload.error as Record<string, unknown>;
  assert.equal(error.code, "VALIDATION_ERROR");
});
