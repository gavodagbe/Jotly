import { Note, PrismaClient } from "@prisma/client";

export type NoteCreateInput = {
  userId: string;
  title?: string | null;
  body: string;
  color?: string | null;
  targetDate?: Date | null;
};

export type NoteUpdateInput = {
  title?: string | null;
  body?: string;
  color?: string | null;
  targetDate?: Date | null;
};

export type NoteListFilters = {
  targetDate?: Date;
};

export type NoteStore = {
  listByUser(userId: string, filters?: NoteListFilters): Promise<Note[]>;
  getById(id: string, userId: string): Promise<Note | null>;
  create(input: NoteCreateInput): Promise<Note>;
  update(id: string, input: NoteUpdateInput, userId: string): Promise<Note | null>;
  remove(id: string, userId: string): Promise<Note | null>;
  close?: () => Promise<void>;
};

export function createPrismaNoteStore(prisma = new PrismaClient()): NoteStore {
  return {
    async listByUser(userId, filters) {
      const where: Record<string, unknown> = { userId };

      if (filters?.targetDate) {
        where.targetDate = filters.targetDate;
      }

      return prisma.note.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    },

    async getById(id, userId) {
      return prisma.note.findFirst({ where: { id, userId } });
    },

    async create(input) {
      return prisma.note.create({
        data: {
          userId: input.userId,
          title: input.title ?? null,
          body: input.body,
          color: input.color ?? null,
          targetDate: input.targetDate ?? null,
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
        },
      });
    },

    async remove(id, userId) {
      const existing = await prisma.note.findFirst({ where: { id, userId } });
      if (!existing) return null;

      return prisma.note.delete({ where: { id } });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
