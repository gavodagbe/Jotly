import { PrismaClient } from "@prisma/client";

export type UserProfile = {
  id: string;
  email: string;
  displayName: string | null;
  preferredLocale: string;
  preferredTimeZone: string | null;
  requireDailyAffirmation: boolean;
  requireDailyBilan: boolean;
  requireWeeklySynthesis: boolean;
  requireMonthlySynthesis: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UserProfileUpdateInput = {
  displayName?: string | null;
  preferredLocale?: string;
  preferredTimeZone?: string | null;
  requireDailyAffirmation?: boolean;
  requireDailyBilan?: boolean;
  requireWeeklySynthesis?: boolean;
  requireMonthlySynthesis?: boolean;
};

export type ProfileStore = {
  getByUserId(userId: string): Promise<UserProfile | null>;
  updateByUserId(userId: string, input: UserProfileUpdateInput): Promise<UserProfile | null>;
  close?: () => Promise<void>;
};

const profileSelect = {
  id: true,
  email: true,
  displayName: true,
  preferredLocale: true,
  preferredTimeZone: true,
  requireDailyAffirmation: true,
  requireDailyBilan: true,
  requireWeeklySynthesis: true,
  requireMonthlySynthesis: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function createPrismaProfileStore(prisma = new PrismaClient()): ProfileStore {
  return {
    async getByUserId(userId) {
      return prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
    },

    async updateByUserId(userId, input) {
      return prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName ?? null } : {}),
          ...(input.preferredLocale !== undefined ? { preferredLocale: input.preferredLocale } : {}),
          ...(input.preferredTimeZone !== undefined ? { preferredTimeZone: input.preferredTimeZone ?? null } : {}),
          ...(input.requireDailyAffirmation !== undefined ? { requireDailyAffirmation: input.requireDailyAffirmation } : {}),
          ...(input.requireDailyBilan !== undefined ? { requireDailyBilan: input.requireDailyBilan } : {}),
          ...(input.requireWeeklySynthesis !== undefined ? { requireWeeklySynthesis: input.requireWeeklySynthesis } : {}),
          ...(input.requireMonthlySynthesis !== undefined ? { requireMonthlySynthesis: input.requireMonthlySynthesis } : {}),
        },
        select: profileSelect,
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
