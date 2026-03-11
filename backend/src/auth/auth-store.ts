import { PrismaClient } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  preferredLocale?: string | null;
  preferredTimeZone?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthSession = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
};

export type CreateAuthUserInput = {
  email: string;
  passwordHash: string;
  displayName: string | null;
};

export type CreateAuthSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type AuthStore = {
  createUser(input: CreateAuthUserInput): Promise<AuthUser>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  createSession(input: CreateAuthSessionInput): Promise<AuthSession>;
  findSessionById?(sessionId: string): Promise<AuthSession | null>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null>;
  revokeSession(sessionId: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<void>;
  close?: () => Promise<void>;
};

export function createPrismaAuthStore(prisma = new PrismaClient()): AuthStore {
  return {
    async createUser(input) {
      return prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          displayName: input.displayName
        }
      });
    },

    async findUserByEmail(email) {
      return prisma.user.findUnique({
        where: { email }
      });
    },

    async findUserById(id) {
      return prisma.user.findUnique({
        where: { id }
      });
    },

    async createSession(input) {
      return prisma.session.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt
        }
      });
    },

    async findSessionByTokenHash(tokenHash) {
      return prisma.session.findUnique({
        where: { tokenHash }
      });
    },

    async findSessionById(sessionId) {
      return prisma.session.findUnique({
        where: { id: sessionId }
      });
    },

    async revokeSession(sessionId) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() }
      });
    },

    async deleteExpiredSessions(now) {
      await prisma.session.deleteMany({
        where: {
          OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }]
        }
      });
    },

    async close() {
      await prisma.$disconnect();
    }
  };
}
