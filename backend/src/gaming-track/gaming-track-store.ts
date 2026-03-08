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

export type GamingTrackChallengeClaimRecord = {
  challengeId: string;
  challengeWeekStart: Date;
  rewardXp: number;
  claimedAt: Date;
};

export type GamingTrackStreakProtectionUsageRecord = {
  usedOn: Date;
  createdAt: Date;
};

export type GamingTrackNudgeDismissalRecord = {
  nudgeId: string;
  dismissedOn: Date;
  createdAt: Date;
};

export type GamingTrackStore = {
  getWindowData(userId: string, start: Date, endExclusive: Date): Promise<GamingTrackWindowData>;
  getLifetimeData(userId: string): Promise<GamingTrackWindowData>;
  getChallengeClaim(userId: string, challengeId: string, challengeWeekStart: Date): Promise<GamingTrackChallengeClaimRecord | null>;
  createChallengeClaim(input: {
    userId: string;
    challengeId: string;
    challengeWeekStart: Date;
    rewardXp: number;
  }): Promise<GamingTrackChallengeClaimRecord>;
  countStreakProtectionUsages(userId: string, endExclusive: Date): Promise<number>;
  getStreakProtectionUsage(userId: string, usedOn: Date): Promise<GamingTrackStreakProtectionUsageRecord | null>;
  createStreakProtectionUsage(input: { userId: string; usedOn: Date }): Promise<GamingTrackStreakProtectionUsageRecord>;
  getDismissedNudges(userId: string, start: Date, endExclusive: Date): Promise<GamingTrackNudgeDismissalRecord[]>;
  createNudgeDismissal(input: { userId: string; nudgeId: string; dismissedOn: Date }): Promise<GamingTrackNudgeDismissalRecord>;
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

    async getChallengeClaim(userId, challengeId, challengeWeekStart) {
      return prisma.gamingTrackChallengeClaim.findUnique({
        where: {
          userId_challengeId_challengeWeekStart: {
            userId,
            challengeId,
            challengeWeekStart,
          },
        },
        select: {
          challengeId: true,
          challengeWeekStart: true,
          rewardXp: true,
          claimedAt: true,
        },
      });
    },

    async createChallengeClaim(input) {
      return prisma.gamingTrackChallengeClaim.create({
        data: input,
        select: {
          challengeId: true,
          challengeWeekStart: true,
          rewardXp: true,
          claimedAt: true,
        },
      });
    },

    async countStreakProtectionUsages(userId, endExclusive) {
      return prisma.gamingTrackStreakProtectionUsage.count({
        where: {
          userId,
          usedOn: {
            lt: endExclusive,
          },
        },
      });
    },

    async getStreakProtectionUsage(userId, usedOn) {
      return prisma.gamingTrackStreakProtectionUsage.findUnique({
        where: {
          userId_usedOn: {
            userId,
            usedOn,
          },
        },
        select: {
          usedOn: true,
          createdAt: true,
        },
      });
    },

    async createStreakProtectionUsage(input) {
      return prisma.gamingTrackStreakProtectionUsage.create({
        data: input,
        select: {
          usedOn: true,
          createdAt: true,
        },
      });
    },

    async getDismissedNudges(userId, start, endExclusive) {
      return prisma.gamingTrackNudgeDismissal.findMany({
        where: {
          userId,
          dismissedOn: {
            gte: start,
            lt: endExclusive,
          },
        },
        select: {
          nudgeId: true,
          dismissedOn: true,
          createdAt: true,
        },
      });
    },

    async createNudgeDismissal(input) {
      return prisma.gamingTrackNudgeDismissal.create({
        data: input,
        select: {
          nudgeId: true,
          dismissedOn: true,
          createdAt: true,
        },
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
