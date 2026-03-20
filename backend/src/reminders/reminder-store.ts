import { Reminder, ReminderStatus, PrismaClient } from "@prisma/client";

export type ReminderCreateInput = {
  userId: string;
  title: string;
  description?: string | null;
  project?: string | null;
  assignees?: string | null;
  remindAt: Date;
};

export type ReminderUpdateInput = {
  title?: string;
  description?: string | null;
  project?: string | null;
  assignees?: string | null;
  remindAt?: Date;
};

export type ReminderListFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  activeBefore?: Date;
  statuses?: ReminderStatus[];
};

export type ReminderStore = {
  listByUser(userId: string, filters?: ReminderListFilters): Promise<Reminder[]>;
  listPending(userId: string): Promise<Reminder[]>;
  getById(id: string, userId: string): Promise<Reminder | null>;
  create(input: ReminderCreateInput): Promise<Reminder>;
  update(id: string, input: ReminderUpdateInput, userId: string): Promise<Reminder | null>;
  remove(id: string, userId: string): Promise<Reminder | null>;
  markFired(id: string, userId: string): Promise<Reminder | null>;
  complete(id: string, userId: string): Promise<Reminder | null>;
  cancel(id: string, userId: string): Promise<Reminder | null>;
  close?: () => Promise<void>;
};

export function createPrismaReminderStore(prisma = new PrismaClient()): ReminderStore {
  return {
    async listByUser(userId, filters) {
      const where: Record<string, unknown> = { userId };

      if (filters?.activeBefore) {
        where.remindAt = { lt: filters.activeBefore };
      } else if (filters?.dateFrom || filters?.dateTo) {
        const remindAtFilter: Record<string, Date> = {};
        if (filters.dateFrom) remindAtFilter.gte = filters.dateFrom;
        if (filters.dateTo) remindAtFilter.lt = filters.dateTo;
        where.remindAt = remindAtFilter;
      }

      if (filters?.statuses?.length) {
        where.status = { in: filters.statuses };
      }

      return prisma.reminder.findMany({
        where,
        orderBy: { remindAt: "asc" },
      });
    },

    async listPending(userId) {
      return prisma.reminder.findMany({
        where: {
          userId,
          remindAt: { lte: new Date() },
          status: "pending",
        },
        orderBy: { remindAt: "asc" },
      });
    },

    async getById(id, userId) {
      return prisma.reminder.findFirst({
        where: { id, userId },
      });
    },

    async create(input) {
      return prisma.reminder.create({
        data: {
          userId: input.userId,
          title: input.title,
          description: input.description ?? null,
          project: input.project ?? null,
          assignees: input.assignees ?? null,
          remindAt: input.remindAt,
          status: "pending",
        },
      });
    },

    async update(id, input, userId) {
      const existing = await prisma.reminder.findFirst({ where: { id, userId } });
      if (!existing) return null;

      return prisma.reminder.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.project !== undefined ? { project: input.project } : {}),
          ...(input.assignees !== undefined ? { assignees: input.assignees } : {}),
          ...(input.remindAt !== undefined ? { remindAt: input.remindAt } : {}),
          ...(input.remindAt !== undefined && existing.status === "fired" && input.remindAt.getTime() > Date.now()
            ? { status: "pending" satisfies ReminderStatus, isFired: false, firedAt: null }
            : {}),
        },
      });
    },

    async remove(id, userId) {
      const existing = await prisma.reminder.findFirst({ where: { id, userId } });
      if (!existing) return null;

      return prisma.reminder.delete({ where: { id } });
    },

    async markFired(id, userId) {
      const existing = await prisma.reminder.findFirst({ where: { id, userId } });
      if (!existing) return null;

      return prisma.reminder.update({
        where: { id },
        data: { status: "fired", isFired: true, firedAt: new Date() },
      });
    },

    async complete(id, userId) {
      const existing = await prisma.reminder.findFirst({ where: { id, userId } });
      if (!existing) return null;

      return prisma.reminder.update({
        where: { id },
        data: {
          status: "completed",
          isDismissed: true,
          dismissedAt: new Date(),
          completedAt: new Date(),
        },
      });
    },

    async cancel(id, userId) {
      const existing = await prisma.reminder.findFirst({ where: { id, userId } });
      if (!existing) return null;

      return prisma.reminder.update({
        where: { id },
        data: {
          status: "cancelled",
          isDismissed: true,
          dismissedAt: new Date(),
          cancelledAt: new Date(),
        },
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
