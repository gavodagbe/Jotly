import { Task, TaskRecurrenceRule, TaskStatus } from "@prisma/client";
import { RecurrenceStore } from "./recurrence-store";
import { TaskCreateInput, TaskStore } from "../tasks/task-store";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
type RecurrenceFrequency = "daily" | "weekly" | "monthly";

function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getDayDiff(startDate: Date, endDate: Date): number {
  return Math.floor((toUtcDateOnly(endDate).getTime() - toUtcDateOnly(startDate).getTime()) / DAY_IN_MS);
}

function startOfWeek(date: Date): Date {
  const normalized = toUtcDateOnly(date);
  normalized.setUTCDate(normalized.getUTCDate() - normalized.getUTCDay());
  return normalized;
}

function getWeekDiff(startDate: Date, endDate: Date): number {
  return Math.floor((startOfWeek(endDate).getTime() - startOfWeek(startDate).getTime()) / (DAY_IN_MS * 7));
}

function getMonthDiff(startDate: Date, endDate: Date): number {
  return (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (endDate.getUTCMonth() - startDate.getUTCMonth());
}

function hasRuleEnded(rule: TaskRecurrenceRule, targetDate: Date): boolean {
  if (!rule.endsOn) {
    return false;
  }

  return toUtcDateOnly(targetDate).getTime() > toUtcDateOnly(rule.endsOn).getTime();
}

function shouldCreateOccurrence(
  startDate: Date,
  targetDate: Date,
  rule: TaskRecurrenceRule
): boolean {
  const start = toUtcDateOnly(startDate);
  const target = toUtcDateOnly(targetDate);

  const diffDays = getDayDiff(start, target);

  if (diffDays < 0) {
    return false;
  }

  if (diffDays === 0) {
    return false;
  }

  if (hasRuleEnded(rule, target)) {
    return false;
  }

  const frequency = rule.frequency as RecurrenceFrequency;

  if (frequency === "daily") {
    return diffDays % rule.interval === 0;
  }

  if (frequency === "weekly") {
    const fallbackWeekday = start.getUTCDay();
    const weekdays = rule.weekdays.length > 0 ? rule.weekdays : [fallbackWeekday];

    if (!weekdays.includes(target.getUTCDay())) {
      return false;
    }

    const diffWeeks = getWeekDiff(start, target);
    return diffWeeks >= 0 && diffWeeks % rule.interval === 0;
  }

  const diffMonths = getMonthDiff(start, target);

  if (diffMonths < 0 || diffMonths % rule.interval !== 0) {
    return false;
  }

  return start.getUTCDate() === target.getUTCDate();
}

function getStatusForGeneratedInstance(): TaskStatus {
  return "todo";
}

function getGeneratedDueDate(task: Task, occurrenceDate: Date): Date | null {
  const normalizedOccurrenceDate = toUtcDateOnly(occurrenceDate);

  if (!task.dueDate) {
    return normalizedOccurrenceDate;
  }

  const dueDateOffsetDays = getDayDiff(task.targetDate, task.dueDate);
  const nextDueDate = new Date(normalizedOccurrenceDate);
  nextDueDate.setUTCDate(nextDueDate.getUTCDate() + dueDateOffsetDays);
  return nextDueDate;
}

function buildGeneratedTaskInput(task: Task, occurrenceDate: Date): TaskCreateInput {
  return {
    userId: task.userId,
    title: task.title,
    description: task.description,
    status: getStatusForGeneratedInstance(),
    targetDate: toUtcDateOnly(occurrenceDate),
    dueDate: getGeneratedDueDate(task, occurrenceDate),
    priority: task.priority,
    project: task.project,
    plannedTime: task.plannedTime,
    recurrenceSourceTaskId: task.id,
    recurrenceOccurrenceDate: toUtcDateOnly(occurrenceDate),
    completedAt: null,
    cancelledAt: null,
  };
}

function isDuplicateTaskOccurrenceError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function materializeRecurringTasksForDate(
  targetDate: Date,
  taskStore: TaskStore,
  recurrenceStore: RecurrenceStore,
  userId: string
): Promise<void> {
  const normalizedDate = toUtcDateOnly(targetDate);
  const existingTasks = await taskStore.listByDate(normalizedDate, userId);

  const existingRecurrenceSources = new Set(
    existingTasks
      .map((task) => task.recurrenceSourceTaskId)
      .filter((sourceTaskId): sourceTaskId is string => typeof sourceTaskId === "string" && sourceTaskId.length > 0)
  );

  const rules = await recurrenceStore.listForDate(normalizedDate, userId);

  for (const rule of rules) {
    const templateTask = await taskStore.getById(rule.taskId, userId);

    if (!templateTask || templateTask.recurrenceSourceTaskId) {
      continue;
    }

    if (existingRecurrenceSources.has(templateTask.id)) {
      continue;
    }

    if (!shouldCreateOccurrence(templateTask.targetDate, normalizedDate, rule)) {
      continue;
    }

    try {
      await taskStore.create(buildGeneratedTaskInput(templateTask, normalizedDate));
    } catch (error) {
      if (isDuplicateTaskOccurrenceError(error)) {
        existingRecurrenceSources.add(templateTask.id);
        continue;
      }

      throw error;
    }

    existingRecurrenceSources.add(templateTask.id);
  }
}
