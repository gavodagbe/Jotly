import { Task } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import {
  DEFAULT_CEO_ROUTINES,
  RoutineCompletionRecord,
  RoutineCompletionUpsertInput,
  RoutineCreateInput,
  RoutineStore,
  RoutineTemplateRecord,
  RoutineUpdateInput,
} from "../routines/routine-store";
import { formatDateOnly, TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

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

class InMemoryRoutineStore implements RoutineStore {
  private readonly routines = new Map<string, RoutineTemplateRecord>();
  private readonly completions = new Map<string, RoutineCompletionRecord>();
  private routineCounter = 1;
  private completionCounter = 1;

  async ensureDefaults(userId: string): Promise<void> {
    if ([...this.routines.values()].some((routine) => routine.userId === userId)) return;
    for (const routine of DEFAULT_CEO_ROUTINES) {
      await this.createTemplate({ ...routine, userId });
    }
  }

  async listTemplates(userId: string, includeInactive = false): Promise<RoutineTemplateRecord[]> {
    return [...this.routines.values()]
      .filter((routine) => routine.userId === userId && (includeInactive || routine.isActive))
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  async getTemplate(id: string, userId: string): Promise<RoutineTemplateRecord | null> {
    const routine = this.routines.get(id);
    return routine?.userId === userId ? routine : null;
  }

  async createTemplate(input: RoutineCreateInput): Promise<RoutineTemplateRecord> {
    const now = new Date();
    const routine: RoutineTemplateRecord = {
      id: `routine-${this.routineCounter++}`,
      userId: input.userId,
      challenge: input.challenge,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      title: input.title,
      sortOrder: input.sortOrder ?? this.routineCounter * 10,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.routines.set(routine.id, routine);
    return routine;
  }

  async updateTemplate(id: string, userId: string, input: RoutineUpdateInput): Promise<RoutineTemplateRecord | null> {
    const existing = await this.getTemplate(id, userId);
    if (!existing) return null;
    const updated: RoutineTemplateRecord = { ...existing, ...input, updatedAt: new Date() };
    this.routines.set(id, updated);
    return updated;
  }

  async removeTemplate(id: string, userId: string): Promise<RoutineTemplateRecord | null> {
    return this.updateTemplate(id, userId, { isActive: false });
  }

  async listCompletionsForRange(userId: string, startDate: Date, endExclusive: Date): Promise<RoutineCompletionRecord[]> {
    return [...this.completions.values()].filter(
      (completion) =>
        completion.userId === userId &&
        completion.targetDate.getTime() >= startDate.getTime() &&
        completion.targetDate.getTime() < endExclusive.getTime()
    );
  }

  async upsertCompletion(input: RoutineCompletionUpsertInput): Promise<RoutineCompletionRecord | null> {
    const routine = this.routines.get(input.routineId);
    if (!routine || routine.userId !== input.userId || !routine.isActive) return null;
    const key = `${input.routineId}:${formatDateOnly(input.targetDate)}`;
    const existing = this.completions.get(key);
    const now = new Date();
    const completion: RoutineCompletionRecord = {
      id: existing?.id ?? `completion-${this.completionCounter++}`,
      userId: input.userId,
      routineId: input.routineId,
      targetDate: input.targetDate,
      isCompleted: input.isCompleted,
      completedAt: input.isCompleted ? now : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.completions.set(key, completion);
    return completion;
  }
}

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new NoopTaskStore(),
    authStore: new InMemoryAuthStore(),
    routineStore: new InMemoryRoutineStore(),
  });
}

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

async function registerAndGetToken(app: ReturnType<typeof createAppForTest>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: `routine-${Math.random().toString(36).slice(2)}@example.com`, password: "password123" },
  });
  assert.equal(response.statusCode, 201);
  return (parsePayload(response.payload).data as { token: string }).token;
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

test("GET /api/routine-completions seeds default CEO routines and monthly percentages", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/routine-completions?month=2026-05",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const data = parsePayload(response.payload).data as {
    routines: Array<{ title: string }>;
    days: string[];
    monthPercentage: number;
  };
  assert.equal(data.routines.length, DEFAULT_CEO_ROUTINES.length);
  assert.equal(data.days.length, 31);
  assert.equal(data.monthPercentage, 0);
  assert.ok(data.routines.some((routine) => routine.title.includes("Mission client")));
});

test("PUT /api/routine-completions toggles a routine completion", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const initialResponse = await app.inject({
    method: "GET",
    url: "/api/routine-completions?month=2026-05",
    headers: authHeaders(token),
  });
  const initialData = parsePayload(initialResponse.payload).data as { routines: Array<{ id: string }> };
  const routineId = initialData.routines[0].id;

  const updateResponse = await app.inject({
    method: "PUT",
    url: "/api/routine-completions",
    headers: authHeaders(token),
    payload: { routineId, targetDate: "2026-05-31", isCompleted: true },
  });

  assert.equal(updateResponse.statusCode, 200);
  const completion = (parsePayload(updateResponse.payload).data as { isCompleted: boolean; targetDate: string });
  assert.equal(completion.isCompleted, true);
  assert.equal(completion.targetDate, "2026-05-31");

  const monthResponse = await app.inject({
    method: "GET",
    url: "/api/routine-completions?month=2026-05",
    headers: authHeaders(token),
  });
  const monthData = parsePayload(monthResponse.payload).data as {
    dailyPercentages: Array<{ date: string; percentage: number }>;
  };
  assert.equal(monthData.dailyPercentages.find((entry) => entry.date === "2026-05-31")?.percentage, 10);
});
