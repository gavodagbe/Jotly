import { CalendarEvent, CalendarEventNote, DayAffirmation, DayBilan, Reminder, Task, TaskAttachment, TaskComment, TaskPriority, TaskStatus } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { AssistantContextStore, AssistantContextSnapshot, AssistantOverviewCounts } from "../assistant/assistant-context-store";
import { createInMemoryAssistantSearchDocumentStore } from "../assistant/assistant-search-document-store";
import { AssistantPipelineInput, AssistantReply, AssistantService } from "../assistant/assistant-service";
import { AttachmentStore, TaskAttachmentCreateInput } from "../attachments/attachment-store";
import { AuthSession, AuthStore, AuthUser, CreateAuthSessionInput, CreateAuthUserInput } from "../auth/auth-store";
import { CommentStore, TaskCommentCreateInput, TaskCommentUpdateInput } from "../comments/comment-store";
import { buildApp } from "../app";
import { UserProfile } from "../profile/profile-store";
import { formatDateOnly, TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, Task>();
  private idCounter = 1;

  async listByDate(targetDate: Date, userId: string): Promise<Task[]> {
    const selectedDate = formatDateOnly(targetDate);
    const matches = [...this.tasks.values()].filter(
      (task) => task.userId === userId && formatDateOnly(task.targetDate) === selectedDate
    );
    return matches.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async listByUser(userId: string): Promise<Task[]> {
    const matches = [...this.tasks.values()].filter((task) => task.userId === userId);
    return matches.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async getById(id: string, userId: string): Promise<Task | null> {
    const task = this.tasks.get(id) ?? null;
    return task && task.userId === userId ? task : null;
  }

  async create(input: TaskCreateInput): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: `task-${this.idCounter++}`,
      userId: input.userId,
      title: input.title,
      description: input.description,
      status: input.status,
      targetDate: input.targetDate,
      dueDate: input.dueDate,
      priority: input.priority,
      project: input.project,
      assignees: input.assignees ?? null,
      plannedTime: input.plannedTime,
      rolledFromTaskId: input.rolledFromTaskId ?? null,
      recurrenceSourceTaskId: input.recurrenceSourceTaskId ?? null,
      recurrenceOccurrenceDate: input.recurrenceOccurrenceDate ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: input.completedAt,
      cancelledAt: input.cancelledAt,
      calendarEventId: input.calendarEventId ?? null,
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async update(id: string, input: TaskUpdateInput, userId: string): Promise<Task | null> {
    const existing = this.tasks.get(id);

    if (!existing || existing.userId !== userId) {
      return null;
    }

    const updated: Task = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };

    this.tasks.set(id, updated);
    return updated;
  }

  async remove(id: string, userId: string): Promise<Task | null> {
    const existing = this.tasks.get(id);

    if (!existing || existing.userId !== userId) {
      return null;
    }

    this.tasks.delete(id);
    return existing;
  }
}

class InMemoryCommentStore implements CommentStore {
  private readonly comments = new Map<string, TaskComment>();
  private idCounter = 1;

  async listByTaskId(taskId: string): Promise<TaskComment[]> {
    return [...this.comments.values()]
      .filter((comment) => comment.taskId === taskId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async getById(id: string): Promise<TaskComment | null> {
    return this.comments.get(id) ?? null;
  }

  async create(input: TaskCommentCreateInput): Promise<TaskComment> {
    const now = new Date();
    const comment: TaskComment = {
      id: `comment-${this.idCounter++}`,
      taskId: input.taskId,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    };

    this.comments.set(comment.id, comment);
    return comment;
  }

  async update(id: string, input: TaskCommentUpdateInput): Promise<TaskComment | null> {
    const existing = this.comments.get(id);

    if (!existing) {
      return null;
    }

    const updated: TaskComment = {
      ...existing,
      body: input.body,
      updatedAt: new Date(),
    };

    this.comments.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<TaskComment | null> {
    const existing = this.comments.get(id);

    if (!existing) {
      return null;
    }

    this.comments.delete(id);
    return existing;
  }
}

class InMemoryAttachmentStore implements AttachmentStore {
  private readonly attachments = new Map<string, TaskAttachment>();
  private idCounter = 1;

  async listByTaskId(taskId: string): Promise<TaskAttachment[]> {
    return [...this.attachments.values()]
      .filter((attachment) => attachment.taskId === taskId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async getById(id: string): Promise<TaskAttachment | null> {
    return this.attachments.get(id) ?? null;
  }

  async create(input: TaskAttachmentCreateInput): Promise<TaskAttachment> {
    const attachment: TaskAttachment = {
      id: `attachment-${this.idCounter++}`,
      taskId: input.taskId,
      name: input.name,
      url: input.url,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      createdAt: new Date(),
    };

    this.attachments.set(attachment.id, attachment);
    return attachment;
  }

  async remove(id: string): Promise<TaskAttachment | null> {
    const existing = this.attachments.get(id) ?? null;
    if (!existing) {
      return null;
    }

    this.attachments.delete(id);
    return existing;
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

class EchoAssistantService implements AssistantService {
  async generateReply(input: AssistantPipelineInput): Promise<AssistantReply> {
    return {
      answer: `question=${input.question};userId=${input.userId}`,
      source: "heuristic" as const,
      warning: null,
      usedDomains: ["overview"],
      retrievalMode: "structured",
      matchedRecordsCount: 0,
    };
  }
}

class InMemoryAssistantContextStore implements AssistantContextStore {
  private readonly snapshots = new Map<string, AssistantContextSnapshot>();

  setSnapshot(
    userId: string,
    snapshot: Partial<AssistantContextSnapshot> & { profile?: UserProfile | null }
  ) {
    this.snapshots.set(userId, {
      profile: snapshot.profile ?? null,
      dayAffirmations: snapshot.dayAffirmations ?? [],
      dayBilans: snapshot.dayBilans ?? [],
      reminders: snapshot.reminders ?? [],
      calendarEvents: snapshot.calendarEvents ?? [],
      calendarEventNotes: snapshot.calendarEventNotes ?? [],
    });
  }

  async getByUserId(userId: string): Promise<AssistantContextSnapshot> {
    return (
      this.snapshots.get(userId) ?? {
        profile: null,
        dayAffirmations: [],
        dayBilans: [],
        reminders: [],
        calendarEvents: [],
        calendarEventNotes: [],
      }
    );
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    return this.snapshots.get(userId)?.profile ?? null;
  }

  async getAffirmations(userId: string, limit: number): Promise<DayAffirmation[]> {
    const snapshot = this.snapshots.get(userId);
    if (!snapshot) return [];
    return [...snapshot.dayAffirmations]
      .sort((a, b) => b.targetDate.getTime() - a.targetDate.getTime())
      .slice(0, limit);
  }

  async getBilans(userId: string, limit: number): Promise<DayBilan[]> {
    const snapshot = this.snapshots.get(userId);
    if (!snapshot) return [];
    return [...snapshot.dayBilans]
      .sort((a, b) => b.targetDate.getTime() - a.targetDate.getTime())
      .slice(0, limit);
  }

  async getReminders(
    userId: string,
    options: { activeOnly?: boolean; limit: number }
  ): Promise<Reminder[]> {
    const snapshot = this.snapshots.get(userId);
    if (!snapshot) return [];
    let reminders = [...snapshot.reminders];
    if (options.activeOnly) {
      reminders = reminders.filter((r) => r.status === "pending" || r.status === "fired");
    }
    return reminders
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
      .slice(0, options.limit);
  }

  async getCalendarEvents(
    userId: string,
    limit: number
  ): Promise<(CalendarEvent & { note: string | null })[]> {
    const snapshot = this.snapshots.get(userId);
    if (!snapshot) return [];
    const notesByEventId = new Map(
      snapshot.calendarEventNotes.map((n) => [n.calendarEventId, n.body])
    );
    return [...snapshot.calendarEvents]
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, limit)
      .map((event) => ({
        ...event,
        note: notesByEventId.get(event.id) ?? null,
      }));
  }

  async getOverviewCounts(userId: string): Promise<AssistantOverviewCounts> {
    const snapshot = this.snapshots.get(userId);
    if (!snapshot) {
      return { affirmationCount: 0, bilanCount: 0, reminderCount: 0, eventCount: 0 };
    }
    return {
      affirmationCount: snapshot.dayAffirmations.length,
      bilanCount: snapshot.dayBilans.length,
      reminderCount: snapshot.reminders.length,
      eventCount: snapshot.calendarEvents.length,
    };
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

function createAppForTest(options?: {
  assistantService?: AssistantService;
  assistantContextStore?: InMemoryAssistantContextStore;
}) {
  const taskStore = new InMemoryTaskStore();
  const commentStore = new InMemoryCommentStore();
  return buildApp({
    logLevel: "silent",
    taskStore,
    commentStore,
    authStore: new InMemoryAuthStore(),
    assistantContextStore: options?.assistantContextStore,
    assistantService: options?.assistantService ?? new EchoAssistantService(),
  });
}

function createAppForHeuristicTest(options?: {
  assistantContextStore?: InMemoryAssistantContextStore;
}) {
  const taskStore = new InMemoryTaskStore();
  const commentStore = new InMemoryCommentStore();
  return buildApp({
    logLevel: "silent",
    taskStore,
    commentStore,
    authStore: new InMemoryAuthStore(),
    assistantProvider: "heuristic",
    assistantContextStore: options?.assistantContextStore,
  });
}

function createAppForPhaseTwoSearchTest(options?: {
  assistantContextStore?: InMemoryAssistantContextStore;
}) {
  const taskStore = new InMemoryTaskStore();
  const commentStore = new InMemoryCommentStore();
  const attachmentStore = new InMemoryAttachmentStore();
  return buildApp({
    logLevel: "silent",
    taskStore,
    commentStore,
    attachmentStore,
    authStore: new InMemoryAuthStore(),
    assistantProvider: "heuristic",
    assistantContextStore: options?.assistantContextStore,
    assistantSearchDocumentStore: createInMemoryAssistantSearchDocumentStore(),
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

async function createTask(
  app: ReturnType<typeof createAppForTest>,
  token: string,
  title: string,
  targetDate = "2026-03-06"
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title,
      targetDate,
      status: "todo" satisfies TaskStatus,
      priority: "high" satisfies TaskPriority,
    },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  return (body.data as { id: string }).id;
}

async function createComment(
  app: ReturnType<typeof createAppForTest>,
  token: string,
  taskId: string,
  body: string
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: `/api/tasks/${taskId}/comments`,
    headers: authHeaders(token),
    payload: { body },
  });

  assert.equal(response.statusCode, 201);
  const payload = parsePayload(response.payload);
  return (payload.data as { id: string }).id;
}

async function createAttachment(
  app: ReturnType<typeof createAppForTest>,
  token: string,
  taskId: string,
  input: { name: string; url: string; contentType?: string | null; sizeBytes?: number | null }
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: `/api/tasks/${taskId}/attachments`,
    headers: authHeaders(token),
    payload: input,
  });

  assert.equal(response.statusCode, 201);
  const payload = parsePayload(response.payload);
  return (payload.data as { id: string }).id;
}

test("POST /api/assistant/reply returns assistant guidance with structured pipeline metadata", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  await createTask(app, token, "Finish release note", "2026-03-06");

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "What should I do first?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.equal(data.source, "heuristic");
  assert.equal(data.retrievalMode, "structured");
  assert.ok(Array.isArray(data.usedDomains));
  assert.equal(typeof data.matchedRecordsCount, "number");
});

test("POST /api/assistant/reply requires authentication", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    payload: {
      question: "What is next?",
    },
  });

  assert.equal(response.statusCode, 401);
});

test("POST /api/assistant/reply only uses tasks from authenticated user", async (t) => {
  const app = createAppForHeuristicTest();

  t.after(async () => {
    await app.close();
  });

  const ownerToken = await registerAndGetToken(app);
  const otherUserToken = await registerAndGetToken(app);

  await createTask(app, ownerToken, "Owner private task");

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(otherUserToken),
    payload: {
      question: "What should I focus on?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.equal(data.matchedRecordsCount, 0);
  assert.match(String(data.answer), /0 task/);
});

test("POST /api/assistant/reply validates body", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "",
    },
  });

  assert.equal(response.statusCode, 400);
  const body = parsePayload(response.payload);
  const error = body.error as { code: string; details?: string[] };

  assert.equal(error.code, "VALIDATION_ERROR");
  assert.ok(Array.isArray(error.details));
  assert.ok(error.details && error.details.length >= 1);
});

