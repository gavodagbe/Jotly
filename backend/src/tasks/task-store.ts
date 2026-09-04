import { PrismaClient, Task, TaskPriority, TaskStatus } from "@prisma/client";

export type TaskCreateInput = {
  userId: string;
  rolledFromTaskId?: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: Date;
  dueDate: Date | null;
  priority: TaskPriority;
  project: string | null;
  subProject?: string | null;
  projectId?: string | null;
  assignees?: string | null;
  plannedTime: number | null;
  recurrenceSourceTaskId?: string | null;
  recurrenceOccurrenceDate?: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  calendarEventId?: string | null;
  autoCancelIfUntouched?: boolean;
};

export type TaskUpdateInput = Partial<Omit<TaskCreateInput, "userId">>;

export type TaskStore = {
  listByDate(targetDate: Date, userId: string): Promise<Task[]>;
  listByUser(userId: string): Promise<Task[]>;
  getById(id: string, userId: string): Promise<Task | null>;
  create(input: TaskCreateInput): Promise<Task>;
  update(id: string, input: TaskUpdateInput, userId: string): Promise<Task | null>;
  remove(id: string, userId: string): Promise<Task | null>;
  /** Number of tasks linked to any of the given project ids (used before project deletion). */
  countByProjectIds?(userId: string, projectIds: string[]): Promise<number>;
  /** Map of `projectId` -> number of tasks pointing at that exact node (admin overview). */
  groupCountByProject?(userId: string): Promise<Record<string, number>>;
  /** Refreshes the denormalized project/subProject name cache for the given project ids. */
  updateDenormalizedProjectFields?(
    projectIds: string[],
    fields: { project?: string | null; subProject?: string | null }
  ): Promise<number>;
  close?: () => Promise<void>;
};

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getDateRange(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function createPrismaTaskStore(prisma = new PrismaClient()): TaskStore {
  return {
    async listByDate(targetDate, userId) {
      const { start, end } = getDateRange(targetDate);

      return prisma.task.findMany({
        where: {
          userId,
          targetDate: {
            gte: start,
            lt: end
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      });
    },

    async listByUser(userId) {
      return prisma.task.findMany({
        where: {
          userId,
        },
        orderBy: [
          {
            targetDate: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      });
    },

    async getById(id, userId) {
      return prisma.task.findFirst({
        where: { id, userId }
      });
    },

    async create(input) {
      return prisma.task.create({
        data: input
      });
    },

    async update(id, input, userId) {
      const existing = await prisma.task.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return null;
      }

      return prisma.task.update({
        where: { id },
        data: input
      });
    },

    async remove(id, userId) {
      const existing = await prisma.task.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return null;
      }

      return prisma.task.delete({
        where: { id }
      });
    },

    async countByProjectIds(userId, projectIds) {
      if (projectIds.length === 0) {
        return 0;
      }
      return prisma.task.count({
        where: { userId, projectId: { in: projectIds } },
      });
    },

    async updateDenormalizedProjectFields(projectIds, fields) {
      if (projectIds.length === 0 || Object.keys(fields).length === 0) {
        return 0;
      }
      const result = await prisma.task.updateMany({
        where: { projectId: { in: projectIds } },
        data: fields,
      });
      return result.count;
    },

    async groupCountByProject(userId) {
      const rows = await prisma.task.groupBy({
        by: ["projectId"],
        where: { userId, projectId: { not: null } },
        _count: { _all: true },
      });
      const counts: Record<string, number> = {};
      for (const row of rows) {
        if (row.projectId) {
          counts[row.projectId] = row._count._all;
        }
      }
      return counts;
    },

    async close() {
      await prisma.$disconnect();
    }
  };
}
