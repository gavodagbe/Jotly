export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type ReminderStatus = "pending" | "fired" | "completed" | "cancelled";
export type AlertUrgency = "overdue" | "today" | "tomorrow";
export type UserLocale = "en" | "fr";

export type AuthMode = "login" | "register" | "forgot_password" | "reset_password";

export type AuthFormValues = {
  email: string;
  password: string;
  displayName: string;
  resetToken: string;
};

export type SearchSourceType =
  | "task"
  | "comment"
  | "affirmation"
  | "bilan"
  | "reminder"
  | "calendarEvent"
  | "calendarNote"
  | "attachment"
  | "note"
  | "noteAttachment"
  | "weeklyObjective"
  | "weeklyReview"
  | "monthlyObjective"
  | "monthlyReview";

export type SearchResult = {
  sourceType: SearchSourceType;
  sourceId: string;
  title: string | null;
  snippet: string;
  score: number;
  matchedBy: "fulltext" | "vector";
  metadataJson: Record<string, unknown> | null;
  updatedAt: string;
};

export type GlobalSearchState = {
  query: string;
  results: SearchResult[];
  totalCount: number;
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  typeFilter: SearchSourceType | "all";
  from: string;
  to: string;
  recentResults: SearchResult[];
  isLoadingRecent: boolean;
};
