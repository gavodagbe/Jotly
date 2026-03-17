import { ReminderAttachment, Prisma, PrismaClient } from "@prisma/client";

export type ReminderAttachmentCreateInput = {
  reminderId: string;
  userId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
};

export type ReminderAttachmentStore = {
  listByReminderId(reminderId: string, userId: string): Promise<ReminderAttachment[]>;
  getById(id: string, userId: string): Promise<ReminderAttachment | null>;
  create(input: ReminderAttachmentCreateInput): Promise<ReminderAttachment>;
  remove(id: string, userId: string): Promise<ReminderAttachment | null>;
  close?: () => Promise<void>;
};

function isNotFoundPrismaError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export function createPrismaReminderAttachmentStore(
  prisma = new PrismaClient()
): ReminderAttachmentStore {
  return {
    async listByReminderId(reminderId, userId) {
      return prisma.reminderAttachment.findMany({
        where: { reminderId, userId },
        orderBy: { createdAt: "asc" },
      });
    },

    async getById(id, userId) {
      return prisma.reminderAttachment.findFirst({ where: { id, userId } });
    },

    async create(input) {
      return prisma.reminderAttachment.create({ data: input });
    },

    async remove(id, userId) {
      const existing = await prisma.reminderAttachment.findFirst({ where: { id, userId } });
      if (!existing) return null;

      try {
        return await prisma.reminderAttachment.delete({ where: { id } });
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
