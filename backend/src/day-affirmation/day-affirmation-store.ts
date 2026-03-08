import { DayAffirmation, PrismaClient } from "@prisma/client";

export type DayAffirmationUpsertInput = {
  userId: string;
  targetDate: Date;
  text: string;
  isCompleted: boolean;
  completedAt: Date | null;
};

export type DayAffirmationStore = {
  getByDate(targetDate: Date, userId: string): Promise<DayAffirmation | null>;
  upsert(input: DayAffirmationUpsertInput): Promise<DayAffirmation>;
  close?: () => Promise<void>;
};

export function createPrismaDayAffirmationStore(prisma = new PrismaClient()): DayAffirmationStore {
  return {
    async getByDate(targetDate, userId) {
      return prisma.dayAffirmation.findUnique({
        where: {
          userId_targetDate: {
            userId,
            targetDate,
          },
        },
      });
    },

    async upsert(input) {
      return prisma.dayAffirmation.upsert({
        where: {
          userId_targetDate: {
            userId: input.userId,
            targetDate: input.targetDate,
          },
        },
        create: {
          userId: input.userId,
          targetDate: input.targetDate,
          text: input.text,
          isCompleted: input.isCompleted,
          completedAt: input.completedAt,
        },
        update: {
          text: input.text,
          isCompleted: input.isCompleted,
          completedAt: input.completedAt,
        },
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
