"use client";

import { BellIcon, CloseIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";
type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
type TaskPriority = "low" | "medium" | "high";
type ReminderStatus = "pending" | "fired" | "completed" | "cancelled";
type AlertUrgency = "overdue" | "today" | "tomorrow";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: string;
  dueDate: string | null;
  priority: TaskPriority;
  project: string | null;
  assignees: string | null;
  plannedTime: number | null;
  rolledFromTaskId: string | null;
  recurrenceSourceTaskId: string | null;
  recurrenceOccurrenceDate: string | null;
  calendarEventId: string | null;
};

type Reminder = {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
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

type AlertsSummary = {
  count: number;
  overdueCount: number;
  todayCount: number;
  tomorrowCount: number;
};

type AlertPanelItem =
  | {
      sourceType: "task";
      urgency: AlertUrgency;
      sortValue: number;
      task: Task;
    }
  | {
      sourceType: "reminder";
      urgency: AlertUrgency;
      sortValue: number;
      reminder: Reminder;
    };

const priorityChipClassByPriority: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-500",
  medium: "bg-amber-50 text-amber-600",
  high: "bg-red-50 text-red-600",
};

const reminderStatusChipClassByStatus: Record<ReminderStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  fired: "bg-rose-50 text-rose-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const alertUrgencyChipClassByUrgency: Record<AlertUrgency, string> = {
  overdue: "bg-red-50 text-red-700",
  today: "bg-amber-50 text-amber-700",
  tomorrow: "bg-sky-50 text-sky-700",
};

const alertSourceChipClassByType: Record<AlertPanelItem["sourceType"], string> = {
  task: "border border-indigo-200 bg-indigo-50 text-indigo-700",
  reminder: "border border-teal-200 bg-teal-50 text-teal-700",
};

export type TaskAlertsPanelProps = {
  isOpen: boolean;
  locale: UserLocale;
  activeTimeZone: string | null;
  summary: AlertsSummary;
  items: AlertPanelItem[];
  isLoading: boolean;
  errorMessage: string | null;
  anchorDate: string;
  onClose: () => void;
  onTaskClick: (task: Task) => void;
  onReminderClick: (reminder: Reminder) => void;
  onCompleteReminder: (reminderId: string) => void;
  onCancelReminder: (reminderId: string) => void;
  formatDateOnlyForLocale: (value: string, locale: UserLocale) => string;
  formatDateTime: (value: string, locale: UserLocale, timeZone: string | null) => string;
  formatDateInputForTimeZone: (date: Date, timeZone?: string | null) => string;
  formatTaskAlertDueLabel: (value: string, todayValue: string, locale: UserLocale) => string;
  formatAlertUrgencyLabel: (urgency: AlertUrgency, locale: UserLocale) => string;
  formatAlertSourceLabel: (sourceType: AlertPanelItem["sourceType"], locale: UserLocale) => string;
  formatPriority: (priority: TaskPriority, locale: UserLocale) => string;
  formatReminderStatus: (status: ReminderStatus, locale: UserLocale) => string;
};

export function TaskAlertsPanel({
  isOpen,
  locale,
  activeTimeZone,
  summary,
  items,
  isLoading,
  errorMessage,
  anchorDate,
  onClose,
  onTaskClick,
  onReminderClick,
  onCompleteReminder,
  onCancelReminder,
  formatDateOnlyForLocale,
  formatDateTime,
  formatDateInputForTimeZone,
  formatTaskAlertDueLabel,
  formatAlertUrgencyLabel,
  formatAlertSourceLabel,
  formatPriority,
  formatReminderStatus,
}: TaskAlertsPanelProps) {
  if (!isOpen) return null;

  const isFrench = locale === "fr";

  return (
    <section className="animate-scale-in fixed bottom-24 left-4 right-4 z-40 flex max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:left-auto sm:right-6 sm:w-[380px]">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-700">
            <BellIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isFrench ? "Alertes" : "Alerts"}
            </p>
            <p className="text-[11px] text-muted">
              {summary.count > 0
                ? isFrench
                  ? `${summary.overdueCount} en retard · ${summary.todayCount} aujourd'hui · ${summary.tomorrowCount} demain`
                  : `${summary.overdueCount} overdue · ${summary.todayCount} today · ${summary.tomorrowCount} tomorrow`
                : isFrench
                  ? "Rappels et echeances non resolus"
                  : "Unresolved reminders and due dates"}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
          onClick={onClose}
          aria-label={isFrench ? "Fermer les alertes" : "Close alerts"}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <p className="rounded-xl border border-line bg-surface-soft px-3 py-2 text-sm text-muted">
            {isFrench ? "Chargement des alertes..." : "Loading alerts..."}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {errorMessage}
          </p>
        ) : null}

        {!isLoading && !errorMessage && items.length
          ? items.map((item) =>
              item.sourceType === "task" ? (
                <button
                  key={item.task.id}
                  type="button"
                  className="w-full rounded-2xl border border-line bg-surface-soft/60 px-3.5 py-3 text-left transition-colors hover:border-accent/30 hover:bg-surface-soft"
                  onClick={() => onTaskClick(item.task)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${alertSourceChipClassByType.task}`}>
                          {formatAlertSourceLabel("task", locale)}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${alertUrgencyChipClassByUrgency[item.urgency]}`}>
                          {formatAlertUrgencyLabel(item.urgency, locale)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-foreground">{item.task.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {item.task.dueDate
                          ? `${formatDateOnlyForLocale(item.task.dueDate, locale)}`
                          : isFrench
                            ? "Aucune date d'echeance"
                            : "No due date"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        {isFrench ? "Planifiee" : "Scheduled"} {formatDateOnlyForLocale(item.task.targetDate, locale)}
                        {item.task.project ? ` · ${item.task.project}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${priorityChipClassByPriority[item.task.priority]}`}>
                      {formatPriority(item.task.priority, locale)}
                    </span>
                  </div>
                </button>
              ) : (
                <article
                  key={item.reminder.id}
                  className="rounded-2xl border border-line bg-surface-soft/60 px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onReminderClick(item.reminder)}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${alertSourceChipClassByType.reminder}`}>
                          {formatAlertSourceLabel("reminder", locale)}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${alertUrgencyChipClassByUrgency[item.urgency]}`}>
                          {formatAlertUrgencyLabel(item.urgency, locale)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-foreground">{item.reminder.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {`${formatTaskAlertDueLabel(
                          formatDateInputForTimeZone(new Date(item.reminder.remindAt), activeTimeZone),
                          anchorDate,
                          locale
                        )} · ${formatDateTime(item.reminder.remindAt, locale, activeTimeZone)}`}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        {[item.reminder.project, item.reminder.assignees].filter(Boolean).join(" · ") ||
                          (isFrench ? "Rappel actif" : "Active reminder")}
                      </p>
                    </button>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${reminderStatusChipClassByStatus[item.reminder.status]}`}>
                      {formatReminderStatus(item.reminder.status, locale)}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end gap-1.5">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
                      onClick={() => onCompleteReminder(item.reminder.id)}
                    >
                      {isFrench ? "Traiter" : "Complete"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-surface hover:text-foreground"
                      onClick={() => onCancelReminder(item.reminder.id)}
                    >
                      {isFrench ? "Annuler" : "Cancel"}
                    </button>
                  </div>
                </article>
              )
            )
          : null}

        {!isLoading && !errorMessage && items.length === 0 ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {isFrench
              ? "Aucune alerte active en retard, aujourd'hui ou demain."
              : "No active alerts overdue, today, or tomorrow."}
          </p>
        ) : null}
      </div>
    </section>
  );
}
