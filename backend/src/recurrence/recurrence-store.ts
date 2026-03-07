import { PrismaClient, TaskRecurrenceRule } from "@prisma/client";

type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export type TaskRecurrenceRuleUpsertInput = {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: number[];
  endsOn: Date | null;
};

export type RecurrenceStore = {
  listForDate(targetDate: Date, userId: string): Promise<TaskRecurrenceRule[]>;
  getByTaskId(taskId: string): Promise<TaskRecurrenceRule | null>;
  upsertByTaskId(taskId: string, input: TaskRecurrenceRuleUpsertInput): Promise<TaskRecurrenceRule>;
  removeByTaskId(taskId: string): Promise<TaskRecurrenceRule | null>;
  close?: () => Promise<void>;
};

export function createPrismaRecurrenceStore(prisma = new PrismaClient()): RecurrenceStore {
  return {
    async listForDate(targetDate, userId) {
      return prisma.taskRecurrenceRule.findMany({
        where: {
          task: {
            userId
          },
          OR: [{ endsOn: null }, { endsOn: { gte: targetDate } }],
        },
        orderBy: { createdAt: "asc" },
      });
    },

    async getByTaskId(taskId) {
      return prisma.taskRecurrenceRule.findUnique({
        where: { taskId },
      });
    },

    async upsertByTaskId(taskId, input) {
      return prisma.taskRecurrenceRule.upsert({
        where: { taskId },
        create: {
          taskId,
          ...input,
        },
        update: {
          ...input,
        },
      });
    },

    async removeByTaskId(taskId) {
      const existing = await prisma.taskRecurrenceRule.findUnique({
        where: { taskId },
      });

      if (!existing) {
        return null;
      }

      await prisma.taskRecurrenceRule.delete({
        where: { taskId },
      });

      return existing;
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
