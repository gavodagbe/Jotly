import { Reminder, Task } from "@prisma/client";
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
  PROJECT_NAME_TAKEN,
  PROJECT_NESTING_TOO_DEEP,
  PROJECT_PARENT_NOT_FOUND,
  ProjectCreateInput,
  ProjectRecord,
  ProjectStore,
  normalizeProjectName,
} from "../projects/project-store";
import { formatDateOnly, TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";
import { ReminderCreateInput, ReminderStore, ReminderUpdateInput } from "../reminders/reminder-store";

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

class InMemoryProjectStore implements ProjectStore {
  private readonly projects = new Map<string, ProjectRecord>();
  private counter = 1;

  async listByUser(userId: string): Promise<ProjectRecord[]> {
    return [...this.projects.values()].filter((project) => project.userId === userId);
  }
  async getById(id: string, userId: string): Promise<ProjectRecord | null> {
    const project = this.projects.get(id);
    return project && project.userId === userId ? project : null;
  }
  async listChildren(parentId: string, userId: string): Promise<ProjectRecord[]> {
    return [...this.projects.values()].filter(
      (project) => project.userId === userId && project.parentId === parentId
    );
  }
  async create(input: ProjectCreateInput): Promise<ProjectRecord> {
    const name = normalizeProjectName(input.name);
    const parentId = input.parentId ?? null;
    if (parentId) {
      const parent = this.projects.get(parentId);
      if (!parent || parent.userId !== input.userId) throw new Error(PROJECT_PARENT_NOT_FOUND);
      if (parent.parentId) throw new Error(PROJECT_NESTING_TOO_DEEP);
    }
    const key = name.toLocaleLowerCase();
    if (
      [...this.projects.values()].some(
        (p) => p.userId === input.userId && p.parentId === parentId && p.name.toLocaleLowerCase() === key
      )
    ) {
      throw new Error(PROJECT_NAME_TAKEN);
    }
    const now = new Date();
    const project: ProjectRecord = {
      id: `project-${this.counter++}`,
      userId: input.userId,
      name,
      parentId,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(project.id, project);
    return project;
  }
  async rename(id: string, userId: string, name: string): Promise<ProjectRecord | null> {
    const existing = await this.getById(id, userId);
    if (!existing) return null;
    const updated: ProjectRecord = { ...existing, name: normalizeProjectName(name), updatedAt: new Date() };
    this.projects.set(id, updated);
    return updated;
  }
  async remove(id: string, userId: string): Promise<ProjectRecord | null> {
    const existing = await this.getById(id, userId);
    if (!existing) return null;
    this.projects.delete(id);
    return existing;
  }
}

class InMemoryTaskStore implements TaskStore {
  readonly tasks = new Map<string, Task>();
  private counter = 1;

  async listByDate(targetDate: Date, userId: string): Promise<Task[]> {
    const day = formatDateOnly(targetDate);
    return [...this.tasks.values()].filter(
      (task) => task.userId === userId && formatDateOnly(task.targetDate) === day
    );
  }
  async listByUser(userId: string): Promise<Task[]> {
    return [...this.tasks.values()].filter((task) => task.userId === userId);
  }
  async getById(id: string, userId: string): Promise<Task | null> {
    const task = this.tasks.get(id);
    return task && task.userId === userId ? task : null;
  }
  async create(input: TaskCreateInput): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: `task-${this.counter++}`,
      userId: input.userId,
      rolledFromTaskId: input.rolledFromTaskId ?? null,
      title: input.title,
      description: input.description,
      status: input.status,
      targetDate: input.targetDate,
      dueDate: input.dueDate,
      priority: input.priority,
      project: input.project,
      subProject: input.subProject ?? null,
      projectId: input.projectId ?? null,
      assignees: input.assignees ?? null,
      plannedTime: input.plannedTime,
      recurrenceSourceTaskId: input.recurrenceSourceTaskId ?? null,
      recurrenceOccurrenceDate: input.recurrenceOccurrenceDate ?? null,
      calendarEventId: input.calendarEventId ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: input.completedAt,
      cancelledAt: input.cancelledAt,
    };
    this.tasks.set(task.id, task);
    return task;
  }
  async update(id: string, input: TaskUpdateInput, userId: string): Promise<Task | null> {
    const existing = await this.getById(id, userId);
    if (!existing) return null;
    const updated: Task = { ...existing, ...input, updatedAt: new Date() } as Task;
    this.tasks.set(id, updated);
    return updated;
  }
  async remove(id: string, userId: string): Promise<Task | null> {
    const existing = await this.getById(id, userId);
    if (!existing) return null;
    this.tasks.delete(id);
    return existing;
  }
  async countByProjectIds(userId: string, projectIds: string[]): Promise<number> {
    return [...this.tasks.values()].filter(
      (task) => task.userId === userId && task.projectId !== null && projectIds.includes(task.projectId)
    ).length;
  }
  async updateDenormalizedProjectFields(
    projectIds: string[],
    fields: { project?: string | null; subProject?: string | null }
  ): Promise<number> {
    let count = 0;
    for (const [id, task] of this.tasks) {
      if (task.projectId !== null && projectIds.includes(task.projectId)) {
        this.tasks.set(id, { ...task, ...fields });
        count += 1;
      }
    }
    return count;
  }
}

