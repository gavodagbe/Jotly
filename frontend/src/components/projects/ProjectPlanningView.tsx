"use client";

import { useMemo } from "react";

import { primaryButtonClass } from "@/components/ui/constants";
import { PlusIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";
type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
type TaskPriority = "low" | "medium" | "high";

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

type ProjectPlanningViewProps = {
  locale: UserLocale;
  tasks: Task[];
  isLoading: boolean;
  isBusy: boolean;
  errorMessage: string | null;
  filters: { project: string; status: string; dateFrom: string; dateTo: string };
  sort: { column: string; dir: "asc" | "desc" };
  viewMode: "table" | "gantt";
  projectOptions: string[];
  onFilterChange: (key: "project" | "status" | "dateFrom" | "dateTo", value: string) => void;
  onSortChange: (column: string) => void;
  onViewModeChange: (mode: "table" | "gantt") => void;
  onClose: () => void;
  onCreateTask: () => void;
  onEditTask: (task: Task) => void;
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-600 border border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
  done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled: "bg-red-50 text-red-500 border border-red-100",
};

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
  cancelled: "bg-red-400",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "text-slate-400",
  medium: "text-amber-500",
  high: "text-rose-500",
};

const PRIORITY_BG: Record<TaskPriority, string> = {
  low: "bg-slate-50 text-slate-500 border border-slate-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  high: "bg-rose-50 text-rose-600 border border-rose-200",
};

const GANTT_STATUS_BAR: Record<TaskStatus, { from: string; to: string }> = {
  todo: { from: "from-slate-300", to: "to-slate-400" },
  in_progress: { from: "from-blue-400", to: "to-blue-500" },
  done: { from: "from-emerald-400", to: "to-emerald-500" },
  cancelled: { from: "from-red-300", to: "to-red-400" },
};

function sortTasks(tasks: Task[], column: string, dir: "asc" | "desc"): Task[] {
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case "title": cmp = a.title.localeCompare(b.title); break;
      case "project": cmp = (a.project ?? "").localeCompare(b.project ?? ""); break;
      case "status": cmp = a.status.localeCompare(b.status); break;
      case "priority": {
        const rank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
        cmp = rank[a.priority] - rank[b.priority];
        break;
      }
      case "targetDate": cmp = a.targetDate.localeCompare(b.targetDate); break;
      case "dueDate": cmp = (a.dueDate ?? "").localeCompare(b.dueDate ?? ""); break;
      case "plannedTime": cmp = (a.plannedTime ?? 0) - (b.plannedTime ?? 0); break;
      default: cmp = a.targetDate.localeCompare(b.targetDate);
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function formatMinutes(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function formatShortDate(dateStr: string, locale: UserLocale): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric", month: "short", timeZone: "UTC",
  });
}

