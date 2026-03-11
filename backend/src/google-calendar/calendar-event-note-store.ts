import { CalendarEventNote, PrismaClient } from "@prisma/client";

export type CalendarEventNoteStore = {
  listByCalendarEventIds(calendarEventIds: string[], userId: string): Promise<CalendarEventNote[]>;
  getByCalendarEventId(calendarEventId: string, userId: string): Promise<CalendarEventNote | null>;
  upsert(calendarEventId: string, userId: string, body: string): Promise<CalendarEventNote>;
  deleteByCalendarEventId(calendarEventId: string, userId: string): Promise<void>;
  close?: () => Promise<void>;
};

export function createPrismaCalendarEventNoteStore(
  prisma = new PrismaClient()
): CalendarEventNoteStore {
  return {
    async listByCalendarEventIds(calendarEventIds, userId) {
      if (calendarEventIds.length === 0) {
        return [];
      }

      return prisma.calendarEventNote.findMany({
        where: {
          userId,
          calendarEventId: {
            in: calendarEventIds,
          },
        },
      });
    },

    async getByCalendarEventId(calendarEventId, userId) {
      return prisma.calendarEventNote.findFirst({
        where: {
          calendarEventId,
          userId,
        },
      });
    },

    async upsert(calendarEventId, userId, body) {
      return prisma.calendarEventNote.upsert({
        where: {
          calendarEventId,
        },
        create: {
          calendarEventId,
          userId,
          body,
        },
        update: {
          body,
        },
      });
    },

    async deleteByCalendarEventId(calendarEventId, userId) {
      await prisma.calendarEventNote.deleteMany({
        where: {
          calendarEventId,
          userId,
        },
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
