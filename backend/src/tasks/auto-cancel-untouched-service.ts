import { Task } from "@prisma/client";

import { CommentStore } from "../comments/comment-store";
import { TaskStore } from "./task-store";

type Locale = "en" | "fr";

export type AutoCancelUntouchedResult = {
  cancelledCount: number;
  tasks: Task[];
};

function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildAutoCancelCommentBody(targetDate: Date, locale: Locale): string {
  const label = toUtcDateOnly(targetDate).toISOString().slice(0, 10);

  return locale === "fr"
    ? `Tâche annulée automatiquement : toujours « À faire » à la fin de la journée du ${label}.`
    : `Task cancelled automatically: still "To do" at the end of ${label}.`;
}

/**
 * Cancels every task that was never acted on (`status === "todo"`) whose day is
 * already past, when its auto-cancel flag is effectively on.
 *
 * For a recurrence instance the flag is read from its **source task**, so ticking
 * the box on a recurring task retroactively closes the instances it already
 * generated. Standalone tasks use their own flag.
 *
 * `in_progress` / `done` / `cancelled` tasks and tasks dated today or later are
 * left untouched. Each cancellation records a best-effort history comment.
 */
export async function autoCancelUntouchedTasks(params: {
  taskStore: TaskStore;
  commentStore?: CommentStore;
  userId: string;
  today: Date;
  locale?: Locale;
}): Promise<AutoCancelUntouchedResult> {
  const { taskStore, commentStore, userId, today, locale = "en" } = params;
  const todayStart = toUtcDateOnly(today).getTime();

  const allTasks = await taskStore.listByUser(userId);
  const pastTodoTasks = allTasks.filter(
    (task) =>
      task.status === "todo" && toUtcDateOnly(task.targetDate).getTime() < todayStart
  );

  if (pastTodoTasks.length === 0) {
    return { cancelledCount: 0, tasks: [] };
  }

  const tasksById = new Map(allTasks.map((task) => [task.id, task]));

  const isEffectivelyFlagged = (task: Task): boolean => {
    if (task.recurrenceSourceTaskId) {
      return tasksById.get(task.recurrenceSourceTaskId)?.autoCancelIfUntouched ?? false;
    }

    return task.autoCancelIfUntouched;
  };

  const now = new Date();
  const cancelled: Task[] = [];

  for (const task of pastTodoTasks) {
    if (!isEffectivelyFlagged(task)) {
      continue;
    }

    const updated = await taskStore.update(
      task.id,
      { status: "cancelled", cancelledAt: now, completedAt: null },
      userId
    );

    if (!updated) {
      continue;
    }

    cancelled.push(updated);

    if (commentStore) {
      try {
        await commentStore.create({
          taskId: task.id,
          body: buildAutoCancelCommentBody(task.targetDate, locale),
        });
      } catch {
        // History comment is best-effort; the cancellation already succeeded.
      }
    }
  }

  return { cancelledCount: cancelled.length, tasks: cancelled };
}
