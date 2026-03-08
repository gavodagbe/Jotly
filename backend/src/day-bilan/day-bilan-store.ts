import { DayBilan, PrismaClient } from "@prisma/client";

export type DayBilanUpsertInput = {
  userId: string;
  targetDate: Date;
  mood: number | null;
  wins: string | null;
  blockers: string | null;
  lessonsLearned: string | null;
  tomorrowTop3: string | null;
};

export type DayBilanStore = {
  getByDate(targetDate: Date, userId: string): Promise<DayBilan | null>;
  upsert(input: DayBilanUpsertInput): Promise<DayBilan>;
  close?: () => Promise<void>;
};

export function createPrismaDayBilanStore(prisma = new PrismaClient()): DayBilanStore {
  return {
    async getByDate(targetDate, userId) {
      return prisma.dayBilan.findUnique({
        where: {
          userId_targetDate: {
            userId,
            targetDate,
          },
        },
      });
    },

    async upsert(input) {
      return prisma.dayBilan.upsert({
        where: {
          userId_targetDate: {
            userId: input.userId,
            targetDate: input.targetDate,
          },
        },
        create: {
          userId: input.userId,
          targetDate: input.targetDate,
          mood: input.mood,
          wins: input.wins,
          blockers: input.blockers,
          lessonsLearned: input.lessonsLearned,
          tomorrowTop3: input.tomorrowTop3,
        },
        update: {
          mood: input.mood,
          wins: input.wins,
          blockers: input.blockers,
          lessonsLearned: input.lessonsLearned,
          tomorrowTop3: input.tomorrowTop3,
        },
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
