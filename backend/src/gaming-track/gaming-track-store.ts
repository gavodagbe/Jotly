import { PrismaClient, TaskStatus } from "@prisma/client";

export type GamingTrackTaskRecord = {
  targetDate: Date;
  status: TaskStatus;
  rolledFromTaskId: string | null;
};

export type GamingTrackAffirmationRecord = {
  targetDate: Date;
  isCompleted: boolean;
};

export type GamingTrackBilanRecord = {
  targetDate: Date;
  mood: number | null;
  wins: string | null;
  blockers: string | null;
  lessonsLearned: string | null;
  tomorrowTop3: string | null;
};

export type GamingTrackWindowData = {
  tasks: GamingTrackTaskRecord[];
  affirmations: GamingTrackAffirmationRecord[];
  bilans: GamingTrackBilanRecord[];
};

export type GamingTrackStore = {
  getWindowData(userId: string, start: Date, endExclusive: Date): Promise<GamingTrackWindowData>;
  getLifetimeData(userId: string): Promise<GamingTrackWindowData>;
  close?: () => Promise<void>;
};

export function createPrismaGamingTrackStore(prisma = new PrismaClient()): GamingTrackStore {
  const taskSelect = {
    targetDate: true,
    status: true,
    rolledFromTaskId: true,
  } as const;

  const affirmationSelect = {
    targetDate: true,
    isCompleted: true,
  } as const;

  const bilanSelect = {
    targetDate: true,
    mood: true,
    wins: true,
    blockers: true,
    lessonsLearned: true,
    tomorrowTop3: true,
  } as const;

  return {
    async getWindowData(userId, start, endExclusive) {
      const [tasks, affirmations, bilans] = await Promise.all([
        prisma.task.findMany({
          where: {
            userId,
            targetDate: {
              gte: start,
              lt: endExclusive,
            },
          },
          select: taskSelect,
        }),
        prisma.dayAffirmation.findMany({
          where: {
            userId,
            targetDate: {
              gte: start,
              lt: endExclusive,
            },
          },
          select: affirmationSelect,
        }),
        prisma.dayBilan.findMany({
          where: {
            userId,
            targetDate: {
              gte: start,
              lt: endExclusive,
            },
          },
          select: bilanSelect,
        }),
      ]);

      return {
        tasks,
        affirmations,
        bilans,
      };
    },

    async getLifetimeData(userId) {
      const [tasks, affirmations, bilans] = await Promise.all([
        prisma.task.findMany({
          where: { userId },
          select: taskSelect,
        }),
        prisma.dayAffirmation.findMany({
          where: { userId },
          select: affirmationSelect,
        }),
        prisma.dayBilan.findMany({
          where: { userId },
          select: bilanSelect,
        }),
      ]);

      return {
        tasks,
        affirmations,
        bilans,
      };
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
