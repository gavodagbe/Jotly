import { Task } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import {
  createGamingTrackService,
  GamingTrackSummary,
} from "../gaming-track/gaming-track-service";
import {
  GamingTrackAffirmationRecord,
  GamingTrackBilanRecord,
  GamingTrackStore,
  GamingTrackTaskRecord,
} from "../gaming-track/gaming-track-store";
import { parseDateOnly, TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

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

class InMemoryGamingTrackStore implements GamingTrackStore {
  private readonly taskRecords: Array<GamingTrackTaskRecord & { userId: string }> = [];
  private readonly affirmationRecords: Array<GamingTrackAffirmationRecord & { userId: string }> = [];
  private readonly bilanRecords: Array<GamingTrackBilanRecord & { userId: string }> = [];

  seedTask(userId: string, record: GamingTrackTaskRecord) {
    this.taskRecords.push({ userId, ...record });
  }

  seedAffirmation(userId: string, record: GamingTrackAffirmationRecord) {
    this.affirmationRecords.push({ userId, ...record });
  }

  seedBilan(userId: string, record: GamingTrackBilanRecord) {
    this.bilanRecords.push({ userId, ...record });
  }

  async getWindowData(userId: string, start: Date, endExclusive: Date) {
    const isInRange = (value: Date) => value.getTime() >= start.getTime() && value.getTime() < endExclusive.getTime();

    return {
      tasks: this.taskRecords
        .filter((record) => record.userId === userId && isInRange(record.targetDate))
        .map(({ targetDate, status, rolledFromTaskId }) => ({ targetDate, status, rolledFromTaskId })),
      affirmations: this.affirmationRecords
        .filter((record) => record.userId === userId && isInRange(record.targetDate))
        .map(({ targetDate, isCompleted }) => ({ targetDate, isCompleted })),
      bilans: this.bilanRecords
        .filter((record) => record.userId === userId && isInRange(record.targetDate))
        .map(({ targetDate, mood, wins, blockers, lessonsLearned, tomorrowTop3 }) => ({
          targetDate,
          mood,
          wins,
          blockers,
          lessonsLearned,
          tomorrowTop3,
        })),
    };
  }

  async getLifetimeData(userId: string) {
    return {
      tasks: this.taskRecords
        .filter((record) => record.userId === userId)
        .map(({ targetDate, status, rolledFromTaskId }) => ({ targetDate, status, rolledFromTaskId })),
      affirmations: this.affirmationRecords
        .filter((record) => record.userId === userId)
        .map(({ targetDate, isCompleted }) => ({ targetDate, isCompleted })),
      bilans: this.bilanRecords
        .filter((record) => record.userId === userId)
        .map(({ targetDate, mood, wins, blockers, lessonsLearned, tomorrowTop3 }) => ({
          targetDate,
          mood,
          wins,
          blockers,
          lessonsLearned,
          tomorrowTop3,
        })),
    };
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

function authHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
  };
}

function parseDate(value: string): Date {
  const parsed = parseDateOnly(value);

  if (!parsed) {
    throw new Error(`Invalid fixed date in test: ${value}`);
  }

  return parsed;
}

function createAppForTest() {
  const gamingTrackStore = new InMemoryGamingTrackStore();

  return {
    gamingTrackStore,
    app: buildApp({
      logLevel: "silent",
      taskStore: new NoopTaskStore(),
      authStore: new InMemoryAuthStore(),
      gamingTrackService: createGamingTrackService(gamingTrackStore),
    }),
  };
}

async function registerAndGetToken(app: ReturnType<typeof createAppForTest>["app"]): Promise<string> {
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

async function getCurrentUserId(app: ReturnType<typeof createAppForTest>["app"], token: string): Promise<string> {
  const response = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  return ((body.data as { user: { id: string } }).user.id);
}

function seedWeekFixture(store: InMemoryGamingTrackStore, userId: string) {
  store.seedTask(userId, {
    targetDate: parseDate("2026-03-02"),
    status: "done",
    rolledFromTaskId: null,
  });
  store.seedTask(userId, {
    targetDate: parseDate("2026-03-02"),
    status: "todo",
    rolledFromTaskId: null,
  });
  store.seedTask(userId, {
    targetDate: parseDate("2026-03-03"),
    status: "done",
    rolledFromTaskId: "task-old-1",
  });
  store.seedTask(userId, {
    targetDate: parseDate("2026-03-04"),
    status: "cancelled",
    rolledFromTaskId: null,
  });
  store.seedTask(userId, {
    targetDate: parseDate("2026-03-08"),
    status: "done",
    rolledFromTaskId: null,
  });

  store.seedAffirmation(userId, {
    targetDate: parseDate("2026-03-02"),
    isCompleted: true,
  });
  store.seedAffirmation(userId, {
    targetDate: parseDate("2026-03-03"),
    isCompleted: true,
  });
  store.seedAffirmation(userId, {
    targetDate: parseDate("2026-03-08"),
    isCompleted: true,
  });

  store.seedBilan(userId, {
    targetDate: parseDate("2026-03-02"),
    mood: 4,
    wins: null,
    blockers: null,
    lessonsLearned: null,
    tomorrowTop3: null,
  });
  store.seedBilan(userId, {
    targetDate: parseDate("2026-03-04"),
    mood: null,
    wins: "Unblocked API route",
    blockers: null,
    lessonsLearned: null,
    tomorrowTop3: null,
  });
  store.seedBilan(userId, {
    targetDate: parseDate("2026-03-08"),
    mood: null,
    wins: null,
    blockers: "Need final QA",
    lessonsLearned: null,
    tomorrowTop3: null,
  });

  store.seedTask(userId, {
    targetDate: parseDate("2026-02-24"),
    status: "done",
    rolledFromTaskId: null,
  });
  store.seedTask(userId, {
    targetDate: parseDate("2026-02-25"),
    status: "todo",
    rolledFromTaskId: null,
  });

  store.seedAffirmation(userId, {
    targetDate: parseDate("2026-02-24"),
    isCompleted: true,
  });
  store.seedBilan(userId, {
    targetDate: parseDate("2026-02-24"),
    mood: null,
    wins: "Weekly planning done",
    blockers: null,
    lessonsLearned: null,
    tomorrowTop3: null,
  });

  // Noise from another user should be ignored.
  store.seedTask("user-foreign", {
    targetDate: parseDate("2026-03-08"),
    status: "done",
    rolledFromTaskId: null,
  });
}

test("GET /api/gaming-track/summary returns week-to-date gaming metrics", async (t) => {
  const { app, gamingTrackStore } = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const userId = await getCurrentUserId(app, token);
  seedWeekFixture(gamingTrackStore, userId);

  const response = await app.inject({
    method: "GET",
    url: "/api/gaming-track/summary?date=2026-03-08&period=week",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 200);

  const payload = parsePayload(response.payload);
  const data = payload.data as Omit<
    GamingTrackSummary,
    "anchorDate" | "rangeStart" | "rangeEnd" | "weeklyMissionWindow" | "personalBests" | "historicalTrends"
  > & {
    anchorDate: string;
    rangeStart: string;
    rangeEnd: string;
    weeklyMissionWindow: {
      rangeStart: string;
      rangeEnd: string;
      trackedDays: number;
    };
    personalBests: {
      dailyDoneTasks: number;
      dailyDoneTasksDate: string | null;
      executionBestStreak: number;
      reflectionBestStreak: number;
    };
    historicalTrends: {
      daily: Array<{
        label: string;
        rangeStart: string;
        rangeEnd: string;
        trackedDays: number;
        tasksDone: number;
        taskCompletionRate: number;
        affirmationCompletionRate: number;
        bilanCompletionRate: number;
        overallScore: number;
      }>;
      weekly: Array<{
        label: string;
        rangeStart: string;
        rangeEnd: string;
        trackedDays: number;
        tasksDone: number;
        taskCompletionRate: number;
        affirmationCompletionRate: number;
        bilanCompletionRate: number;
        overallScore: number;
      }>;
      monthly: Array<{
        label: string;
        rangeStart: string;
        rangeEnd: string;
        trackedDays: number;
        tasksDone: number;
        taskCompletionRate: number;
        affirmationCompletionRate: number;
        bilanCompletionRate: number;
        overallScore: number;
      }>;
    };
  };

  assert.equal(data.period, "week");
  assert.equal(data.anchorDate, "2026-03-08");
  assert.equal(data.rangeStart, "2026-03-02");
  assert.equal(data.rangeEnd, "2026-03-08");
  assert.equal(data.trackedDays, 7);

  assert.equal(data.tasks.total, 5);
  assert.equal(data.tasks.done, 3);
  assert.equal(data.tasks.actionable, 1);
  assert.equal(data.tasks.cancelled, 1);
  assert.equal(data.tasks.carriedOver, 1);
  assert.equal(data.tasks.completionRate, 60);

  assert.equal(data.affirmations.completedDays, 3);
  assert.equal(data.affirmations.totalDays, 7);
  assert.equal(data.affirmations.completionRate, 43);

  assert.equal(data.bilans.completedDays, 3);
  assert.equal(data.bilans.totalDays, 7);
  assert.equal(data.bilans.completionRate, 43);

  assert.equal(data.streaks.executionBest, 2);
  assert.equal(data.streaks.executionActive, 1);
  assert.equal(data.streaks.reflectionBest, 1);
  assert.equal(data.streaks.reflectionActive, 1);

  assert.equal(data.scores.execution, 60);
  assert.equal(data.scores.reflection, 43);
  assert.equal(data.scores.consistency, 14);
  assert.equal(data.scores.overall, 46);
  assert.equal(data.scores.momentum, 67);

  assert.equal(data.trend.executionDelta, 10);
  assert.equal(data.trend.reflectionDelta, 29);
  assert.equal(data.trend.consistencyDelta, 14);
  assert.equal(data.trend.overallDelta, 17);

  assert.equal(data.weeklyMissionWindow.rangeStart, "2026-03-02");
  assert.equal(data.weeklyMissionWindow.rangeEnd, "2026-03-08");
  assert.equal(data.weeklyMissionWindow.trackedDays, 7);
  assert.equal(data.missions.length, 4);
  assert.equal(data.missions[0]?.id, "done_tasks");
  assert.equal(data.missions[0]?.target, 8);
  assert.equal(data.missions[0]?.progress, 3);
  assert.equal(data.missions[0]?.completed, false);
  assert.equal(data.missions[1]?.id, "affirmation_days");
  assert.equal(data.missions[1]?.progress, 3);
  assert.equal(data.missions[2]?.id, "bilan_days");
  assert.equal(data.missions[2]?.progress, 3);
  assert.equal(data.missions[3]?.id, "execution_streak");
  assert.equal(data.missions[3]?.progress, 1);

  assert.equal(data.personalBests.dailyDoneTasks, 1);
  assert.equal(data.personalBests.dailyDoneTasksDate, "2026-03-08");
  assert.equal(data.personalBests.executionBestStreak, 2);
  assert.equal(data.personalBests.reflectionBestStreak, 1);

  assert.equal(data.level.xp, 122);
  assert.equal(data.level.level, 2);
  assert.equal(data.level.rank, "rookie");
  assert.equal(data.level.currentLevelXp, 2);
  assert.equal(data.level.nextLevelXp, 142);
  assert.equal(data.level.progressToNextLevel, 1);

  assert.equal(data.badges.length, 6);
  assert.deepEqual(
    data.badges.map((badge) => ({ id: badge.id, progress: badge.progress, target: badge.target, unlocked: badge.unlocked })),
    [
      { id: "first_task_done", progress: 4, target: 1, unlocked: true },
      { id: "task_finisher_50", progress: 4, target: 50, unlocked: false },
      { id: "execution_streak_7", progress: 2, target: 7, unlocked: false },
      { id: "reflection_streak_5", progress: 1, target: 5, unlocked: false },
      { id: "mission_week_4", progress: 0, target: 4, unlocked: false },
      { id: "carryover_recovery_10", progress: 1, target: 10, unlocked: false },
    ]
  );

  assert.equal(data.streakProtection.availableCharges, 0);
  assert.equal(data.streakProtection.maxCharges, 3);
  assert.equal(data.streakProtection.earnedCharges, 0);
  assert.equal(data.streakProtection.atRisk, false);
  assert.equal(data.streakProtection.recommended, false);
  assert.equal(data.streakProtection.projectedExecutionStreak, 0);
  assert.equal(data.streakProtection.projectedReflectionStreak, 0);

  assert.equal(data.historicalTrends.daily.length, 14);
  assert.equal(data.historicalTrends.daily[0]?.rangeStart, "2026-02-23");
  assert.equal(data.historicalTrends.daily[13]?.rangeStart, "2026-03-08");
  assert.equal(data.historicalTrends.daily[13]?.overallScore, 100);

  assert.equal(data.historicalTrends.weekly.length, 12);
  assert.equal(data.historicalTrends.weekly[10]?.rangeStart, "2026-02-23");
  assert.equal(data.historicalTrends.weekly[10]?.overallScore, 29);
  assert.equal(data.historicalTrends.weekly[11]?.rangeStart, "2026-03-02");
  assert.equal(data.historicalTrends.weekly[11]?.overallScore, 46);

  assert.equal(data.historicalTrends.monthly.length, 12);
  assert.equal(data.historicalTrends.monthly[11]?.label, "2026-03");
  assert.equal(data.historicalTrends.monthly[11]?.rangeStart, "2026-03-01");
  assert.equal(data.historicalTrends.monthly[11]?.rangeEnd, "2026-03-08");
  assert.equal(data.historicalTrends.monthly[11]?.overallScore, 44);
});

test("gaming-track endpoint requires authentication", async (t) => {
  const { app } = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/gaming-track/summary?date=2026-03-08&period=week",
  });

  assert.equal(response.statusCode, 401);
  const payload = parsePayload(response.payload);
  assert.deepEqual(payload.error, {
    code: "UNAUTHORIZED",
    message: "Authentication is required",
  });
});

test("gaming-track endpoint validates query params", async (t) => {
  const { app } = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/gaming-track/summary?date=bad-date&period=quarter",
    headers: authHeaders(token),
  });

  assert.equal(response.statusCode, 400);
  const payload = parsePayload(response.payload);
  const error = payload.error as { code: string; message: string };

  assert.equal(error.code, "VALIDATION_ERROR");
  assert.match(error.message, /date must be a valid date/i);
});