test("POST /api/assistant/reply keeps English planning response for English 'comment' prompts", async (t) => {
  const app = createAppForHeuristicTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  await createTask(app, token, "Finish roadmap review");

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "Can you comment on my priorities?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as { answer: string; source: string };

  assert.equal(data.source, "heuristic");
  assert.match(data.answer, /Task view/);
  assert.doesNotMatch(data.answer, /Vue taches/);
});

test("POST /api/assistant/reply includes assistant context from the wider user workspace", async (t) => {
  const assistantContextStore = new InMemoryAssistantContextStore();
  const app = createAppForHeuristicTest({ assistantContextStore });

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  await createTask(app, token, "Prepare board memo", "2026-03-08");

  const meResponse = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authHeaders(token),
  });

  assert.equal(meResponse.statusCode, 200);
  const meBody = parsePayload(meResponse.payload);
  const user = (meBody.data as { user: { id: string; email: string } }).user;

  const calendarEventId = "calendar-event-1";
  assistantContextStore.setSnapshot(user.id, {
    profile: {
      id: user.id,
      email: user.email,
      displayName: "Workspace User",
      preferredLocale: "en",
      preferredTimeZone: "Europe/Paris",
      requireDailyAffirmation: false,
      requireDailyBilan: false,
      requireWeeklySynthesis: false,
      requireMonthlySynthesis: false,
      createdAt: new Date("2026-03-01T08:00:00.000Z"),
      updatedAt: new Date("2026-03-08T09:00:00.000Z"),
    },
    dayAffirmations: [
      {
        id: "affirmation-1",
        userId: user.id,
        targetDate: new Date("2026-03-08T00:00:00.000Z"),
        text: "I will finish the memo today.",
        isCompleted: true,
        completedAt: new Date("2026-03-08T18:00:00.000Z"),
        createdAt: new Date("2026-03-08T07:00:00.000Z"),
        updatedAt: new Date("2026-03-08T18:00:00.000Z"),
      } satisfies DayAffirmation,
    ],
    dayBilans: [
      {
        id: "bilan-1",
        userId: user.id,
        targetDate: new Date("2026-03-08T00:00:00.000Z"),
        mood: 4,
        wins: "Memo draft completed",
        blockers: "Waiting for final review",
        lessonsLearned: "Start review earlier",
        tomorrowTop3: "Finalize board memo",
        createdAt: new Date("2026-03-08T18:00:00.000Z"),
        updatedAt: new Date("2026-03-08T18:10:00.000Z"),
      } satisfies DayBilan,
    ],
    reminders: [
      {
        id: "reminder-1",
        userId: user.id,
        title: "Send board memo",
        description: "Send the board memo after review",
        project: "Exec",
        assignees: "Godwin",
        remindAt: new Date("2026-03-09T08:30:00.000Z"),
        status: "pending",
        isFired: false,
        firedAt: null,
        isDismissed: false,
        dismissedAt: null,
        completedAt: null,
        cancelledAt: null,
        createdAt: new Date("2026-03-08T17:00:00.000Z"),
        updatedAt: new Date("2026-03-08T17:00:00.000Z"),
      } satisfies Reminder,
    ],
    calendarEvents: [
      {
        id: calendarEventId,
        userId: user.id,
        connectionId: "connection-1",
        googleEventId: "google-1",
        title: "Board review",
        description: "Review the memo with leadership",
        location: "Meet room",
        startTime: new Date("2026-03-09T09:00:00.000Z"),
        endTime: new Date("2026-03-09T09:30:00.000Z"),
        isAllDay: false,
        startDate: null,
        endDate: null,
        status: "confirmed",
        htmlLink: null,
        attendees: "lead@example.com",
        organizer: "ops@example.com",
        recurringEventId: null,
        syncedAt: new Date("2026-03-08T12:00:00.000Z"),
        createdAt: new Date("2026-03-08T12:00:00.000Z"),
        updatedAt: new Date("2026-03-08T12:00:00.000Z"),
      } satisfies CalendarEvent,
    ],
    calendarEventNotes: [
      {
        id: "note-1",
        calendarEventId,
        userId: user.id,
        body: "Need final approval before sending.",
        createdAt: new Date("2026-03-08T12:15:00.000Z"),
        updatedAt: new Date("2026-03-08T12:15:00.000Z"),
      } satisfies CalendarEventNote,
    ],
  });

  // Ask a generic workspace question → overview domain
  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "What can you tell me about my whole workspace?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.equal(data.retrievalMode, "structured");
  assert.ok(Array.isArray(data.usedDomains));
  assert.ok((data.matchedRecordsCount as number) >= 1);
  // Answer should mention tasks (from overview retrieval)
  assert.match(String(data.answer), /task/i);
});

