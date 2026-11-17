/** Raw network calls for task comments, moved out of app-shell.tsx. */
import type { TaskComment } from "./comment-types";
import { apiRequest, requireData } from "./http";

const commentsPath = (taskId: string) => `/tasks/${encodeURIComponent(taskId)}/comments`;

export async function fetchTaskComments(taskId: string, token: string): Promise<TaskComment[]> {
  const data = await apiRequest<TaskComment[]>(commentsPath(taskId), { method: "GET", token }, "Unable to load comments");
  return data ?? [];
}

export async function postTaskComment(taskId: string, body: string, token: string, id?: string): Promise<TaskComment> {
  const data = await apiRequest<TaskComment>(
    commentsPath(taskId),
    { method: "POST", token, body: id ? { id, body } : { body } },
    "Unable to create comment"
  );
  return requireData(data, "Unable to create comment");
}

export async function deleteTaskCommentRequest(taskId: string, commentId: string, token: string): Promise<void> {
  await apiRequest<TaskComment>(
    `${commentsPath(taskId)}/${encodeURIComponent(commentId)}`,
    { method: "DELETE", token },
    "Unable to delete comment"
  );
}
