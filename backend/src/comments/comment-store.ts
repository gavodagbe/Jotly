import { Prisma, PrismaClient, TaskComment } from "@prisma/client";

export type TaskCommentCreateInput = {
  taskId: string;
  body: string;
};

export type TaskCommentUpdateInput = {
  body: string;
};

export type CommentStore = {
  listByTaskId(taskId: string): Promise<TaskComment[]>;
  getById(id: string): Promise<TaskComment | null>;
  create(input: TaskCommentCreateInput): Promise<TaskComment>;
  update(id: string, input: TaskCommentUpdateInput): Promise<TaskComment | null>;
  remove(id: string): Promise<TaskComment | null>;
  close?: () => Promise<void>;
};

function isNotFoundPrismaError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export function createPrismaCommentStore(prisma = new PrismaClient()): CommentStore {
  return {
    async listByTaskId(taskId) {
      return prisma.taskComment.findMany({
        where: { taskId },
        orderBy: { createdAt: "asc" },
      });
    },

    async getById(id) {
      return prisma.taskComment.findUnique({
        where: { id },
      });
    },

    async create(input) {
      return prisma.taskComment.create({
        data: input,
      });
    },

    async update(id, input) {
      try {
        return await prisma.taskComment.update({
          where: { id },
          data: input,
        });
      } catch (error) {
        if (isNotFoundPrismaError(error)) {
          return null;
        }

        throw error;
      }
    },

    async remove(id) {
      try {
        return await prisma.taskComment.delete({
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
