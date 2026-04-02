import { MonthlyEntry, PrismaClient } from "@prisma/client";

export type MonthlyEntryUpsertInput = {
  userId: string;
  year: number;
  month: number;
  objective?: string | null;
  review?: string | null;
};

export type MonthlyEntryStore = {
  getByMonth(year: number, month: number, userId: string): Promise<MonthlyEntry | null>;
  listByUser(userId: string): Promise<MonthlyEntry[]>;
  upsert(input: MonthlyEntryUpsertInput): Promise<MonthlyEntry>;
  close?: () => Promise<void>;
};

export function createPrismaMonthlyEntryStore(prisma = new PrismaClient()): MonthlyEntryStore {
  return {
    async getByMonth(year, month, userId) {
      return prisma.monthlyEntry.findUnique({
        where: { userId_year_month: { userId, year, month } },
      });
    },

    async listByUser(userId) {
      return prisma.monthlyEntry.findMany({ where: { userId } });
    },

    async upsert(input) {
      return prisma.monthlyEntry.upsert({
        where: {
          userId_year_month: {
            userId: input.userId,
            year: input.year,
            month: input.month,
          },
        },
        create: {
          userId: input.userId,
          year: input.year,
          month: input.month,
          objective: input.objective ?? null,
          review: input.review ?? null,
        },
        update: {
          ...(input.objective !== undefined ? { objective: input.objective } : {}),
          ...(input.review !== undefined ? { review: input.review } : {}),
        },
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
