import { CalendarEventNoteAttachment, Prisma, PrismaClient } from "@prisma/client";

export type CalendarEventNoteAttachmentCreateInput = {
  calendarEventNoteId: string;
  userId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
};

export type CalendarEventNoteAttachmentStore = {
  listByNoteId(noteId: string, userId: string): Promise<CalendarEventNoteAttachment[]>;
  getById(id: string, userId: string): Promise<CalendarEventNoteAttachment | null>;
  create(input: CalendarEventNoteAttachmentCreateInput): Promise<CalendarEventNoteAttachment>;
  remove(id: string, userId: string): Promise<CalendarEventNoteAttachment | null>;
  close?: () => Promise<void>;
};

function isNotFoundPrismaError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export function createPrismaCalendarEventNoteAttachmentStore(
  prisma = new PrismaClient()
): CalendarEventNoteAttachmentStore {
  return {
    async listByNoteId(noteId, userId) {
      return prisma.calendarEventNoteAttachment.findMany({
        where: { calendarEventNoteId: noteId, userId },
        orderBy: { createdAt: "asc" },
      });
    },

    async getById(id, userId) {
      return prisma.calendarEventNoteAttachment.findFirst({ where: { id, userId } });
    },

    async create(input) {
      return prisma.calendarEventNoteAttachment.create({ data: input });
    },

    async remove(id, userId) {
      const existing = await prisma.calendarEventNoteAttachment.findFirst({ where: { id, userId } });
      if (!existing) return null;

      try {
        return await prisma.calendarEventNoteAttachment.delete({ where: { id } });
      } catch (error) {
        if (isNotFoundPrismaError(error)) return null;
        throw error;
      }
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
