import {
  CalendarEvent,
  CalendarEventNote,
  DayAffirmation,
  DayBilan,
  PrismaClient,
  Reminder,
} from "@prisma/client";
import { UserProfile } from "../profile/profile-store";

export type AssistantContextSnapshot = {
  profile: UserProfile | null;
  dayAffirmations: DayAffirmation[];
  dayBilans: DayBilan[];
  reminders: Reminder[];
  calendarEvents: CalendarEvent[];
  calendarEventNotes: CalendarEventNote[];
};

export type AssistantOverviewCounts = {
  affirmationCount: number;
  bilanCount: number;
  reminderCount: number;
  eventCount: number;
};

export type AssistantContextStore = {
  /** @deprecated Use domain-specific methods instead. */
  getByUserId(userId: string): Promise<AssistantContextSnapshot>;
  getProfile(userId: string): Promise<UserProfile | null>;
  getAffirmations(userId: string, limit: number): Promise<DayAffirmation[]>;
  getBilans(userId: string, limit: number): Promise<DayBilan[]>;
  getReminders(
    userId: string,
    options: { activeOnly?: boolean; limit: number }
  ): Promise<Reminder[]>;
  getCalendarEvents(
    userId: string,
    limit: number
  ): Promise<(CalendarEvent & { note: string | null })[]>;
  getOverviewCounts(userId: string): Promise<AssistantOverviewCounts>;
  close?: () => Promise<void>;
};

export function createPrismaAssistantContextStore(
  prisma = new PrismaClient()
): AssistantContextStore {
  return {
    async getByUserId(userId) {
      const [profile, dayAffirmations, dayBilans, reminders, calendarEvents, calendarEventNotes] =
        await Promise.all([
          prisma.user.findUnique({
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
          }),
          prisma.dayAffirmation.findMany({
            where: { userId },
            orderBy: { targetDate: "asc" },
          }),
          prisma.dayBilan.findMany({
            where: { userId },
            orderBy: { targetDate: "asc" },
          }),
          prisma.reminder.findMany({
            where: { userId },
            orderBy: { remindAt: "asc" },
          }),
          prisma.calendarEvent.findMany({
            where: {
              userId,
              status: { not: "cancelled" },
            },
            orderBy: { startTime: "asc" },
          }),
          prisma.calendarEventNote.findMany({
            where: { userId },
          }),
        ]);

      return {
        profile,
        dayAffirmations,
        dayBilans,
        reminders,
        calendarEvents,
        calendarEventNotes,
      };
    },

    async getProfile(userId) {
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

    async getAffirmations(userId, limit) {
      return prisma.dayAffirmation.findMany({
        where: { userId },
        orderBy: { targetDate: "desc" },
        take: limit,
      });
    },

    async getBilans(userId, limit) {
      return prisma.dayBilan.findMany({
        where: { userId },
        orderBy: { targetDate: "desc" },
        take: limit,
      });
    },

    async getReminders(userId, options) {
      const where: Record<string, unknown> = { userId };
      if (options.activeOnly) {
        where.isDismissed = false;
      }
      return prisma.reminder.findMany({
        where,
        orderBy: { remindAt: "asc" },
        take: options.limit,
      });
    },

    async getCalendarEvents(userId, limit) {
      const events = await prisma.calendarEvent.findMany({
        where: {
          userId,
          status: { not: "cancelled" },
        },
        orderBy: { startTime: "asc" },
        take: limit,
        include: {
          notes: {
            select: { body: true },
            take: 1,
          },
        },
      });

      return events.map((event) => {
        const { notes, ...rest } = event;
        return { ...rest, note: notes[0]?.body ?? null };
      });
    },

    async getOverviewCounts(userId) {
      const [affirmationCount, bilanCount, reminderCount, eventCount] =
        await Promise.all([
          prisma.dayAffirmation.count({ where: { userId } }),
          prisma.dayBilan.count({ where: { userId } }),
          prisma.reminder.count({ where: { userId } }),
          prisma.calendarEvent.count({
            where: { userId, status: { not: "cancelled" } },
          }),
        ]);

      return { affirmationCount, bilanCount, reminderCount, eventCount };
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