class InMemoryReminderStore implements ReminderStore {
  readonly reminders = new Map<string, Reminder>();
  private counter = 1;

  async listByUser(userId: string): Promise<Reminder[]> {
    return [...this.reminders.values()].filter((reminder) => reminder.userId === userId);
  }
  async listPending(): Promise<Reminder[]> { return []; }
  async getById(id: string, userId: string): Promise<Reminder | null> {
    const reminder = this.reminders.get(id);
    return reminder && reminder.userId === userId ? reminder : null;
  }
  async create(input: ReminderCreateInput): Promise<Reminder> {
    const now = new Date();
    const reminder: Reminder = {
      id: `reminder-${this.counter++}`,
      userId: input.userId,
      title: input.title,
      description: input.description ?? null,
      project: input.project ?? null,
      subProject: input.subProject ?? null,
      projectId: input.projectId ?? null,
      assignees: input.assignees ?? null,
      remindAt: input.remindAt,
      status: "pending",
      isFired: false,
      firedAt: null,
      isDismissed: false,
      dismissedAt: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.reminders.set(reminder.id, reminder);
    return reminder;
  }
  async update(id: string, input: ReminderUpdateInput, userId: string): Promise<Reminder | null> {
    const existing = await this.getById(id, userId);
    if (!existing) return null;
    const updated: Reminder = { ...existing, ...input, updatedAt: new Date() } as Reminder;
    this.reminders.set(id, updated);
    return updated;
  }
  async remove(id: string, userId: string): Promise<Reminder | null> {
    const existing = await this.getById(id, userId);
    if (!existing) return null;
    this.reminders.delete(id);
    return existing;
  }
  async markFired(): Promise<Reminder | null> { return null; }
  async complete(): Promise<Reminder | null> { return null; }
  async cancel(): Promise<Reminder | null> { return null; }
  async countByProjectIds(userId: string, projectIds: string[]): Promise<number> {
    return [...this.reminders.values()].filter(
      (r) => r.userId === userId && r.projectId !== null && projectIds.includes(r.projectId)
    ).length;
  }
  async updateDenormalizedProjectFields(
    projectIds: string[],
    fields: { project?: string | null; subProject?: string | null }
  ): Promise<number> {
    let count = 0;
    for (const [id, reminder] of this.reminders) {
      if (reminder.projectId !== null && projectIds.includes(reminder.projectId)) {
        this.reminders.set(id, { ...reminder, ...fields });
        count += 1;
      }
    }
    return count;
  }
}

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    authStore: new InMemoryAuthStore(),
    taskStore: new InMemoryTaskStore(),
    reminderStore: new InMemoryReminderStore(),
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
    payload: { email: `link-${Math.random().toString(36).slice(2)}@example.com`, password: "password123" },
  });
  assert.equal(response.statusCode, 201);
  return (parsePayload(response.payload).data as { token: string }).token;
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function createProject(app: ReturnType<typeof createAppForTest>, token: string, payload: { name: string; parentId?: string }) {
  const response = await app.inject({ method: "POST", url: "/api/projects", headers: authHeaders(token), payload });
  assert.equal(response.statusCode, 201);
  return parsePayload(response.payload).data as { id: string; name: string };
}

test("creating a task with a sub-project id fills the denormalized project/subProject cache", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const parent = await createProject(app, token, { name: "Acme" });
  const child = await createProject(app, token, { name: "Website", parentId: parent.id });

  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: { title: "Ship landing page", targetDate: "2026-08-27", projectId: child.id },
  });

  assert.equal(response.statusCode, 201);
  const task = parsePayload(response.payload).data as {
    project: string | null;
    subProject: string | null;
    projectId: string | null;
  };
  assert.equal(task.project, "Acme");
  assert.equal(task.subProject, "Website");
  assert.equal(task.projectId, child.id);
});

test("creating a task with a top-level project id leaves subProject null", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const parent = await createProject(app, token, { name: "Acme" });

  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: { title: "Kickoff", targetDate: "2026-08-27", projectId: parent.id },
  });

  const task = parsePayload(response.payload).data as { project: string | null; subProject: string | null };
  assert.equal(task.project, "Acme");
  assert.equal(task.subProject, null);
});

