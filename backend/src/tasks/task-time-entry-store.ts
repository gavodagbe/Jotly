import { PrismaClient } from "@prisma/client";

export type TaskTimeEntryRecord = {
  taskId: string;
  entryDate: Date;
  fraction: number;
};

export type UpsertTaskTimeEntryInput = {
  taskId: string;
  userId: string;
  entryDate: Date;
  fraction: number;
};

export type TaskTimeEntryStore = {
  listByDate(userId: string, entryDate: Date): Promise<TaskTimeEntryRecord[]>;
  upsert(input: UpsertTaskTimeEntryInput): Promise<TaskTimeEntryRecord>;
  remove(taskId: string, entryDate: Date): Promise<void>;
  close?: () => Promise<void>;
};

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function createPrismaTaskTimeEntryStore(prisma = new PrismaClient()): TaskTimeEntryStore {
  return {
    async listByDate(userId, entryDate) {
      const day = startOfUtcDay(entryDate);
      const entries = await prisma.taskTimeEntry.findMany({
        where: { userId, entryDate: day },
        select: { taskId: true, entryDate: true, fraction: true },
      });

      return entries.map((entry) => ({
        taskId: entry.taskId,
        entryDate: entry.entryDate,
        fraction: Number(entry.fraction),
      }));
    },

    async upsert(input) {
      const day = startOfUtcDay(input.entryDate);
      const entry = await prisma.taskTimeEntry.upsert({
        where: { taskId_entryDate: { taskId: input.taskId, entryDate: day } },
        create: {
          taskId: input.taskId,
          userId: input.userId,
          entryDate: day,
          fraction: input.fraction,
        },
        update: { fraction: input.fraction },
        select: { taskId: true, entryDate: true, fraction: true },
      });

      return {
        taskId: entry.taskId,
        entryDate: entry.entryDate,
        fraction: Number(entry.fraction),
      };
    },

    async remove(taskId, entryDate) {
      const day = startOfUtcDay(entryDate);
      await prisma.taskTimeEntry.deleteMany({
        where: { taskId, entryDate: day },
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
