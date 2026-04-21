"use client";

import { BellIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";
type ReminderStatus = "pending" | "fired" | "completed" | "cancelled";

type Reminder = {
  id: string;
  title: string;
  remindAt: string;
  status: ReminderStatus;
};

const reminderStatusChipClassByStatus: Record<ReminderStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  fired: "bg-rose-50 text-rose-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export type PendingReminderToastsProps = {
  reminders: Reminder[];
  locale: UserLocale;
  activeTimeZone: string | null;
  onComplete: (reminderId: string) => void;
  onCancel: (reminderId: string) => void;
  formatReminderStatus: (status: ReminderStatus, locale: UserLocale) => string;
};

export function PendingReminderToasts({
  reminders,
  locale,
  activeTimeZone,
  onComplete,
  onCancel,
  formatReminderStatus,
}: PendingReminderToastsProps) {
  if (reminders.length === 0) return null;

  const isFrench = locale === "fr";

  return (
    <div className="fixed bottom-24 right-6 z-50 flex max-w-sm flex-col gap-2">
      {reminders.map((reminder) => {
        const remindAtDate = new Date(reminder.remindAt);
        const timeStr = remindAtDate.toLocaleTimeString(isFrench ? "fr-FR" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: activeTimeZone ?? undefined,
        });

        return (
          <div
            key={reminder.id}
            className="animate-scale-in flex items-start gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3 shadow-lg"
          >
            <span className="mt-0.5 shrink-0 text-amber-500">
              <BellIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{reminder.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{timeStr}</span>
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${reminderStatusChipClassByStatus[reminder.status]}`}>
                  {formatReminderStatus(reminder.status, locale)}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
                onClick={() => onComplete(reminder.id)}
              >
                {isFrench ? "Traiter" : "Complete"}
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-surface-soft hover:text-foreground"
                onClick={() => onCancel(reminder.id)}
              >
                {isFrench ? "Annuler" : "Cancel"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
