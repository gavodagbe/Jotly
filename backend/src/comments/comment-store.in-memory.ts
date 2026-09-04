import { TaskComment } from "@prisma/client";

import {
  CommentStore,
  TaskCommentCreateInput,
  TaskCommentUpdateInput,
} from "./comment-store";

/**
 * In-memory {@link CommentStore} for tests. Mirrors the Prisma store's ordering
 * (createdAt ascending) and not-found semantics (returns `null`).
 */
export class InMemoryCommentStore implements CommentStore {
  private readonly comments = new Map<string, TaskComment>();
  private idCounter = 1;

  async listByTaskId(taskId: string): Promise<TaskComment[]> {
    return [...this.comments.values()]
      .filter((comment) => comment.taskId === taskId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async getById(id: string): Promise<TaskComment | null> {
    return this.comments.get(id) ?? null;
  }

  async create(input: TaskCommentCreateInput): Promise<TaskComment> {
    const now = new Date();
    const comment: TaskComment = {
      id: `comment-${this.idCounter++}`,
      taskId: input.taskId,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    };

    this.comments.set(comment.id, comment);
    return comment;
  }

  async update(id: string, input: TaskCommentUpdateInput): Promise<TaskComment | null> {
    const existing = this.comments.get(id);

    if (!existing) {
      return null;
    }

    const updated: TaskComment = {
      ...existing,
      body: input.body,
      updatedAt: new Date(),
    };

    this.comments.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<TaskComment | null> {
    const existing = this.comments.get(id);

    if (!existing) {
      return null;
    }

    this.comments.delete(id);
    return existing;
  }
}
