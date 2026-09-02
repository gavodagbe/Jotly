import { Task, TaskRecurrenceRule, TaskStatus } from "@prisma/client";
import { RecurrenceStore } from "./recurrence-store";
import { TaskCreateInput, TaskStore } from "../tasks/task-store";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Clamps a day-of-month to the last valid day of the target month (e.g. 31 -> 28 in Feb). */
function clampDayToMonth(day: number, year: number, month: number): number {
  return Math.min(day, getDaysInMonth(year, month));
}

/** Calendar-quarter index: Q1 2026 -> 8104, Q2 2026 -> 8105, … (year * 4 + quarter). */
function getQuarterIndex(date: Date): number {
  return date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3);
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

function hasRuleEnded(rule: Pick<TaskRecurrenceRule, "endsOn">, targetDate: Date): boolean {
  if (!rule.endsOn) {
    return false;
  }

  return toUtcDateOnly(targetDate).getTime() > toUtcDateOnly(rule.endsOn).getTime();
}

/**
 * Whether a recurring task whose source lands on `startDate` should have an
 * instance materialized on `targetDate`. Exported for unit testing.
 */
export function shouldCreateOccurrence(
  startDate: Date,
  targetDate: Date,
  rule: Pick<TaskRecurrenceRule, "frequency" | "interval" | "weekdays" | "endsOn">
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

  if (frequency === "yearly") {
    if (target.getUTCMonth() !== start.getUTCMonth()) {
      return false;
    }

    const diffYears = target.getUTCFullYear() - start.getUTCFullYear();
    if (diffYears <= 0 || diffYears % rule.interval !== 0) {
      return false;
    }

    return (
      target.getUTCDate() ===
      clampDayToMonth(start.getUTCDate(), target.getUTCFullYear(), target.getUTCMonth())
    );
  }

  if (frequency === "quarterly") {
    // Only quarter-start months (Jan / Apr / Jul / Oct).
    if (target.getUTCMonth() % 3 !== 0) {
      return false;
    }

    const diffQuarters = getQuarterIndex(target) - getQuarterIndex(start);
    if (diffQuarters <= 0 || diffQuarters % rule.interval !== 0) {
      return false;
    }

    return (
      target.getUTCDate() ===
      clampDayToMonth(start.getUTCDate(), target.getUTCFullYear(), target.getUTCMonth())
    );
  }

  const diffMonths = getMonthDiff(start, target);

  if (diffMonths <= 0 || diffMonths % rule.interval !== 0) {
    return false;
  }

  return (
    target.getUTCDate() ===
    clampDayToMonth(start.getUTCDate(), target.getUTCFullYear(), target.getUTCMonth())
  );
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
    subProject: task.subProject,
    projectId: task.projectId,
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
