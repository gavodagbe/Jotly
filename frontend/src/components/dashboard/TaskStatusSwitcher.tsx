"use client";

import type { BoardColumn, TaskStatus } from "./task-board-types";

type TaskStatusSwitcherProps = {
  isFrench: boolean;
  columns: ReadonlyArray<BoardColumn>;
  counts: Record<TaskStatus, number>;
  activeStatus: TaskStatus;
  onChange: (status: TaskStatus) => void;
};

/** Segmented control choosing which status column the board shows below lg. */
export function TaskStatusSwitcher({ isFrench, columns, counts, activeStatus, onChange }: TaskStatusSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label={isFrench ? "Statut affiché" : "Shown status"}
      className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-surface-soft p-1 lg:hidden"
    >
      {columns.map((column) => {
        const isActive = column.status === activeStatus;
        return (
          <button
            key={column.status}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(column.status)}
            className={`flex min-h-11 flex-col items-center justify-center rounded-lg px-1 py-1 text-[11px] font-medium leading-tight transition-colors ${
              isActive ? "bg-surface text-foreground shadow-sm" : "text-muted"
            }`}
          >
            <span className="truncate">{column.label}</span>
            <span className={`text-xs font-semibold ${isActive ? "text-accent" : ""}`}>{counts[column.status] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
