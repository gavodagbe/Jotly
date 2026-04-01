import { CalendarEvent, Prisma, PrismaClient } from "@prisma/client";

export type CalendarEventUpsertInput = {
  userId: string;
  connectionId: string;
  googleEventId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  htmlLink: string | null;
  attendees: string | null;
  organizer: string | null;
  recurringEventId: string | null;
};

export type CalendarEventStore = {
  listByDate(date: Date, userId: string, timeZone?: string | null): Promise<CalendarEvent[]>;
  listByDateRange(
    startDate: Date,
    endDate: Date,
    userId: string,
    timeZone?: string | null
  ): Promise<CalendarEvent[]>;
  getById(id: string, userId: string): Promise<CalendarEvent | null>;
  getByGoogleEventId(
    googleEventId: string,
    userId: string,
    connectionId: string
  ): Promise<CalendarEvent | null>;
  upsertFromGoogle(input: CalendarEventUpsertInput): Promise<CalendarEvent>;
  markCancelled(
    googleEventId: string,
    userId: string,
    connectionId: string
  ): Promise<CalendarEvent | null>;
  deleteMissingForConnection?(
    connectionId: string,
    userId: string,
    activeGoogleEventIds: string[]
  ): Promise<void>;
  deleteByConnectionId(connectionId: string): Promise<void>;
  close?: () => Promise<void>;
};

function getUtcDateRange(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function addUtcDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function normalizeTimeZone(timeZone?: string | null): string | null {
  if (!timeZone || timeZone.trim() === "") {
    return null;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return null;
  }
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = getFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const rawHour = Number(values.hour);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(values.minute);
  const second = Number(values.second);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - date.getTime();
}

function toUtcDateTimeForTimeZone(
  year: number,
  month: number,
  day: number,
  timeZone: string
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const initialOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const adjustedGuess = utcGuess - initialOffset;
  const adjustedOffset = getTimeZoneOffsetMs(new Date(adjustedGuess), timeZone);
  return new Date(utcGuess - adjustedOffset);
}

export function getTimedEventRangeForDate(
  date: Date,
  timeZone?: string | null
): { start: Date; end: Date } {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  if (!normalizedTimeZone) {
    return getUtcDateRange(date);
  }

  const endDate = addUtcDays(date, 1);
  return {
    start: toUtcDateTimeForTimeZone(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      normalizedTimeZone
    ),
    end: toUtcDateTimeForTimeZone(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth() + 1,
      endDate.getUTCDate(),
      normalizedTimeZone
    ),
  };
}

export function getTimedEventRangeForDateSpan(
  startDate: Date,
  endDate: Date,
  timeZone?: string | null
): { start: Date; end: Date } {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  if (!normalizedTimeZone) {
    return {
      start: new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())),
      end: new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate())),
    };
  }

  return {
    start: toUtcDateTimeForTimeZone(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth() + 1,
      startDate.getUTCDate(),
      normalizedTimeZone
    ),
    end: toUtcDateTimeForTimeZone(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth() + 1,
      endDate.getUTCDate(),
      normalizedTimeZone
    ),
  };
}

export function createPrismaCalendarEventStore(
  prisma = new PrismaClient()
): CalendarEventStore {
  return {
    async listByDate(date, userId, timeZone) {
      const timedRange = getTimedEventRangeForDate(date, timeZone);
      return prisma.calendarEvent.findMany({
        where: {
          userId,
          OR: [
            // Timed events that overlap with this day
            {
              isAllDay: false,
              startTime: { lt: timedRange.end },
              endTime: { gt: timedRange.start },
            },
            // All-day events that include this day
            {
              isAllDay: true,
              startDate: { lte: date },
              endDate: { gt: date },
            },
          ],
          status: { not: "cancelled" },
        },
        orderBy: [{ isAllDay: "desc" }, { startTime: "asc" }],
      });
    },

    async listByDateRange(startDate, endDate, userId, timeZone) {
      const timedRange = getTimedEventRangeForDateSpan(startDate, endDate, timeZone);
      return prisma.calendarEvent.findMany({
        where: {
          userId,
          OR: [
            {
              isAllDay: false,
              startTime: { lt: timedRange.end },
              endTime: { gt: timedRange.start },
            },
            {
              isAllDay: true,
              startDate: { lt: endDate },
              endDate: { gt: startDate },
            },
          ],
          status: { not: "cancelled" },
        },
        orderBy: [{ startTime: "asc" }],
      });
    },

    async getById(id, userId) {
      return prisma.calendarEvent.findFirst({
        where: { id, userId },
      });
    },

    async getByGoogleEventId(googleEventId, userId, connectionId) {
      return prisma.calendarEvent.findUnique({
        where: {
          connectionId_googleEventId: { connectionId, googleEventId },
        },
      });
    },

    async upsertFromGoogle(input) {
      return prisma.calendarEvent.upsert({
        where: {
          connectionId_googleEventId: {
            connectionId: input.connectionId,
            googleEventId: input.googleEventId,
          },
        },
        create: {
          userId: input.userId,
          connectionId: input.connectionId,
          googleEventId: input.googleEventId,
          title: input.title,
          description: input.description,
          location: input.location,
          startTime: input.startTime,
          endTime: input.endTime,
          isAllDay: input.isAllDay,
          startDate: input.startDate,
          endDate: input.endDate,
          status: input.status,
          htmlLink: input.htmlLink,
          attendees: input.attendees,
          organizer: input.organizer,
          recurringEventId: input.recurringEventId,
          syncedAt: new Date(),
        },
        update: {
          title: input.title,
          description: input.description,
          location: input.location,
          startTime: input.startTime,
          endTime: input.endTime,
          isAllDay: input.isAllDay,
          startDate: input.startDate,
          endDate: input.endDate,
          status: input.status,
          htmlLink: input.htmlLink,
          attendees: input.attendees,
          organizer: input.organizer,
          recurringEventId: input.recurringEventId,
          syncedAt: new Date(),
        },
      });
    },

    async markCancelled(googleEventId, userId, connectionId) {
      try {
        return await prisma.calendarEvent.update({
          where: {
            connectionId_googleEventId: { connectionId, googleEventId },
          },
          data: { status: "cancelled" },
        });
      } catch {
        return null;
      }
    },

    async deleteMissingForConnection(connectionId, userId, activeGoogleEventIds) {
      // Find internal IDs of events that have linked notes — these must be preserved
      // even if they fall outside the current sync window, to avoid breaking note links.
      const notesWithLinkedEvents = await prisma.note.findMany({
        where: {
          userId,
          calendarEventId: { not: null },
          calendarEvent: { connectionId },
        },
        select: { calendarEventId: true },
      });
      const preservedEventIds = notesWithLinkedEvents
        .map((n) => n.calendarEventId)
        .filter((id): id is string => id !== null);

      const baseWhere: Prisma.CalendarEventWhereInput =
        activeGoogleEventIds.length > 0
          ? { connectionId, userId, googleEventId: { notIn: activeGoogleEventIds } }
          : { connectionId, userId };

      await prisma.calendarEvent.deleteMany({
        where:
          preservedEventIds.length > 0
            ? { ...baseWhere, id: { notIn: preservedEventIds } }
            : baseWhere,
      });
    },

    async deleteByConnectionId(connectionId) {
      await prisma.calendarEvent.deleteMany({
        where: { connectionId },
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
