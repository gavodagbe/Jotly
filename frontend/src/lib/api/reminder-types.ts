export type ReminderStatus = "pending" | "fired" | "completed" | "cancelled";

export type Reminder = {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
  subProject?: string | null;
  projectId?: string | null;
  assignees: string | null;
  remindAt: string;
  status: ReminderStatus;
  isFired: boolean;
  firedAt: string | null;
  isDismissed: boolean;
  dismissedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReminderCreateInput = {
  title: string;
  description?: string | null;
  project?: string | null;
  projectId?: string | null;
  assignees?: string | null;
  remindAt: string;
};

export type ReminderPatch = Partial<ReminderCreateInput>;

export type ReminderAction = "complete" | "cancel";
