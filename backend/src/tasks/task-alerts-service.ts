import type { Task } from "@prisma/client";
import { formatDateOnly, TaskStore } from "./task-store";
import {
  addUtcDays,
  compareDueSoonTasks,
  isTaskDueSoonStatus,
  STALE_THRESHOLD_DAYS,
} from "./task-route-helpers";

export type TaskAlerts = {
  tasks: Task[];
  dueTodayCount: number;
  dueTomorrowCount: number;
};

/** Open tasks due between STALE_THRESHOLD_DAYS before `anchorDate` and tomorrow, most urgent first. */
export async function listTaskAlerts(
  taskStore: Pick<TaskStore, "listByUser">,
  userId: string,
  anchorDate: Date
): Promise<TaskAlerts> {
  const tomorrowDate = addUtcDays(anchorDate, 1);
  const endExclusive = addUtcDays(anchorDate, 2);
  const startInclusive = addUtcDays(anchorDate, -STALE_THRESHOLD_DAYS);

  const tasks = (await taskStore.listByUser(userId))
    .filter(
      (task) =>
        task.dueDate !== null &&
        isTaskDueSoonStatus(task.status) &&
        task.dueDate.getTime() >= startInclusive.getTime() &&
        task.dueDate.getTime() < endExclusive.getTime()
    )
    .sort(compareDueSoonTasks);

  const isDueOn = (task: Task, date: Date) =>
    task.dueDate !== null && formatDateOnly(task.dueDate) === formatDateOnly(date);

  return {
    tasks,
    dueTodayCount: tasks.filter((task) => isDueOn(task, anchorDate)).length,
    dueTomorrowCount: tasks.filter((task) => isDueOn(task, tomorrowDate)).length,
  };
}
