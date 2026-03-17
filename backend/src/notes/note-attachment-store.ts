import { NoteAttachment, Prisma, PrismaClient } from "@prisma/client";

export type NoteAttachmentCreateInput = {
  noteId: string;
  userId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
};

export type NoteAttachmentStore = {
  listByNoteId(noteId: string, userId: string): Promise<NoteAttachment[]>;
  getById(id: string, userId: string): Promise<NoteAttachment | null>;
  create(input: NoteAttachmentCreateInput): Promise<NoteAttachment>;
  remove(id: string, userId: string): Promise<NoteAttachment | null>;
  close?: () => Promise<void>;
};

function isNotFoundPrismaError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export function createPrismaNoteAttachmentStore(
  prisma = new PrismaClient()
): NoteAttachmentStore {
  return {
    async listByNoteId(noteId, userId) {
      return prisma.noteAttachment.findMany({
        where: { noteId, userId },
        orderBy: { createdAt: "asc" },
      });
    },

    async getById(id, userId) {
      return prisma.noteAttachment.findFirst({ where: { id, userId } });
    },

    async create(input) {
      return prisma.noteAttachment.create({ data: input });
    },

    async remove(id, userId) {
      const existing = await prisma.noteAttachment.findFirst({ where: { id, userId } });
      if (!existing) return null;

      try {
        return await prisma.noteAttachment.delete({ where: { id } });
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
