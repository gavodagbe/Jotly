import { WeeklyEntry, PrismaClient } from "@prisma/client";

export type WeeklyEntryUpsertInput = {
  userId: string;
  year: number;
  isoWeek: number;
  objective?: string | null;
  review?: string | null;
};

export type WeeklyEntryStore = {
  getByWeek(year: number, isoWeek: number, userId: string): Promise<WeeklyEntry | null>;
  listByUser(userId: string): Promise<WeeklyEntry[]>;
  upsert(input: WeeklyEntryUpsertInput): Promise<WeeklyEntry>;
  close?: () => Promise<void>;
};

export function createPrismaWeeklyEntryStore(prisma = new PrismaClient()): WeeklyEntryStore {
  return {
    async getByWeek(year, isoWeek, userId) {
      return prisma.weeklyEntry.findUnique({
        where: { userId_year_isoWeek: { userId, year, isoWeek } },
      });
    },

    async listByUser(userId) {
      return prisma.weeklyEntry.findMany({ where: { userId } });
    },

    async upsert(input) {
      return prisma.weeklyEntry.upsert({
        where: {
          userId_year_isoWeek: {
            userId: input.userId,
            year: input.year,
            isoWeek: input.isoWeek,
          },
        },
        create: {
          userId: input.userId,
          year: input.year,
          isoWeek: input.isoWeek,
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
