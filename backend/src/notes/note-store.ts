import { CalendarEvent, Note, Prisma, PrismaClient } from "@prisma/client";

export type StoredNoteCalendarEvent = Pick<
  CalendarEvent,
  "id" | "title" | "startTime" | "endTime" | "htmlLink"
>;

export type StoredNote = Note & {
  calendarEvent: StoredNoteCalendarEvent | null;
};

export type NoteCreateInput = {
  userId: string;
  title?: string | null;
  body: string;
  color?: string | null;
  targetDate?: Date | null;
  calendarEventId?: string | null;
};

export type NoteUpdateInput = {
  title?: string | null;
  body?: string;
  color?: string | null;
  targetDate?: Date | null;
  calendarEventId?: string | null;
};

export type NoteListFilters = {
  targetDate?: Date;
};

const calendarEventSelection = {
  id: true,
  title: true,
  startTime: true,
  endTime: true,
  htmlLink: true,
} as const;

export type NoteStore = {
  listByUser(userId: string, filters?: NoteListFilters): Promise<StoredNote[]>;
  listByCalendarEventIds(calendarEventIds: string[], userId: string): Promise<StoredNote[]>;
  getById(id: string, userId: string): Promise<StoredNote | null>;
  getByCalendarEventId(calendarEventId: string, userId: string): Promise<StoredNote | null>;
  create(input: NoteCreateInput): Promise<StoredNote>;
  update(id: string, input: NoteUpdateInput, userId: string): Promise<StoredNote | null>;
  remove(id: string, userId: string): Promise<StoredNote | null>;
  close?: () => Promise<void>;
};

export function createPrismaNoteStore(prisma = new PrismaClient()): NoteStore {
  return {
    async listByUser(userId, filters) {
      const where: Prisma.NoteWhereInput = { userId };

      if (filters?.targetDate) {
        const startOfDay = filters.targetDate;
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        where.OR = [
          { targetDate: startOfDay },
          { calendarEvent: { startTime: { gte: startOfDay, lt: endOfDay } } },
        ];
      }

      return prisma.note.findMany({
        where,
        include: {
          calendarEvent: {
            select: calendarEventSelection,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    },

    async listByCalendarEventIds(calendarEventIds, userId) {
      if (calendarEventIds.length === 0) {
        return [];
      }

      return prisma.note.findMany({
        where: {
          userId,
          calendarEventId: {
            in: calendarEventIds,
          },
        },
        include: {
          calendarEvent: {
            select: calendarEventSelection,
          },
        },
      });
    },

    async getById(id, userId) {
      return prisma.note.findFirst({
        where: { id, userId },
        include: {
          calendarEvent: {
            select: calendarEventSelection,
          },
        },
      });
    },

    async getByCalendarEventId(calendarEventId, userId) {
      return prisma.note.findFirst({
        where: {
          calendarEventId,
          userId,
        },
        include: {
          calendarEvent: {
            select: calendarEventSelection,
          },
        },
      });
    },

    async create(input) {
      return prisma.note.create({
        data: {
          userId: input.userId,
          title: input.title ?? null,
          body: input.body,
          color: input.color ?? null,
          targetDate: input.targetDate ?? null,
          calendarEventId: input.calendarEventId ?? null,
        },
        include: {
          calendarEvent: {
            select: calendarEventSelection,
          },
        },
      });
    },

    async update(id, input, userId) {
      const existing = await prisma.note.findFirst({ where: { id, userId } });
      if (!existing) return null;

      return prisma.note.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
          ...(input.calendarEventId !== undefined ? { calendarEventId: input.calendarEventId } : {}),
        },
        include: {
          calendarEvent: {
            select: calendarEventSelection,
          },
        },
      });
    },

    async remove(id, userId) {
      const existing = await prisma.note.findFirst({ where: { id, userId } });
      if (!existing) return null;

      return prisma.note.delete({
        where: { id },
        include: {
          calendarEvent: {
            select: calendarEventSelection,
          },
        },
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
