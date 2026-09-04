import { Task, TaskRecurrenceRule } from "@prisma/client";

import {
  AuthSession,
  AuthStore,
  AuthUser,
  CreateAuthSessionInput,
  CreateAuthUserInput,
} from "../auth/auth-store";
import { RecurrenceStore, TaskRecurrenceRuleUpsertInput } from "./recurrence-store";
import { formatDateOnly, TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, Task>();
  private idCounter = 1;

  async listByDate(targetDate: Date, userId: string): Promise<Task[]> {
    const selectedDate = formatDateOnly(targetDate);
    const matches = [...this.tasks.values()].filter(
      (task) => task.userId === userId && formatDateOnly(task.targetDate) === selectedDate
    );
    return matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async listByUser(userId: string): Promise<Task[]> {
    const matches = [...this.tasks.values()].filter((task) => task.userId === userId);
    return matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
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
      subProject: input.subProject ?? null,
      projectId: input.projectId ?? null,
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
      autoCancelIfUntouched: input.autoCancelIfUntouched ?? false,
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async update(id: string, input: TaskUpdateInput, userId: string): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const updated: Task = { ...existing, ...input, updatedAt: new Date() };
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

export class DuplicateGeneratedTaskStore extends InMemoryTaskStore {
  private hasSimulatedConflict = false;

  async create(input: TaskCreateInput): Promise<Task> {
    if (input.recurrenceSourceTaskId && !this.hasSimulatedConflict) {
      this.hasSimulatedConflict = true;
      await super.create(input);
      throw { code: "P2002" };
    }

    return super.create(input);
  }
}

export class InMemoryRecurrenceStore implements RecurrenceStore {
  private readonly rules = new Map<string, TaskRecurrenceRule>();
  private idCounter = 1;

  async listForDate(targetDate: Date, _userId: string): Promise<TaskRecurrenceRule[]> {
    return [...this.rules.values()].filter((rule) => {
      if (!rule.endsOn) {
        return true;
      }
      return rule.endsOn.getTime() >= targetDate.getTime();
    });
  }

  async getByTaskId(taskId: string): Promise<TaskRecurrenceRule | null> {
    return this.rules.get(taskId) ?? null;
  }

  async upsertByTaskId(taskId: string, input: TaskRecurrenceRuleUpsertInput): Promise<TaskRecurrenceRule> {
    const existing = this.rules.get(taskId);
    const now = new Date();

    if (existing) {
      const updated: TaskRecurrenceRule = {
        ...existing,
        frequency: input.frequency,
        interval: input.interval,
        weekdays: [...input.weekdays],
        endsOn: input.endsOn,
        updatedAt: now,
      };
      this.rules.set(taskId, updated);
      return updated;
    }

    const created: TaskRecurrenceRule = {
      id: `rule-${this.idCounter++}`,
      taskId,
      frequency: input.frequency,
      interval: input.interval,
      weekdays: [...input.weekdays],
      endsOn: input.endsOn,
      createdAt: now,
      updatedAt: now,
    };
    this.rules.set(taskId, created);
    return created;
  }

  async removeByTaskId(taskId: string): Promise<TaskRecurrenceRule | null> {
    const existing = this.rules.get(taskId);
    if (!existing) {
      return null;
    }
    this.rules.delete(taskId);
    return existing;
  }
}

export class InMemoryAuthStore implements AuthStore {
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
