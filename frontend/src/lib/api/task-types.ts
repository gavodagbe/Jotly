export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

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
  projectId?: string | null;
  assignees: string | null;
  plannedTime: number | null;
  rolledFromTaskId: string | null;
  recurrenceSourceTaskId: string | null;
  recurrenceOccurrenceDate: string | null;
  calendarEventId: string | null;
  autoCancelIfUntouched?: boolean;
  /** Server version stamp; absent on tasks created offline and not yet synced. */
  updatedAt?: string;
  createdAt?: string;
};

export type TaskMutationInput = {
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: string;
  dueDate: string;
  priority: TaskPriority;
  project: string | null;
  projectId?: string | null;
  assignees: string | null;
  plannedTime: number | null;
  calendarEventId?: string | null;
  autoCancelIfUntouched: boolean;
};

/** Any subset of the editable fields, as sent by PATCH /tasks/:id. */
export type TaskPatch = Partial<TaskMutationInput>;

export type TaskListFilters = { project?: string; status?: string; dateFrom?: string; dateTo?: string };

export type TaskTimeEntriesPayload = {
  date: string;
  total: number;
  entries: Array<{ taskId: string; fraction: number }>;
};

export type TaskTimeEntrySavePayload = {
  taskId: string;
  date: string;
  fraction: number;
  dayTotal: number;
};
