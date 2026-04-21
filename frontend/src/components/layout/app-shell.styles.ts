import type { AlertUrgency, ReminderStatus, TaskPriority, TaskStatus } from "./app-shell.types";

export const statusChipClassByStatus: Record<TaskStatus, string> = {
  todo: "border-[#c3c0ff] bg-[#f2efff] text-[#3323cc]",
  in_progress: "border-[#d3bbff] bg-[#f5edff] text-[#581db3]",
  done: "border-[#cfe8a8] bg-[#edf8d6] text-[#304f00]",
  cancelled: "border-[#c7c4d8] bg-[#f2efff] text-[#464555]",
};

export const statusColumnClassByStatus: Record<TaskStatus, string> = {
  todo: "border-t-[#4f46e5]",
  in_progress: "border-t-[#8856e5]",
  done: "border-t-[#91db2a]",
  cancelled: "border-t-[#c7c4d8]",
};

export const statusDropClassByStatus: Record<TaskStatus, string> = {
  todo: "bg-[#ece8ff]/80",
  in_progress: "bg-[#f2e9ff]/80",
  done: "bg-[#edf8d6]/80",
  cancelled: "bg-[#f2efff]/80",
};

export const priorityChipClassByPriority: Record<TaskPriority, string> = {
  low: "border border-[#c7c4d8] bg-[#f2efff] text-[#464555]",
  medium: "border border-[#c3c0ff] bg-[#f2efff] text-[#3323cc]",
  high: "border border-red-200 bg-red-50 text-red-700",
};

export const reminderStatusChipClassByStatus: Record<ReminderStatus, string> = {
  pending: "border border-[#c3c0ff] bg-[#f2efff] text-[#3323cc]",
  fired: "border border-[#d3bbff] bg-[#f5edff] text-[#581db3]",
  completed: "border border-[#cfe8a8] bg-[#edf8d6] text-[#304f00]",
  cancelled: "border border-[#c7c4d8] bg-[#f2efff] text-[#464555]",
};

export const alertUrgencyChipClassByUrgency: Record<AlertUrgency, string> = {
  overdue: "border border-rose-200 bg-rose-50 text-rose-700",
  today: "border border-[#d3bbff] bg-[#f5edff] text-[#581db3]",
  tomorrow: "border border-[#c3c0ff] bg-[#f2efff] text-[#3323cc]",
};

export const alertSourceChipClassByType: Record<"task" | "reminder", string> = {
  task: "border border-[#c3c0ff] bg-[#f2efff] text-[#3323cc]",
  reminder: "border border-[#d3bbff] bg-[#f5edff] text-[#581db3]",
};

export const controlButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-surface-elevated px-4 py-2.5 text-sm font-semibold text-foreground/80 shadow-[0_10px_24px_rgba(16,0,105,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";
export const primaryButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-accent to-accent-strong px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(53,37,205,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50";
export const dangerButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 shadow-[0_10px_24px_rgba(213,79,84,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50";
export const textFieldClass =
  "mt-1 w-full rounded-2xl border border-line bg-surface-elevated px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] outline-none transition-all duration-200 placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15 focus:shadow-[0_0_0_4px_rgba(53,37,205,0.12)] disabled:cursor-not-allowed disabled:opacity-50";
export const boardFilterFieldClass = `${textFieldClass} h-11 py-0`;
export const sectionHeaderClass = "text-[11px] font-semibold uppercase tracking-[0.24em] text-muted";
export const iconButtonClass =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-2xl border border-transparent bg-transparent text-muted transition-all duration-200 hover:border-line hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";
export const controlIconButtonClass = `${controlButtonClass} h-9 w-9 px-0`;
export const dashboardSectionClass = "animate-fade-in-up app-panel rounded-[28px] p-6";
export const dashboardInsetPanelClass = "app-panel-soft rounded-[24px] p-4";
export const dashboardMetricCardClass = "metric-card flex items-center gap-4 rounded-[24px] p-4";
export const segmentedControlClass = "segmented-surface inline-flex items-center gap-1 rounded-full p-1.5";
export const toolbarSurfaceClass = "toolbar-surface rounded-[22px] px-4 py-3";
export const kanbanColumnShellClass = "kanban-column-shell flex h-[520px] flex-col rounded-[28px] border-t-4 px-3.5 py-3.5 xl:h-[620px]";
export const dashboardEmptyStateClass = `${dashboardInsetPanelClass} text-sm text-muted`;
export const reflectionPanelClass = "dialog-section-shell rounded-[24px] p-4";
export const reflectionMetaCardClass = "dialog-section-shell rounded-[24px] p-4 text-sm";
export const reflectionBadgeClass = "rounded-full border border-accent/10 bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent";
export const dialogOverlayClass = "animate-fade-in dialog-overlay-shell fixed inset-0 z-50 flex items-center justify-center p-4";
export const dialogShellClass = "animate-scale-in dialog-shell w-full rounded-[32px] p-5 shadow-2xl sm:p-6";
export const dialogSectionClass = "dialog-section-shell rounded-[24px] p-4";
export const floatingPanelClass = "animate-scale-in floating-panel-shell fixed inset-x-4 bottom-24 top-20 z-40 flex flex-col overflow-hidden rounded-[30px] max-sm:inset-0 max-sm:rounded-none sm:inset-x-auto sm:top-auto sm:right-6";
export const workspaceShellClass = "workspace-shell fixed inset-0 z-40 flex flex-col lg:pl-[260px]";
export const workspaceHeaderClass = "workspace-header-shell flex shrink-0 items-center justify-between px-4 py-4 sm:px-6";
export const workspaceStatCardClass = "workspace-stat-card flex min-w-[100px] flex-1 items-center gap-2.5 rounded-[22px] px-3 py-3";
export const workspaceFilterBarClass = "workspace-filter-shell flex shrink-0 flex-wrap items-center gap-2 px-4 py-3 sm:px-6";