test("POST /api/assistant/reply targets only tasks domain for task questions", async (t) => {
  const app = createAppForHeuristicTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  await createTask(app, token, "Write tests", "2026-03-06");
  await createTask(app, token, "Deploy app", "2026-03-06");

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "Show me my tasks",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.deepStrictEqual(data.usedDomains, ["tasks"]);
  assert.equal(data.matchedRecordsCount, 2);
  assert.match(String(data.answer), /Task view/);
});

test("POST /api/assistant/reply enforces context budget", async (t) => {
  const app = createAppForHeuristicTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);

  // Create many tasks to push context size
  for (let i = 0; i < 25; i++) {
    await createTask(app, token, `Task number ${i + 1} with a longer title to increase context size`, "2026-03-06");
  }

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "Show me my tasks",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  // Only 20 tasks should be retrieved (domain limit), not all 25
  assert.ok((data.matchedRecordsCount as number) <= 20);
  assert.equal(data.retrievalMode, "structured");
});

test("POST /api/assistant/reply falls back to overview when no domain matches", async (t) => {
  const app = createAppForHeuristicTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  await createTask(app, token, "Some task");

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "What is going on?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.deepStrictEqual(data.usedDomains, ["overview"]);
  assert.match(String(data.answer), /Workspace overview/);
});

