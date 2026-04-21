"use client";

import { useEffect, useState, type DragEvent as ReactDragEvent } from "react";

import { SectionIdentityPills, getMainContentSectionClass } from "@/components/layout/section-navigation";
import { iconButtonClass, primaryButtonClass, sectionHeaderClass } from "@/components/ui/constants";
import { CollapseChevronIcon, DragHandleIcon, PlusIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";
type ReminderStatus = "pending" | "fired" | "completed" | "cancelled";

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

type RemindersSectionProps = {
  locale: UserLocale;
  activeSectionId: string;
  activeTimeZone: string | null;
  visualOrder: number;
  dropClassName: string;
  isCollapsed: boolean;
  collapsedHintLabel: string;
  reminders: Reminder[];
  isLoadingReminders: boolean;
  reminderErrorMessage: string | null;
  hasReminderDialogMode: boolean;
  dragHandleLabel: string;
  collapseToggleLabel: string;
  onCreateReminder: () => void;
  onEditReminder: (reminder: Reminder) => void;
  onCompleteReminder: (id: string) => void;
  onCancelReminder: (id: string) => void;
  onBlockDragStart: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onBlockDragEnd: () => void;
  onBlockDragOver: (event: ReactDragEvent<HTMLElement>) => void;
  onBlockDrop: (event: ReactDragEvent<HTMLElement>) => void;
  onToggleCollapse: () => void;
  formatReminderStatus: (status: ReminderStatus, locale: UserLocale) => string;
  isReminderResolvedStatus: (status: ReminderStatus) => boolean;
};

const reminderStatusChipClassByStatus: Record<ReminderStatus, string> = {
  pending: "border border-sky-200 bg-sky-50 text-sky-700",
  fired: "border border-amber-200 bg-amber-50 text-amber-700",
  completed: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border border-slate-300 bg-slate-100 text-slate-600",
};

const dashboardIconButtonClass = `${iconButtonClass} h-9 w-9 rounded-xl px-0`;

export function RemindersSection({
  locale,
  activeSectionId,
  activeTimeZone,
  visualOrder,
  dropClassName,
  isCollapsed,
  collapsedHintLabel,
  reminders,
  isLoadingReminders,
  reminderErrorMessage,
  hasReminderDialogMode,
  dragHandleLabel,
  collapseToggleLabel,
  onCreateReminder,
  onEditReminder,
  onCompleteReminder,
  onCancelReminder,
  onBlockDragStart,
  onBlockDragEnd,
  onBlockDragOver,
  onBlockDrop,
  onToggleCollapse,
  formatReminderStatus,
  isReminderResolvedStatus,
}: RemindersSectionProps) {
  const isFrench = locale === "fr";
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section
      id="reminders"
      className={`animate-fade-in-up overflow-hidden rounded-xl bg-gradient-to-br from-amber-50/40 via-surface to-orange-50/30 p-6 shadow-sm ${getMainContentSectionClass("reminders", activeSectionId)} ${dropClassName}`}
      style={{ order: visualOrder, animationDelay: "0.18s" }}
      onDragOver={onBlockDragOver}
      onDrop={onBlockDrop}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionIdentityPills sectionId="reminders" locale={locale} isActive={activeSectionId === "reminders"} />
          <h2 className={sectionHeaderClass}>
            {isFrench ? "Rappels" : "Reminders"}
          </h2>
          <p className="text-sm text-muted">
            {isFrench
              ? "Vos rappels actifs jusqu'a la journee selectionnee."
              : "Your active reminders up to the selected day."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isCollapsed ? (
            <button
              type="button"
              className={primaryButtonClass}
              onClick={onCreateReminder}
              disabled={isLoadingReminders}
            >
              <PlusIcon />
              {isFrench ? "Ajouter" : "Add"}
            </button>
          ) : null}
          <button
            type="button"
            className={dashboardIconButtonClass}
            draggable
            onDragStart={onBlockDragStart}
            onDragEnd={onBlockDragEnd}
            aria-label={dragHandleLabel}
            title={dragHandleLabel}
          >
            <DragHandleIcon />
          </button>
          <button
            type="button"
            className={dashboardIconButtonClass}
            onClick={onToggleCollapse}
            aria-expanded={!isCollapsed}
            aria-label={collapseToggleLabel}
            title={collapseToggleLabel}
          >
            <CollapseChevronIcon isCollapsed={isCollapsed} />
          </button>
        </div>
      </div>

      {isCollapsed ? (
        <p className="mt-3 text-xs text-muted">
          {collapsedHintLabel}{" "}
          {reminders.length === 0
            ? isFrench
              ? "Aucun rappel."
              : "No reminders."
            : isFrench
            ? `${reminders.length} rappel(s).`
            : `${reminders.length} reminder(s).`}
        </p>
      ) : (
        <>
          {isLoadingReminders ? (
            <p className="mt-4 text-sm text-muted">
              {isFrench ? "Chargement..." : "Loading..."}
            </p>
          ) : reminders.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              {isFrench ? "Aucun rappel actif." : "No active reminders."}
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {reminders.map((reminder) => {
                const remindAtDate = new Date(reminder.remindAt);
                const timeStr = remindAtDate.toLocaleTimeString(isFrench ? "fr-FR" : "en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: activeTimeZone ?? undefined,
                });

                return (
                  <li
                    key={reminder.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/60 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {reminder.title}
                        {reminder.project ? (
                          <span className="ml-2 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{reminder.project}</span>
                        ) : null}
                      </p>
                      {reminder.assignees ? (
                        <p className="truncate text-xs text-muted">{reminder.assignees}</p>
                      ) : null}
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{timeStr}</span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${reminderStatusChipClassByStatus[reminder.status]}`}
                        >
                          {formatReminderStatus(reminder.status, locale)}
                        </span>
                        {remindAtDate.getTime() < nowMs ? (
                          <span>{isFrench ? "Echeance depassee" : "Past due"}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!isReminderResolvedStatus(reminder.status) ? (
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs text-accent transition-colors hover:bg-accent-soft"
                          onClick={() => onCompleteReminder(reminder.id)}
                        >
                          {isFrench ? "Traiter" : "Complete"}
                        </button>
                      ) : null}
                      {!isReminderResolvedStatus(reminder.status) ? (
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-surface-soft hover:text-foreground"
                          onClick={() => onCancelReminder(reminder.id)}
                        >
                          {isFrench ? "Annuler" : "Cancel"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
                        onClick={() => onEditReminder(reminder)}
                      >
                        {isFrench ? "Modifier" : "Edit"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {reminderErrorMessage && !hasReminderDialogMode ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {reminderErrorMessage}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
