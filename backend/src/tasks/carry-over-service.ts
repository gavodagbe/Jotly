import type { Task } from "@prisma/client";
import { TaskStore } from "./task-store";
import {
  getCarryOverDueDate,
  getPreviousDate,
  isUniqueConstraintError,
  shouldCarryOverTask,
} from "./task-route-helpers";

/** Yesterday's open, non-recurring tasks that would be copied onto `targetDate`. */
export async function listCarryOverCandidates(
  taskStore: Pick<TaskStore, "listByDate">,
  userId: string,
  targetDate: Date
): Promise<Task[]> {
  const yesterdayTasks = await taskStore.listByDate(getPreviousDate(targetDate), userId);
  return yesterdayTasks.filter(shouldCarryOverTask);
}

/**
 * Copies yesterday's open tasks onto `targetDate`. Tasks already carried over
 * (unique constraint on the copy) are skipped, so the operation is idempotent.
 */
export async function carryOverYesterdayTasks(
  taskStore: Pick<TaskStore, "listByDate" | "create">,
  userId: string,
  targetDate: Date
): Promise<{ createdTasks: Task[]; skippedCount: number }> {
  const candidates = await listCarryOverCandidates(taskStore, userId, targetDate);
  const createdTasks: Task[] = [];
  let skippedCount = 0;

  for (const sourceTask of candidates) {
    try {
      createdTasks.push(
        await taskStore.create({
          userId,
          rolledFromTaskId: sourceTask.id,
          title: sourceTask.title,
          description: sourceTask.description,
          status: sourceTask.status,
          targetDate,
          dueDate: getCarryOverDueDate(sourceTask, targetDate),
          priority: sourceTask.priority,
          project: sourceTask.project,
          subProject: sourceTask.subProject,
          projectId: sourceTask.projectId,
          plannedTime: sourceTask.plannedTime,
          recurrenceSourceTaskId: null,
          recurrenceOccurrenceDate: null,
          completedAt: null,
          cancelledAt: null,
        })
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        skippedCount += 1;
        continue;
      }
      throw error;
    }
  }

  return { createdTasks, skippedCount };
}
