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

export type AuthPasswordResetToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  usedAt: Date | null;
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

export type CreateAuthPasswordResetTokenInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type AuthStore = {
  createUser(input: CreateAuthUserInput): Promise<AuthUser>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  updateUserPasswordHash?(userId: string, passwordHash: string): Promise<AuthUser | null>;
  createSession(input: CreateAuthSessionInput): Promise<AuthSession>;
  findSessionById?(sessionId: string): Promise<AuthSession | null>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null>;
  revokeSession(sessionId: string): Promise<void>;
  revokeSessionsByUserId?(userId: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<void>;
  createPasswordResetToken?(
    input: CreateAuthPasswordResetTokenInput
  ): Promise<AuthPasswordResetToken>;
  findPasswordResetTokenByTokenHash?(
    tokenHash: string
  ): Promise<AuthPasswordResetToken | null>;
  markPasswordResetTokenUsed?(resetTokenId: string): Promise<void>;
  revokePasswordResetTokensByUserId?(userId: string): Promise<void>;
  deleteExpiredPasswordResetTokens?(now: Date): Promise<void>;
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

    async updateUserPasswordHash(userId, passwordHash) {
      return prisma.user.update({
        where: { id: userId },
        data: { passwordHash }
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

    async revokeSessionsByUserId(userId) {
      await prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });
    },

    async deleteExpiredSessions(now) {
      await prisma.session.deleteMany({
        where: {
          OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }]
        }
      });
    },

    async createPasswordResetToken(input) {
      return prisma.passwordResetToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt
        }
      });
    },

    async findPasswordResetTokenByTokenHash(tokenHash) {
      return prisma.passwordResetToken.findUnique({
        where: { tokenHash }
      });
    },

    async markPasswordResetTokenUsed(resetTokenId) {
      await prisma.passwordResetToken.update({
        where: { id: resetTokenId },
        data: { usedAt: new Date() }
      });
    },

    async revokePasswordResetTokensByUserId(userId) {
      await prisma.passwordResetToken.updateMany({
        where: {
          userId,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });
    },

    async deleteExpiredPasswordResetTokens(now) {
      await prisma.passwordResetToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }]
        }
      });
    },

    async close() {
      await prisma.$disconnect();
    }
  };
}
