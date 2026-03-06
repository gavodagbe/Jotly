import { Prisma, PrismaClient, TaskAttachment } from "@prisma/client";

export type TaskAttachmentCreateInput = {
  taskId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
};

export type AttachmentStore = {
  listByTaskId(taskId: string): Promise<TaskAttachment[]>;
  getById(id: string): Promise<TaskAttachment | null>;
  create(input: TaskAttachmentCreateInput): Promise<TaskAttachment>;
  remove(id: string): Promise<TaskAttachment | null>;
  close?: () => Promise<void>;
};

function isNotFoundPrismaError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export function createPrismaAttachmentStore(prisma = new PrismaClient()): AttachmentStore {
  return {
    async listByTaskId(taskId) {
      return prisma.taskAttachment.findMany({
        where: { taskId },
        orderBy: { createdAt: "asc" },
      });
    },

    async getById(id) {
      return prisma.taskAttachment.findUnique({
        where: { id },
      });
    },

    async create(input) {
      return prisma.taskAttachment.create({
        data: input,
      });
    },

    async remove(id) {
      try {
        return await prisma.taskAttachment.delete({
          where: { id },
        });
      } catch (error) {
        if (isNotFoundPrismaError(error)) {
          return null;
        }

        throw error;
      }
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