export function ProjectPlanningView({
  locale,
  tasks,
  isLoading,
  isBusy,
  errorMessage,
  filters,
  sort,
  viewMode,
  projectOptions,
  onFilterChange,
  onSortChange,
  onViewModeChange,
  onClose,
  onCreateTask,
  onEditTask,
}: ProjectPlanningViewProps) {
  const isFrench = locale === "fr";
  const today = new Date().toISOString().slice(0, 10);

  const sorted = useMemo(() => sortTasks(tasks, sort.column, sort.dir), [tasks, sort]);

  const ganttData = useMemo(() => {
    if (sorted.length === 0) return null;

    const allDates = sorted.flatMap((t) => {
      const dates: string[] = [t.targetDate];
      if (t.dueDate) dates.push(t.dueDate);
      return dates;
    });

    const minDate = allDates.reduce((a, b) => (a < b ? a : b));
    const maxDate = allDates.reduce((a, b) => (a > b ? a : b));

    const start = new Date(minDate + "T00:00:00Z");
    const end = new Date(maxDate + "T00:00:00Z");
    end.setUTCDate(end.getUTCDate() + 1);

    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));

    function dayOffset(dateStr: string): number {
      const d = new Date(dateStr + "T00:00:00Z");
      return Math.round((d.getTime() - start.getTime()) / 86400000);
    }

    const months: { label: string; left: number; width: number }[] = [];
    let cursor = new Date(start);
    while (cursor < end) {
      const monthStart = new Date(cursor);
      const nextMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      const clampedEnd = nextMonth < end ? nextMonth : end;
      const left = ((monthStart.getTime() - start.getTime()) / 86400000 / totalDays) * 100;
      const width = ((clampedEnd.getTime() - monthStart.getTime()) / 86400000 / totalDays) * 100;
      months.push({
        label: monthStart.toLocaleDateString(isFrench ? "fr-FR" : "en-US", { month: "long", year: "numeric" }),
        left,
        width,
      });
      cursor = nextMonth;
    }

    const days: { label: string; left: number; isWeekend: boolean }[] = [];
    if (totalDays <= 60) {
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start);
        d.setUTCDate(d.getUTCDate() + i);
        const dow = d.getUTCDay();
        days.push({
          label: String(d.getUTCDate()),
          left: (i / totalDays) * 100,
          isWeekend: dow === 0 || dow === 6,
        });
      }
    }

    const todayOffset = dayOffset(today);
    const todayLeft = totalDays > 0 ? (todayOffset / totalDays) * 100 : -1;
    const showTodayMarker = todayLeft >= 0 && todayLeft <= 100;

    const bars = sorted.map((task) => {
      const startOffset = dayOffset(task.targetDate);
      const endOffset = task.dueDate ? dayOffset(task.dueDate) + 1 : startOffset + 1;
      const left = (startOffset / totalDays) * 100;
      const width = Math.max(0.8, ((endOffset - startOffset) / totalDays) * 100);
      return { task, left, width };
    });

    return { totalDays, months, days, bars, todayLeft, showTodayMarker };
  }, [sorted, isFrench, today]);

  const statsDone = tasks.filter((t) => t.status === "done").length;
  const statsInProgress = tasks.filter((t) => t.status === "in_progress").length;
  const statsTodo = tasks.filter((t) => t.status === "todo").length;
  const statsCancelled = tasks.filter((t) => t.status === "cancelled").length;
  const totalPlanned = tasks.reduce((s, t) => s + (t.plannedTime ?? 0), 0);
  const completionRate = tasks.length > 0 ? Math.round((statsDone / tasks.length) * 100) : 0;

  const hasActiveFilters = filters.project || filters.status !== "all" || filters.dateFrom || filters.dateTo;

  function SortIcon({ column }: { column: string }) {
    if (sort.column !== column) {
      return (
        <svg viewBox="0 0 10 12" className="ml-1 inline h-2.5 w-2.5 opacity-25" fill="currentColor">
          <path d="M5 1l3 4H2zM5 11l-3-4h6z" />
        </svg>
      );
    }
    return sort.dir === "asc" ? (
      <svg viewBox="0 0 10 6" className="ml-1 inline h-2.5 w-2.5 text-accent" fill="currentColor">
        <path d="M5 0l5 6H0z" />
      </svg>
    ) : (
      <svg viewBox="0 0 10 6" className="ml-1 inline h-2.5 w-2.5 text-accent" fill="currentColor">
        <path d="M5 6L0 0h10z" />
      </svg>
    );
  }

  function formatStatusLabel(status: TaskStatus): string {
    const labels: Record<TaskStatus, { fr: string; en: string }> = {
      todo: { fr: "À faire", en: "To do" },
      in_progress: { fr: "En cours", en: "In progress" },
      done: { fr: "Terminé", en: "Done" },
      cancelled: { fr: "Annulé", en: "Cancelled" },
    };
    return isFrench ? labels[status].fr : labels[status].en;
  }

  function formatPriorityLabel(priority: TaskPriority): string {
    const labels: Record<TaskPriority, { fr: string; en: string }> = {
      low: { fr: "Faible", en: "Low" },
      medium: { fr: "Moyen", en: "Medium" },
      high: { fr: "Élevée", en: "High" },
    };
    return isFrench ? labels[priority].fr : labels[priority].en;
  }

  function PriorityIcon({ priority }: { priority: TaskPriority }) {
    const bars = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
    return (
      <span className={`inline-flex items-end gap-[2px] ${PRIORITY_COLORS[priority]}`}>
        {[1, 2, 3].map((b) => (
          <span
            key={b}
            className={`inline-block w-[3px] rounded-sm ${b <= bars ? "opacity-100" : "opacity-20"}`}
            style={{ height: b === 1 ? "6px" : b === 2 ? "9px" : "12px", backgroundColor: "currentColor" }}
          />
        ))}
      </span>
    );
  }

  const thBase = "cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-foreground";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background lg:pl-[260px]">
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="4" width="16" height="2.5" rx="1"/>
              <rect x="2" y="8.75" width="11" height="2.5" rx="1"/>
              <rect x="2" y="13.5" width="14" height="2.5" rx="1"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {isFrench ? "Planification projet" : "Project Planning"}
            </h2>
            {!isLoading && tasks.length > 0 && (
              <p className="text-[11px] text-muted">
                {tasks.length} {isFrench ? "tâches" : "tasks"} · {completionRate}% {isFrench ? "complétées" : "complete"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line bg-surface-soft p-0.5">
            <button
              type="button"
              title={isFrench ? "Vue tableau" : "Table view"}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === "table"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
              onClick={() => onViewModeChange("table")}
            >
              <svg viewBox="0 0 16 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="14" height="10" rx="1.5"/>
                <path d="M1 4.5h14M1 8h14M5.5 1v10M11 1v10"/>
              </svg>
              <span className="hidden sm:inline">{isFrench ? "Tableau" : "Table"}</span>
            </button>
            <button
              type="button"
              title={isFrench ? "Vue Gantt" : "Gantt view"}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === "gantt"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
              onClick={() => onViewModeChange("gantt")}
            >
              <svg viewBox="0 0 16 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1.5" width="8" height="2" rx="1" fill="currentColor" stroke="none"/>
                <rect x="4" y="5" width="7" height="2" rx="1" fill="currentColor" stroke="none"/>
                <rect x="1" y="8.5" width="11" height="2" rx="1" fill="currentColor" stroke="none"/>
              </svg>
              <span className="hidden sm:inline">Gantt</span>
            </button>
          </div>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={onCreateTask}
            disabled={isBusy}
          >
            <PlusIcon />
            {isFrench ? "Nouvelle tache" : "New Task"}
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
            onClick={onClose}
            aria-label={isFrench ? "Fermer" : "Close"}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {!isLoading && tasks.length > 0 && (
        <div className="shrink-0 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex min-w-[140px] flex-1 items-center gap-3 rounded-xl border border-line bg-surface-soft px-3 py-2.5">
              <div className="relative h-9 w-9 shrink-0">
                <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-line" />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${completionRate * 0.88} 88`}
                    strokeLinecap="round"
                    className="text-emerald-500 transition-all duration-500"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                  {completionRate}%
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{isFrench ? "Avancement" : "Progress"}</p>
                <p className="text-[11px] text-muted">{statsDone}/{tasks.length} {isFrench ? "tâches" : "tasks"}</p>
              </div>
            </div>
            <div className="flex min-w-[100px] flex-1 items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-emerald-700">{statsDone}</p>
                <p className="text-[11px] text-emerald-600">{isFrench ? "Terminées" : "Done"}</p>
              </div>
            </div>
            <div className="flex min-w-[100px] flex-1 items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="8" cy="8" r="5.5"/>
                  <path d="M8 5v3.5l2 1.5" strokeLinecap="round"/>
                </svg>
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-blue-700">{statsInProgress}</p>
                <p className="text-[11px] text-blue-600">{isFrench ? "En cours" : "In progress"}</p>
              </div>
            </div>
            <div className="flex min-w-[100px] flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="10" height="10" rx="2"/>
                </svg>
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-slate-700">{statsTodo}</p>
                <p className="text-[11px] text-slate-500">{isFrench ? "À faire" : "To do"}</p>
              </div>
            </div>
            {totalPlanned > 0 && (
              <div className="flex min-w-[100px] flex-1 items-center gap-2.5 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-violet-600" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="8" cy="8" r="5.5"/>
                    <path d="M8 5v3.5l2.5 1" strokeLinecap="round"/>
                  </svg>
                </span>
                <div>
                  <p className="text-lg font-bold leading-none text-violet-700">{formatMinutes(totalPlanned)}</p>
                  <p className="text-[11px] text-violet-600">{isFrench ? "Planifiées" : "Planned"}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-surface-soft/50 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20">
          <svg viewBox="0 0 14 14" className="h-3 w-3 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="1" y="1" width="5" height="5" rx="1.2"/>
            <rect x="8" y="1" width="5" height="5" rx="1.2"/>
            <rect x="1" y="8" width="5" height="5" rx="1.2"/>
            <rect x="8" y="8" width="5" height="5" rx="1.2"/>
          </svg>
          <select
            className="border-0 bg-transparent text-xs text-foreground outline-none"
            value={filters.project}
            onChange={(event) => onFilterChange("project", event.target.value)}
          >
            <option value="">{isFrench ? "Tous les projets" : "All projects"}</option>
            {projectOptions.map((project) => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          {(["all", "todo", "in_progress", "done", "cancelled"] as const).map((status) => {
            const label = status === "all"
              ? (isFrench ? "Tous" : "All")
              : status === "todo" ? (isFrench ? "À faire" : "To do")
              : status === "in_progress" ? (isFrench ? "En cours" : "In progress")
              : status === "done" ? (isFrench ? "Terminé" : "Done")
              : (isFrench ? "Annulé" : "Cancelled");
            const isActive = filters.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onFilterChange("status", status)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                  isActive
                    ? "bg-accent text-white shadow-sm"
                    : "bg-surface border border-line text-muted hover:border-accent/30 hover:text-foreground"
                }`}
              >
                {status !== "all" && (
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white/80" : STATUS_DOT[status]}`} />
                )}
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 focus-within:border-accent/50">
          <svg viewBox="0 0 14 14" className="h-3 w-3 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="1" y="2" width="12" height="11" rx="1.5"/>
            <path d="M1 5.5h12M4.5 1v3M9.5 1v3"/>
          </svg>
          <input
            type="date"
            className="border-0 bg-transparent text-xs text-foreground outline-none"
            value={filters.dateFrom}
            onChange={(event) => onFilterChange("dateFrom", event.target.value)}
          />
          <span className="text-xs text-muted">→</span>
          <input
            type="date"
            className="border-0 bg-transparent text-xs text-foreground outline-none"
            value={filters.dateTo}
            onChange={(event) => onFilterChange("dateTo", event.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20"
            onClick={() => {
              onFilterChange("project", "");
              onFilterChange("status", "all");
              onFilterChange("dateFrom", "");
              onFilterChange("dateTo", "");
            }}
          >
            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 2l6 6M8 2L2 8" strokeLinecap="round"/>
            </svg>
            {isFrench ? "Effacer" : "Clear"}
          </button>
        )}

        <span className="ml-auto text-[11px] text-muted">
          {sorted.length} {isFrench ? "résultat" : "result"}{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-6 py-3.5">
                <div className="h-3 w-4 animate-pulse rounded bg-line" />
                <div className="h-3 flex-1 animate-pulse rounded bg-line" style={{ animationDelay: `${index * 80}ms` }} />
                <div className="h-3 w-16 animate-pulse rounded bg-line" style={{ animationDelay: `${index * 80 + 40}ms` }} />
                <div className="h-5 w-20 animate-pulse rounded-full bg-line" style={{ animationDelay: `${index * 80 + 80}ms` }} />
                <div className="h-3 w-20 animate-pulse rounded bg-line" />
              </div>
            ))}
          </div>
        ) : errorMessage ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
              <svg viewBox="0 0 24 24" className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
              </svg>
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-soft">
              <svg viewBox="0 0 48 48" className="h-8 w-8 text-muted/40" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="8" y="8" width="32" height="32" rx="4"/>
                <path d="M16 20h16M16 26h10M16 32h13" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{isFrench ? "Aucune tâche trouvée" : "No tasks found"}</p>
              <p className="mt-1 text-xs text-muted">
                {hasActiveFilters
                  ? (isFrench ? "Essayez d'ajuster vos filtres." : "Try adjusting your filters.")
                  : (isFrench ? "Les tâches apparaîtront ici." : "Tasks will appear here.")}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/30 hover:text-accent"
                onClick={() => {
                  onFilterChange("project", "");
                  onFilterChange("status", "all");
                  onFilterChange("dateFrom", "");
                  onFilterChange("dateTo", "");
                }}
              >
                {isFrench ? "Réinitialiser les filtres" : "Reset filters"}
              </button>
            )}
          </div>
        ) : viewMode === "table" ? (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-surface shadow-[0_1px_0_0_var(--color-line)]">
              <tr>
                <th className="w-10 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">#</th>
                <th className={thBase} onClick={() => onSortChange("title")}>
                  {isFrench ? "Titre" : "Title"}<SortIcon column="title" />
                </th>
                <th className={thBase} onClick={() => onSortChange("project")}>
                  {isFrench ? "Projet" : "Project"}<SortIcon column="project" />
                </th>
                <th className={thBase} onClick={() => onSortChange("status")}>
                  {isFrench ? "Statut" : "Status"}<SortIcon column="status" />
                </th>
                <th className={thBase} onClick={() => onSortChange("priority")}>
                  {isFrench ? "Priorité" : "Priority"}<SortIcon column="priority" />
                </th>
                <th className={thBase} onClick={() => onSortChange("targetDate")}>
                  {isFrench ? "Planifiée" : "Planned"}<SortIcon column="targetDate" />
                </th>
                <th className={thBase} onClick={() => onSortChange("dueDate")}>
                  {isFrench ? "Échéance" : "Due"}<SortIcon column="dueDate" />
                </th>
                <th className={thBase} onClick={() => onSortChange("plannedTime")}>
                  {isFrench ? "Durée" : "Duration"}<SortIcon column="plannedTime" />
                </th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((task, index) => {
                const isDone = task.status === "done";
                const isOverdue = task.dueDate && task.dueDate < today && task.status !== "done" && task.status !== "cancelled";
                return (
                  <tr
                    key={task.id}
                    className={`group cursor-pointer border-b border-line transition-colors hover:bg-accent/[0.03] ${
                      index % 2 === 0 ? "bg-background" : "bg-surface-soft/30"
                    }`}
                    onClick={() => onEditTask(task)}
                  >
                    <td className="w-10 px-4 py-3.5 text-center text-xs text-muted/40 tabular-nums">
                      {index + 1}
                    </td>
                    <td className="max-w-[260px] px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[task.status]}`} />
                        <span className={`line-clamp-1 text-sm font-medium ${isDone ? "text-muted line-through decoration-muted/40" : "text-foreground"}`}>
                          {task.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {task.project ? (
                        <span className="rounded-md bg-accent/8 px-2 py-0.5 text-xs font-medium text-accent">
                          {task.project}
                        </span>
                      ) : (
                        <span className="text-xs text-muted/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
                        {formatStatusLabel(task.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_BG[task.priority]}`}>
                        <PriorityIcon priority={task.priority} />
                        {formatPriorityLabel(task.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted">
                      {formatShortDate(task.targetDate, locale)}
                    </td>
                    <td className="px-4 py-3.5">
                      {task.dueDate ? (
                        <span className={`text-xs font-medium ${isOverdue ? "text-rose-500" : "text-muted"}`}>
                          {isOverdue && (
                            <svg viewBox="0 0 10 10" className="mr-1 inline h-2.5 w-2.5 text-rose-400" fill="currentColor">
                              <path d="M5 1l4 8H1z"/>
                            </svg>
                          )}
                          {formatShortDate(task.dueDate, locale)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted">
                      {formatMinutes(task.plannedTime)}
                    </td>
                    <td className="w-16 px-4 py-3.5">
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-muted opacity-0 ring-1 ring-transparent transition-all hover:bg-accent-soft hover:text-accent hover:ring-accent/20 group-hover:opacity-100"
                        onClick={(event) => { event.stopPropagation(); onEditTask(task); }}
                      >
                        {isFrench ? "Ouvrir" : "Open"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          ganttData ? (
            <div className="flex h-full min-w-[700px]">
              <div className="flex w-52 shrink-0 flex-col border-r border-line bg-surface">
                <div className="h-[52px] border-b border-line" />
                {ganttData.bars.map(({ task }, index) => (
                  <div
                    key={task.id}
                    className={`flex h-12 cursor-pointer items-center gap-2 border-b border-line px-3 transition-colors hover:bg-accent/[0.04] ${
                      index % 2 === 0 ? "bg-background" : "bg-surface-soft/30"
                    }`}
                    onClick={() => onEditTask(task)}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[task.status]}`} />
                    <span className="min-w-0 truncate text-xs font-medium text-foreground" title={task.title}>
                      {task.title}
                    </span>
                  </div>
                ))}
                <div className="mt-auto border-t border-line px-3 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {isFrench ? "Légende" : "Legend"}
                  </p>
                  {(["todo", "in_progress", "done", "cancelled"] as TaskStatus[]).map((status) => (
                    <div key={status} className="flex items-center gap-2 py-0.5">
                      <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_DOT[status]}`} />
                      <span className="text-[11px] text-muted">{formatStatusLabel(status)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="relative" style={{ minWidth: "600px" }}>
                  <div className="sticky top-0 z-10 h-[52px] border-b border-line bg-surface">
                    <div className="relative h-full">
                      {ganttData.months.map((month, index) => (
                        <div
                          key={index}
                          className="absolute flex h-full flex-col justify-center border-r border-line/50 px-3"
                          style={{ left: `${month.left}%`, width: `${month.width}%` }}
                        >
                          <span className="truncate text-xs font-semibold text-foreground">{month.label}</span>
                          {ganttData.days.length === 0 && (
                            <span className="text-[10px] text-muted">{isFrench ? "vue mensuelle" : "monthly view"}</span>
                          )}
                        </div>
                      ))}
                      {ganttData.days.length > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 flex h-5 border-t border-line/30">
                          {ganttData.days.map((day, index) => (
                            <div
                              key={index}
                              className={`absolute flex h-full items-center justify-center text-[9px] ${
                                day.isWeekend ? "text-muted/40" : "text-muted/70"
                              }`}
                              style={{ left: `${day.left}%`, width: `${100 / ganttData.totalDays}%` }}
                            >
                              {day.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {ganttData.bars.map(({ task, left, width }, index) => (
                    <div
                      key={task.id}
                      className={`relative h-12 border-b border-line ${
                        index % 2 === 0 ? "bg-background" : "bg-surface-soft/30"
                      }`}
                    >
                      {ganttData.days.map((day, dayIndex) =>
                        day.isWeekend ? (
                          <div
                            key={dayIndex}
                            className="absolute inset-y-0 bg-slate-50/60"
                            style={{ left: `${day.left}%`, width: `${100 / ganttData.totalDays}%` }}
                          />
                        ) : null
                      )}
                      {ganttData.months.map((month, monthIndex) => (
                        <div
                          key={monthIndex}
                          className="absolute inset-y-0 w-px bg-line/50"
                          style={{ left: `${month.left}%` }}
                        />
                      ))}
                      {ganttData.showTodayMarker && (
                        <div
                          className="absolute inset-y-0 z-10 w-0.5 bg-rose-400/70"
                          style={{ left: `${ganttData.todayLeft}%` }}
                        />
                      )}
                      <div
                        className={`absolute top-2 h-8 cursor-pointer rounded-md bg-gradient-to-r transition-all hover:brightness-95 hover:shadow-md ${GANTT_STATUS_BAR[task.status].from} ${GANTT_STATUS_BAR[task.status].to}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${task.title} · ${formatShortDate(task.targetDate, locale)}${task.dueDate ? ` → ${formatShortDate(task.dueDate, locale)}` : ""}`}
                        onClick={() => onEditTask(task)}
                      >
                        {width > 4 && (
                          <span className="absolute inset-0 flex items-center truncate px-2 text-[10px] font-semibold text-white/95 drop-shadow-sm">
                            {task.title}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {ganttData.showTodayMarker && (
                    <div
                      className="sticky bottom-0 z-20"
                      style={{ marginLeft: `${ganttData.todayLeft}%` }}
                    >
                      <span className="rounded-sm bg-rose-400 px-1 py-0.5 text-[9px] font-bold text-white">
                        {isFrench ? "Auj." : "Today"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null
        )}
      </div>

      {!isLoading && statsCancelled > 0 && (
        <div className="shrink-0 border-t border-line bg-surface px-6 py-2">
          <p className="text-[11px] text-muted">
            + {statsCancelled} {isFrench ? "tâche(s) annulée(s) non affichée(s) dans le Gantt" : "cancelled task(s)"}
          </p>
        </div>
      )}
    </div>
  );
}
