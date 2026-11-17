/** In-memory ReminderStore for route tests (mirrors the Prisma store, incl. client-provided ids). */
import { Reminder } from "@prisma/client";
import {
  ReminderCreateInput,
  ReminderListFilters,
  ReminderStore,
  ReminderUpdateInput,
} from "./reminder-store";

export class InMemoryReminderStore implements ReminderStore {
  private readonly reminders = new Map<string, Reminder>();
  private idCounter = 1;

  async listByUser(userId: string, filters?: ReminderListFilters): Promise<Reminder[]> {
    const results: Reminder[] = [];
    for (const r of this.reminders.values()) {
      if (r.userId !== userId) continue;
      if (filters?.activeBefore && r.remindAt >= filters.activeBefore) continue;
      if (!filters?.activeBefore) {
        if (filters?.dateFrom && r.remindAt < filters.dateFrom) continue;
        if (filters?.dateTo && r.remindAt >= filters.dateTo) continue;
      }
      if (filters?.statuses?.length && !filters.statuses.includes(r.status)) continue;
      results.push(r);
    }
    return results.sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
  }

  async listPending(userId: string): Promise<Reminder[]> {
    const now = new Date();
    const results: Reminder[] = [];
    for (const r of this.reminders.values()) {
      if (r.userId === userId && r.remindAt <= now && r.status === "pending") {
        results.push(r);
      }
    }
    return results.sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
  }

  async getById(id: string, userId: string): Promise<Reminder | null> {
    const r = this.reminders.get(id);
    if (!r || r.userId !== userId) return null;
    return r;
  }

  async create(input: ReminderCreateInput): Promise<Reminder> {
    if (input.id && this.reminders.has(input.id)) {
      throw { code: "P2002" };
    }
    const now = new Date();
    const reminder: Reminder = {
      id: input.id ?? `reminder-${this.idCounter++}`,
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
    const existing = this.reminders.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: Reminder = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.project !== undefined ? { project: input.project } : {}),
      ...(input.subProject !== undefined ? { subProject: input.subProject } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.assignees !== undefined ? { assignees: input.assignees } : {}),
      ...(input.remindAt !== undefined ? { remindAt: input.remindAt } : {}),
      ...(input.remindAt !== undefined && existing.status === "fired" && input.remindAt.getTime() > Date.now()
        ? { status: "pending" as const, isFired: false, firedAt: null }
        : {}),
      updatedAt: new Date(),
    };
    this.reminders.set(id, updated);
    return updated;
  }

  async remove(id: string, userId: string): Promise<Reminder | null> {
    const existing = this.reminders.get(id);
    if (!existing || existing.userId !== userId) return null;
    this.reminders.delete(id);
    return existing;
  }

  async markFired(id: string, userId: string): Promise<Reminder | null> {
    const existing = this.reminders.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: Reminder = {
      ...existing,
      status: "fired",
      isFired: true,
      firedAt: new Date(),
      updatedAt: new Date(),
    };
    this.reminders.set(id, updated);
    return updated;
  }

  async complete(id: string, userId: string): Promise<Reminder | null> {
    const existing = this.reminders.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: Reminder = {
      ...existing,
      status: "completed",
      isDismissed: true,
      dismissedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    };
    this.reminders.set(id, updated);
    return updated;
  }

  async cancel(id: string, userId: string): Promise<Reminder | null> {
    const existing = this.reminders.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: Reminder = {
      ...existing,
      status: "cancelled",
      isDismissed: true,
      dismissedAt: new Date(),
      cancelledAt: new Date(),
      updatedAt: new Date(),
    };
    this.reminders.set(id, updated);
    return updated;
  }
}
