"use client";

import { useState } from "react";
import { ArchiveIcon, CloseIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";
type TaskPriority = "low" | "medium" | "high";

type TriageTask = {
  id: string;
  title: string;
  project: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  targetDate: string;
  daysOverdue: number;
};

const priorityChipClassByPriority: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-500",
  medium: "bg-amber-50 text-amber-600",
  high: "bg-red-50 text-red-600",
};

export type TaskTriagePanelProps = {
  isOpen: boolean;
  locale: UserLocale;
  anchorDate: string;
  tasks: TriageTask[];
  isLoading: boolean;
  errorMessage: string | null;
  pendingTaskId: string | null;
  onClose: () => void;
  onReschedule: (task: TriageTask, nextDate: string) => void;
  onTransferToday: (task: TriageTask) => void;
  onComplete: (task: TriageTask) => void;
  onCancelTask: (task: TriageTask) => void;
  formatPriority: (priority: TaskPriority, locale: UserLocale) => string;
};

export function TaskTriagePanel({
  isOpen,
  locale,
  anchorDate,
  tasks,
  isLoading,
  errorMessage,
  pendingTaskId,
  onClose,
  onReschedule,
  onTransferToday,
  onComplete,
  onCancelTask,
  formatPriority,
}: TaskTriagePanelProps) {
  const [draftDateByTaskId, setDraftDateByTaskId] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const isFrench = locale === "fr";

  return (
    <section className="animate-scale-in fixed bottom-24 left-4 right-4 z-40 flex max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:left-auto sm:right-6 sm:w-[400px]">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600">
            <ArchiveIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isFrench ? "À trier" : "Needs triage"}
            </p>
            <p className="text-[11px] text-muted">
              {isFrench
                ? "Tâches en retard de plus de 14 jours"
                : "Tasks overdue by more than 14 days"}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
          onClick={onClose}
          aria-label={isFrench ? "Fermer le triage" : "Close triage"}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <p className="rounded-xl border border-line bg-surface-soft px-3 py-2 text-sm text-muted">
            {isFrench ? "Chargement..." : "Loading..."}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {errorMessage}
          </p>
        ) : null}

        {!isLoading && !errorMessage && tasks.length === 0 ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {isFrench ? "Rien à trier pour le moment." : "Nothing to triage right now."}
          </p>
        ) : null}

        {!isLoading && !errorMessage
          ? tasks.map((task) => {
              const draftDate = draftDateByTaskId[task.id] ?? "";
              const isPending = pendingTaskId === task.id;

              return (
                <article
                  key={task.id}
                  className="rounded-2xl border border-line bg-surface-soft/60 px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {isFrench
                          ? `${task.daysOverdue} jours de retard`
                          : `${task.daysOverdue} days overdue`}
                        {task.project ? ` · ${task.project}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${priorityChipClassByPriority[task.priority]}`}>
                      {formatPriority(task.priority, locale)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      className="rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft/70 disabled:opacity-50"
                      disabled={isPending || task.targetDate === anchorDate}
                      onClick={() => onTransferToday(task)}
                    >
                      {isFrench ? "Transférer aujourd'hui" : "Move to today"}
                    </button>
                    <input
                      type="date"
                      value={draftDate}
                      onChange={(event) =>
                        setDraftDateByTaskId((current) => ({ ...current, [task.id]: event.target.value }))
                      }
                      className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-foreground"
                      aria-label={isFrench ? "Nouvelle date" : "New date"}
                      disabled={isPending}
                    />
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
                      disabled={isPending || !draftDate}
                      onClick={() => onReschedule(task, draftDate)}
                    >
                      {isFrench ? "Reporter" : "Reschedule"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                      disabled={isPending}
                      onClick={() => onComplete(task)}
                    >
                      {isFrench ? "Terminer" : "Complete"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
                      disabled={isPending}
                      onClick={() => onCancelTask(task)}
                    >
                      {isFrench ? "Annuler" : "Cancel"}
                    </button>
                  </div>
                </article>
              );
            })
          : null}
      </div>
    </section>
  );
}
