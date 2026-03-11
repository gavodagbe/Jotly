import { GoogleCalendarConnection, PrismaClient } from "@prisma/client";

export type GoogleCalendarConnectionUpsertInput = {
  userId: string;
  googleAccountEmail: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  calendarId?: string;
  color?: string;
};

export type GoogleCalendarConnectionStore = {
  listByUserId(userId: string): Promise<GoogleCalendarConnection[]>;
  getById(connectionId: string): Promise<GoogleCalendarConnection | null>;
  getByUserAndEmail(userId: string, email: string): Promise<GoogleCalendarConnection | null>;
  upsertConnection(input: GoogleCalendarConnectionUpsertInput): Promise<GoogleCalendarConnection>;
  deleteById(connectionId: string): Promise<void>;
  updateTokens(
    connectionId: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: Date
  ): Promise<GoogleCalendarConnection | null>;
  updateSyncToken(
    connectionId: string,
    syncToken: string,
    syncedAt: Date
  ): Promise<GoogleCalendarConnection | null>;
  updateColor(
    connectionId: string,
    color: string
  ): Promise<GoogleCalendarConnection | null>;
  updateCalendarId(
    connectionId: string,
    calendarId: string
  ): Promise<GoogleCalendarConnection | null>;
  close?: () => Promise<void>;
};

export function createPrismaGoogleCalendarConnectionStore(
  prisma = new PrismaClient()
): GoogleCalendarConnectionStore {
  return {
    async listByUserId(userId) {
      return prisma.googleCalendarConnection.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
    },

    async getById(connectionId) {
      return prisma.googleCalendarConnection.findUnique({
        where: { id: connectionId },
      });
    },

    async getByUserAndEmail(userId, email) {
      return prisma.googleCalendarConnection.findUnique({
        where: {
          userId_googleAccountEmail: { userId, googleAccountEmail: email },
        },
      });
    },

    async upsertConnection(input) {
      return prisma.googleCalendarConnection.upsert({
        where: {
          userId_googleAccountEmail: {
            userId: input.userId,
            googleAccountEmail: input.googleAccountEmail,
          },
        },
        create: {
          userId: input.userId,
          googleAccountEmail: input.googleAccountEmail,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          tokenExpiresAt: input.tokenExpiresAt,
          calendarId: input.calendarId ?? "primary",
          ...(input.color ? { color: input.color } : {}),
        },
        update: {
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          tokenExpiresAt: input.tokenExpiresAt,
        },
      });
    },

    async deleteById(connectionId) {
      await prisma.googleCalendarConnection.delete({
        where: { id: connectionId },
      }).catch(() => {
        // Ignore if already deleted
      });
    },

    async updateTokens(connectionId, accessToken, refreshToken, tokenExpiresAt) {
      try {
        return await prisma.googleCalendarConnection.update({
          where: { id: connectionId },
          data: { accessToken, refreshToken, tokenExpiresAt },
        });
      } catch {
        return null;
      }
    },

    async updateSyncToken(connectionId, syncToken, syncedAt) {
      try {
        return await prisma.googleCalendarConnection.update({
          where: { id: connectionId },
          data: { lastSyncToken: syncToken, lastSyncedAt: syncedAt },
        });
      } catch {
        return null;
      }
    },

    async updateColor(connectionId, color) {
      try {
        return await prisma.googleCalendarConnection.update({
          where: { id: connectionId },
          data: { color },
        });
      } catch {
        return null;
      }
    },

    async updateCalendarId(connectionId, calendarId) {
      try {
        return await prisma.googleCalendarConnection.update({
          where: { id: connectionId },
          data: { calendarId, lastSyncToken: null, lastSyncedAt: null },
        });
      } catch {
        return null;
      }
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
