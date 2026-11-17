/** Types shared by the task board components. */
export type UserLocale = "en" | "fr";
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type TaskFilterStatus = TaskStatus | "all";
export type TaskFilterPriority = TaskPriority | "all";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: string;
  dueDate: string | null;
  priority: TaskPriority;
  project: string | null;
  subProject?: string | null;
  assignees: string | null;
  plannedTime: number | null;
  rolledFromTaskId: string | null;
  recurrenceSourceTaskId: string | null;
  recurrenceOccurrenceDate: string | null;
  calendarEventId: string | null;
};

export type TaskFilterValues = {
  query: string;
  status: TaskFilterStatus;
  priority: TaskFilterPriority;
  project: string;
  subProject: string;
};

export type BoardColumn = {
  status: TaskStatus;
  label: string;
  emptyLabel: string;
};

export type PriorityOption = {
  value: TaskPriority;
  label: string;
};