test("POST /api/assistant/reply uses full-text search across comments for search questions", async (t) => {
  const app = createAppForPhaseTwoSearchTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const taskId = await createTask(app, token, "Prepare budget memo");
  await createComment(
    app,
    token,
    taskId,
    "Budget approval is blocked by the finance committee until next Tuesday."
  );

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "Where do I mention budget approval?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.equal(data.retrievalMode, "structured+fulltext");
  assert.ok((data.matchedRecordsCount as number) >= 1);
  assert.match(String(data.answer), /budget approval/i);
});

test("POST /api/assistant/reply indexes text attachments for search answers", async (t) => {
  const app = createAppForPhaseTwoSearchTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const taskId = await createTask(app, token, "Review contract");
  const attachmentText = "The client contract expires on September 30, 2026.";
  const dataUrl = `data:text/plain;base64,${Buffer.from(attachmentText, "utf8").toString("base64")}`;

  await createAttachment(app, token, taskId, {
    name: "contract.txt",
    url: dataUrl,
    contentType: "text/plain",
    sizeBytes: Buffer.byteLength(attachmentText, "utf8"),
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "What does the contract document say about expiration?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.equal(data.retrievalMode, "structured+fulltext");
  assert.ok((data.matchedRecordsCount as number) >= 1);
  assert.match(String(data.answer), /September 30, 2026/);
});

test("POST /api/assistant/reply searches calendar notes from assistant context", async (t) => {
  const assistantContextStore = new InMemoryAssistantContextStore();
  const app = createAppForPhaseTwoSearchTest({ assistantContextStore });

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const meResponse = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authHeaders(token),
  });

  assert.equal(meResponse.statusCode, 200);
  const meBody = parsePayload(meResponse.payload);
  const user = (meBody.data as { user: { id: string; email: string } }).user;

  assistantContextStore.setSnapshot(user.id, {
    profile: {
      id: user.id,
      email: user.email,
      displayName: "Calendar User",
      preferredLocale: "en",
      preferredTimeZone: "Europe/Paris",
      requireDailyAffirmation: false,
      requireDailyBilan: false,
      requireWeeklySynthesis: false,
      requireMonthlySynthesis: false,
      createdAt: new Date("2026-03-01T08:00:00.000Z"),
      updatedAt: new Date("2026-03-09T08:00:00.000Z"),
    },
    calendarEvents: [
      {
        id: "calendar-event-77",
        userId: user.id,
        connectionId: "connection-1",
        googleEventId: "google-77",
        title: "Q3 roadmap review",
        description: "Review roadmap milestones with leadership",
        location: "Paris HQ",
        startTime: new Date("2026-03-10T09:00:00.000Z"),
        endTime: new Date("2026-03-10T10:00:00.000Z"),
        isAllDay: false,
        startDate: null,
        endDate: null,
        status: "confirmed",
        htmlLink: null,
        organizer: "cto@example.com",
        attendees: "ceo@example.com",
        recurringEventId: null,
        syncedAt: new Date("2026-03-09T08:10:00.000Z"),
        createdAt: new Date("2026-03-09T08:00:00.000Z"),
        updatedAt: new Date("2026-03-09T08:10:00.000Z"),
      } satisfies CalendarEvent,
    ],
    calendarEventNotes: [
      {
        id: "calendar-note-77",
        userId: user.id,
        calendarEventId: "calendar-event-77",
        body: "Bring the Q3 roadmap printout and the revised dependency map.",
        createdAt: new Date("2026-03-09T08:20:00.000Z"),
        updatedAt: new Date("2026-03-09T08:20:00.000Z"),
      } satisfies CalendarEventNote,
    ],
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/assistant/reply",
    headers: authHeaders(token),
    payload: {
      question: "Where did I note the revised dependency map?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.equal(data.retrievalMode, "structured+fulltext");
  assert.ok((data.matchedRecordsCount as number) >= 1);
  assert.match(String(data.answer), /revised dependency map/i);
});
