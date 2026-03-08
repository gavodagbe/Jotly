import { PrismaClient } from "@prisma/client";

export type UserProfile = {
  id: string;
  email: string;
  displayName: string | null;
  preferredLocale: string;
  preferredTimeZone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserProfileUpdateInput = {
  displayName?: string | null;
  preferredLocale?: string;
  preferredTimeZone?: string | null;
};

export type ProfileStore = {
  getByUserId(userId: string): Promise<UserProfile | null>;
  updateByUserId(userId: string, input: UserProfileUpdateInput): Promise<UserProfile | null>;
  close?: () => Promise<void>;
};

export function createPrismaProfileStore(prisma = new PrismaClient()): ProfileStore {
  return {
    async getByUserId(userId) {
      return prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          preferredLocale: true,
          preferredTimeZone: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    },

    async updateByUserId(userId, input) {
      return prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName ?? null } : {}),
          ...(input.preferredLocale !== undefined ? { preferredLocale: input.preferredLocale } : {}),
          ...(input.preferredTimeZone !== undefined
            ? { preferredTimeZone: input.preferredTimeZone ?? null }
            : {}),
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          preferredLocale: true,
          preferredTimeZone: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
