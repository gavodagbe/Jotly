"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

import { RichTextContent } from "@/components/ui/RichTextEditor";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";

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

const statusDropClassByStatus: Record<TaskStatus, string> = {
  todo: "bg-sky-100/70",
  in_progress: "bg-amber-100/70",
  done: "bg-emerald-100/70",
  cancelled: "bg-slate-200/70",
};

const priorityChipClassByPriority: Record<TaskPriority, string> = {
  low: "border border-slate-300 bg-slate-100 text-slate-700",
  medium: "border border-indigo-200 bg-indigo-50 text-indigo-700",
  high: "border border-rose-200 bg-rose-50 text-rose-700",
};

type TaskCardProps = {
  locale: UserLocale;
  task: Task;
  isDragging: boolean;
  isSaving: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  formatPriority: (priority: TaskPriority, locale: UserLocale) => string;
  formatDateOnlyForLocale: (value: string, locale: UserLocale) => string;
  formatPlannedTime: (totalMinutes: number) => string;
};

export function TaskCard({
  locale,
  task,
  isDragging,
  isSaving,
  onEdit,
  onDelete,
  formatPriority,
  formatDateOnlyForLocale,
  formatPlannedTime,
}: TaskCardProps) {
  const isFrench = locale === "fr";
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    disabled: isSaving,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl bg-surface px-4 py-3.5 shadow-sm transition-all duration-200 ${
        isDragging ? "scale-[0.97] opacity-70 shadow-lg ring-2 ring-accent/20" : "hover:-translate-y-0.5 hover:shadow-md"
      } ${isSaving ? "cursor-wait opacity-80" : "cursor-grab active:cursor-grabbing"}`}
      aria-busy={isSaving}
      {...attributes}
      {...listeners}
    >
      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${
        task.priority === "high" ? "bg-red-400" : task.priority === "medium" ? "bg-indigo-400" : "bg-slate-300"
      }`} />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground">{task.title}</h3>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onEdit(task)}
            disabled={isSaving}
            aria-label={isFrench ? "Modifier la tache" : "Edit task"}
            title={isFrench ? "Modifier la tache" : "Edit task"}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-red-50 hover:text-red-500"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onDelete(task)}
            disabled={isSaving}
            aria-label={isFrench ? "Supprimer la tache" : "Delete task"}
            title={isFrench ? "Supprimer la tache" : "Delete task"}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {task.description ? (
        <RichTextContent
          value={task.description}
          className="rich-text-render mt-1.5 pl-2 text-[13px] leading-5 text-muted"
        />
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-2">
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${priorityChipClassByPriority[task.priority]}`}
        >
          {formatPriority(task.priority, locale)}
        </span>
        {task.dueDate ? (
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
            {isFrench ? "Echeance" : "Due"} {formatDateOnlyForLocale(task.dueDate, locale)}
          </span>
        ) : null}
        {task.project ? (
          <span className="rounded-md bg-surface-soft px-2 py-0.5 text-[11px] text-muted">
            {task.project}
          </span>
        ) : null}
        {typeof task.plannedTime === "number" ? (
          <span className="rounded-md bg-surface-soft px-2 py-0.5 text-[11px] text-muted">
            {formatPlannedTime(task.plannedTime)}
          </span>
        ) : null}
        {task.recurrenceSourceTaskId ? (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
            {isFrench ? "Recurrente" : "Recurring"}
          </span>
        ) : null}
      </div>
    </article>
  );
}

type TaskColumnProps = {
  status: TaskStatus;
  children: ReactNode;
};

export function TaskColumn({ status, children }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 flex-1 space-y-3 overflow-y-auto rounded-2xl p-1 transition ${
        isOver ? statusDropClassByStatus[status] : "bg-transparent"
      }`}
    >
      {children}
    </div>
  );
}
