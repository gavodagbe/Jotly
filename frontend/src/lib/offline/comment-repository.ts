/**
 * Task comment data access used by the app (same signatures as the former
 * functions in app-shell.tsx), offline-capable.
 */
import { deleteTaskCommentRequest, fetchTaskComments, postTaskComment } from "../api/comments-api";
import type { TaskComment } from "../api/comment-types";
import { replaceMatching } from "./local-store";
import { queueLocally, refreshFromServer, writeThrough } from "./repository-helpers";
import { createClientId, getOfflineSession } from "./session";

export async function loadTaskComments(taskId: string, token: string): Promise<TaskComment[]> {
  const session = getOfflineSession();
  if (!session) return fetchTaskComments(taskId, token);
  await refreshFromServer(async () => {
    const serverComments = await fetchTaskComments(taskId, token);
    await replaceMatching(session.db, session.db.comments, (comment) => comment.taskId === taskId, serverComments);
  });
  const local = await session.db.comments.where("taskId").equals(taskId).toArray();
  return local.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function createTaskComment(taskId: string, body: string, token: string): Promise<TaskComment> {
  const session = getOfflineSession();
  if (!session) return postTaskComment(taskId, body, token);
  const id = createClientId();
  return writeThrough(
    session,
    async () => {
      const comment = await postTaskComment(taskId, body, token, id);
      await session.db.comments.put(comment);
      return comment;
    },
    async () => {
      const now = new Date().toISOString();
      const local: TaskComment = { id, taskId, body, createdAt: now, updatedAt: now };
      await session.db.comments.put(local);
      await queueLocally(session, { kind: "comment.create", entityId: id, payload: { taskId, body } });
      return local;
    }
  );
}

export async function deleteTaskComment(taskId: string, commentId: string, token: string): Promise<void> {
  const session = getOfflineSession();
  if (!session) return deleteTaskCommentRequest(taskId, commentId, token);
  return writeThrough(
    session,
    async () => {
      await deleteTaskCommentRequest(taskId, commentId, token);
      await session.db.comments.delete(commentId);
    },
    async () => {
      await session.db.comments.delete(commentId);
      await queueLocally(session, { kind: "comment.delete", entityId: commentId, payload: { taskId } });
    }
  );
}
