import { Prisma, PrismaClient, Task, TaskPriority, TaskStatus } from "@prisma/client";

export type TaskCreateInput = {
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: Date;
  priority: TaskPriority;
  project: string | null;
  plannedTime: number | null;
  recurrenceSourceTaskId?: string | null;
  recurrenceOccurrenceDate?: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
};

export type TaskUpdateInput = Partial<TaskCreateInput>;

export type TaskStore = {
  listByDate(targetDate: Date): Promise<Task[]>;
  getById(id: string): Promise<Task | null>;
  create(input: TaskCreateInput): Promise<Task>;
  update(id: string, input: TaskUpdateInput): Promise<Task | null>;
  remove(id: string): Promise<Task | null>;
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

function isNotFoundPrismaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

export function createPrismaTaskStore(prisma = new PrismaClient()): TaskStore {
  return {
    async listByDate(targetDate) {
      const { start, end } = getDateRange(targetDate);

      return prisma.task.findMany({
        where: {
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

    async getById(id) {
      return prisma.task.findUnique({
        where: { id }
      });
    },

    async create(input) {
      return prisma.task.create({
        data: input
      });
    },

    async update(id, input) {
      try {
        return await prisma.task.update({
          where: { id },
          data: input
        });
      } catch (error) {
        if (isNotFoundPrismaError(error)) {
          return null;
        }

        throw error;
      }
    },

    async remove(id) {
      try {
        return await prisma.task.delete({
          where: { id }
        });
      } catch (error) {
        if (isNotFoundPrismaError(error)) {
          return null;
        }

        throw error;
      }
    },

    async close() {
      await prisma.$disconnect();
    }
  };
}