test("POST /api/tasks rejects an unknown project id", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: { title: "Orphan", targetDate: "2026-08-27", projectId: "nope" },
  });
  assert.equal(response.statusCode, 404);
});

test("clearing projectId on update wipes the denormalized cache", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const parent = await createProject(app, token, { name: "Acme" });
  const child = await createProject(app, token, { name: "Website", parentId: parent.id });
  const created = parsePayload(
    (await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: authHeaders(token),
      payload: { title: "T", targetDate: "2026-08-27", projectId: child.id },
    })).payload
  ).data as { id: string };

  const response = await app.inject({
    method: "PATCH",
    url: `/api/tasks/${created.id}`,
    headers: authHeaders(token),
    payload: { projectId: null },
  });

  const task = parsePayload(response.payload).data as {
    project: string | null;
    subProject: string | null;
    projectId: string | null;
  };
  assert.equal(task.project, null);
  assert.equal(task.subProject, null);
  assert.equal(task.projectId, null);
});

test("GET /api/tasks/all?projectId= also returns tasks under sub-projects", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const parent = await createProject(app, token, { name: "Acme" });
  const child = await createProject(app, token, { name: "Website", parentId: parent.id });
  const other = await createProject(app, token, { name: "Other" });

  for (const [title, projectId] of [
    ["direct", parent.id],
    ["nested", child.id],
    ["unrelated", other.id],
  ] as const) {
    await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: authHeaders(token),
      payload: { title, targetDate: "2026-08-27", projectId },
    });
  }

  const response = await app.inject({
    method: "GET",
    url: `/api/tasks/all?projectId=${parent.id}`,
    headers: authHeaders(token),
  });

  const titles = (parsePayload(response.payload).data as Array<{ title: string }>).map((t2) => t2.title).sort();
  assert.deepEqual(titles, ["direct", "nested"]);
});

test("renaming a project propagates to linked tasks and reminders", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const parent = await createProject(app, token, { name: "Acme" });
  const child = await createProject(app, token, { name: "Website", parentId: parent.id });

  const task = parsePayload(
    (await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: authHeaders(token),
      payload: { title: "T", targetDate: "2026-08-27", projectId: child.id },
    })).payload
  ).data as { id: string };

  const reminder = parsePayload(
    (await app.inject({
      method: "POST",
      url: "/api/reminders",
      headers: authHeaders(token),
      payload: { title: "R", remindAt: "2026-08-27T09:00:00.000Z", projectId: parent.id },
    })).payload
  ).data as { id: string };

  // Rename the top-level project -> both records' `project` cache updates.
  await app.inject({
    method: "PATCH",
    url: `/api/projects/${parent.id}`,
    headers: authHeaders(token),
    payload: { name: "Acme Inc" },
  });
  // Rename the sub-project -> only the task's `subProject` cache updates.
  await app.inject({
    method: "PATCH",
    url: `/api/projects/${child.id}`,
    headers: authHeaders(token),
    payload: { name: "Marketing Site" },
  });

  const taskAfter = parsePayload(
    (await app.inject({ method: "GET", url: `/api/tasks/all`, headers: authHeaders(token) })).payload
  ).data as Array<{ id: string; project: string | null; subProject: string | null }>;
  const linkedTask = taskAfter.find((row) => row.id === task.id);
  assert.equal(linkedTask?.project, "Acme Inc");
  assert.equal(linkedTask?.subProject, "Marketing Site");

  const reminderAfter = parsePayload(
    (await app.inject({ method: "GET", url: `/api/reminders/${reminder.id}`, headers: authHeaders(token) })).payload
  ).data as { project: string | null };
  assert.equal(reminderAfter.project, "Acme Inc");
});

test("DELETE /api/projects/:id is blocked while a task references the project", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });
  const token = await registerAndGetToken(app);

  const parent = await createProject(app, token, { name: "Acme" });
  const child = await createProject(app, token, { name: "Website", parentId: parent.id });

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: { title: "T", targetDate: "2026-08-27", projectId: child.id },
  });

  // Deleting the parent is blocked because a task is linked to its sub-project.
  const blockedParent = await app.inject({
    method: "DELETE",
    url: `/api/projects/${parent.id}`,
    headers: authHeaders(token),
  });
  assert.equal(blockedParent.statusCode, 409);

  // Deleting the sub-project directly is also blocked.
  const blockedChild = await app.inject({
    method: "DELETE",
    url: `/api/projects/${child.id}`,
    headers: authHeaders(token),
  });
  assert.equal(blockedChild.statusCode, 409);
});
