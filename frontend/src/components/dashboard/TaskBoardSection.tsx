"use client";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  pointerWithin,
  SensorDescriptor,
  SensorOptions,
} from "@dnd-kit/core";
import { useState, type Dispatch, type DragEvent as ReactDragEvent, type SetStateAction } from "react";

import { SectionIdentityPills, getMainContentSectionClass } from "@/components/layout/section-navigation";
import { TaskCard, TaskColumn } from "@/components/tasks/TaskBoardParts";
import { iconButtonClass, sectionHeaderClass } from "@/components/ui/constants";
import { CollapseChevronIcon, DragHandleIcon, PlusIcon } from "@/components/ui/icons";

import type {
  BoardColumn,
  PriorityOption,
  Task,
  TaskFilterValues,
  TaskPriority,
  TaskStatus,
  UserLocale,
} from "./task-board-types";
import { TaskBoardFilters } from "./TaskBoardFilters";
import { TaskStatusSwitcher } from "./TaskStatusSwitcher";

type TaskBoardSectionProps = {
  locale: UserLocale;
  activeSectionId: string;
  visualOrder: number;
  dropClassName: string;
  isCollapsed: boolean;
  collapsedHintLabel: string;
  dragHandleLabel: string;
  collapseToggleLabel: string;
  taskFilterValues: TaskFilterValues;
  defaultTaskFilterValues: TaskFilterValues;
  setTaskFilterValues: Dispatch<SetStateAction<TaskFilterValues>>;
  hasActiveTaskFilters: boolean;
  tasks: Task[];
  filteredTasks: Task[];
  filteredTasksByStatus: Record<TaskStatus, Task[]>;
  tasksByStatus: Record<TaskStatus, Task[]>;
  boardColumns: ReadonlyArray<BoardColumn>;
  priorityOptions: ReadonlyArray<PriorityOption>;
  taskFilterProjectOptions: string[];
  taskFilterSubProjectOptions: string[];
  isEmptyBoard: boolean;
  isFilteredBoardEmpty: boolean;
  sensors: SensorDescriptor<SensorOptions>[];
  activeTaskId: string | null;
  pendingTaskIds: string[];
  isLoading: boolean;
  isMutationPending: boolean;
  isDeletingTask: boolean;
  taskToDelete: Task | null;
  isSubmittingTask: boolean;
  editingTaskId: string | null;
  onBlockDragStart: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onBlockDragEnd: () => void;
  onBlockDragOver: (event: ReactDragEvent<HTMLElement>) => void;
  onBlockDrop: (event: ReactDragEvent<HTMLElement>) => void;
  onToggleCollapse: () => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  onCreateTask: (status?: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  taskTimeEntries: Map<string, number>;
  pendingTimeEntryTaskIds: string[];
  imputedTimeTotal: number;
  timeEntryErrorMessage: string | null;
  onTaskTimeFractionChange: (taskId: string, fraction: number) => void;
  formatPriority: (priority: TaskPriority, locale: UserLocale) => string;
  formatDateOnlyForLocale: (value: string, locale: UserLocale) => string;
  formatPlannedTime: (totalMinutes: number) => string;
  formatDayFraction: (value: number, locale: UserLocale) => string;
};

const statusColumnClassByStatus: Record<TaskStatus, string> = {
  todo: "border-t-sky-400",
  in_progress: "border-t-amber-400",
  done: "border-t-emerald-400",
  cancelled: "border-t-slate-400",
};

const dashboardIconButtonClass = `${iconButtonClass} h-9 w-9 rounded-xl px-0`;

export function TaskBoardSection({
  locale,
  activeSectionId,
  visualOrder,
  dropClassName,
  isCollapsed,
  collapsedHintLabel,
  dragHandleLabel,
  collapseToggleLabel,
  taskFilterValues,
  defaultTaskFilterValues,
  setTaskFilterValues,
  hasActiveTaskFilters,
  tasks,
  filteredTasks,
  filteredTasksByStatus,
  tasksByStatus,
  boardColumns,
  priorityOptions,
  taskFilterProjectOptions,
  taskFilterSubProjectOptions,
  isEmptyBoard,
  isFilteredBoardEmpty,
  sensors,
  activeTaskId,
  pendingTaskIds,
  isLoading,
  isMutationPending,
  isDeletingTask,
  taskToDelete,
  isSubmittingTask,
  editingTaskId,
  onBlockDragStart,
  onBlockDragEnd,
  onBlockDragOver,
  onBlockDrop,
  onToggleCollapse,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  taskTimeEntries,
  pendingTimeEntryTaskIds,
  imputedTimeTotal,
  timeEntryErrorMessage,
  onTaskTimeFractionChange,
  formatPriority,
  formatDateOnlyForLocale,
  formatPlannedTime,
  formatDayFraction,
}: TaskBoardSectionProps) {
  const isFrench = locale === "fr";
  // Below lg the board shows one status column at a time.
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>("todo");
  const roundedImputedTotal = Math.round(imputedTimeTotal * 100) / 100;
  const imputedTotalTone =
    roundedImputedTotal === 1
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : roundedImputedTotal > 1
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-line bg-surface-soft text-muted";

  return (
    <section
      id="board"
      data-screen="tasks"
      className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getMainContentSectionClass("board", activeSectionId)} ${dropClassName}`}
      style={{ order: visualOrder, animationDelay: "0.2s" }}
      onDragOver={onBlockDragOver}
      onDrop={onBlockDrop}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionIdentityPills sectionId="board" locale={locale} isActive={activeSectionId === "board"} />
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={sectionHeaderClass}>{isFrench ? "Tableau Kanban" : "Kanban Board"}</h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${imputedTotalTone}`}
              title={
                isFrench
                  ? "Somme du temps imputé sur les tâches du jour (objectif : 1)"
                  : "Sum of time imputed on today's tasks (target: 1)"
              }
            >
              <span aria-hidden>⏱</span>
              {formatDayFraction(roundedImputedTotal, locale)} / 1
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
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
        <p className="mt-3 text-xs text-muted">{collapsedHintLabel}</p>
      ) : (
        <>
          <TaskBoardFilters
            isFrench={isFrench}
            taskFilterValues={taskFilterValues}
            defaultTaskFilterValues={defaultTaskFilterValues}
            setTaskFilterValues={setTaskFilterValues}
            hasActiveTaskFilters={hasActiveTaskFilters}
            boardColumns={boardColumns}
            priorityOptions={priorityOptions}
            taskFilterProjectOptions={taskFilterProjectOptions}
            taskFilterSubProjectOptions={taskFilterSubProjectOptions}
            visibleCount={filteredTasks.length}
            totalCount={tasks.length}
          />

          <TaskStatusSwitcher
            isFrench={isFrench}
            columns={boardColumns}
            counts={Object.fromEntries(boardColumns.map((column) => [column.status, filteredTasksByStatus[column.status].length])) as Record<TaskStatus, number>}
            activeStatus={mobileStatus}
            onChange={setMobileStatus}
          />

          {isEmptyBoard ? (
            <section className="mt-4 rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted shadow-sm">
              <p className="font-semibold text-foreground">
                {isFrench
                  ? "Aucune tache n'est planifiee pour cette date."
                  : "No tasks are scheduled for this date yet."}
              </p>
              <p className="mt-1">
                {isFrench
                  ? "Creez votre premiere tache pour remplir ce tableau."
                  : "Create your first task to populate this board."}
              </p>
            </section>
          ) : null}

          {isFilteredBoardEmpty ? (
            <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
              <p className="font-semibold">
                {isFrench
                  ? "Aucune tache ne correspond aux filtres actifs."
                  : "No tasks match the active filters."}
              </p>
              <p className="mt-1">
                {isFrench
                  ? "Ajustez la recherche ou reinitialisez les filtres pour revoir tout le planning."
                  : "Adjust the search or reset filters to show the full schedule again."}
              </p>
            </section>
          ) : null}

          {timeEntryErrorMessage ? (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {timeEntryErrorMessage}
            </p>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <main className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              {boardColumns.map((column) => {
                const columnTasks = filteredTasksByStatus[column.status];
                const totalColumnTasks = tasksByStatus[column.status];

                return (
                  <section
                    key={column.status}
                    className={`min-h-[240px] flex-col rounded-xl border-t-2 bg-surface-soft/50 px-3 py-3 lg:flex lg:h-[480px] ${column.status === mobileStatus ? "flex" : "hidden"} ${statusColumnClassByStatus[column.status]}`}
                  >
                    <header className="flex items-center justify-between gap-2 pb-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xs font-semibold text-foreground">
                          {column.label}
                        </h2>
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface px-1.5 text-[10px] font-semibold text-muted">
                          {hasActiveTaskFilters ? `${columnTasks.length}/${totalColumnTasks.length}` : columnTasks.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
                        onClick={() => onCreateTask(column.status)}
                        disabled={isMutationPending}
                        aria-label={isFrench ? `Nouvelle tache (${column.label})` : `New task (${column.label})`}
                        title={isFrench ? `Nouvelle tache (${column.label})` : `New task (${column.label})`}
                      >
                        <PlusIcon />
                      </button>
                    </header>

                    <TaskColumn status={column.status}>
                      {isLoading ? (
                        <>
                          <div className="h-20 animate-pulse rounded-2xl bg-surface-soft" />
                          <div className="h-16 animate-pulse rounded-2xl bg-surface-soft" />
                        </>
                      ) : columnTasks.length > 0 ? (
                        columnTasks.map((task) => {
                          const isSavingTask =
                            pendingTaskIds.includes(task.id) ||
                            (isDeletingTask && taskToDelete?.id === task.id) ||
                            (isSubmittingTask && editingTaskId === task.id);

                          return (
                            <TaskCard
                              key={task.id}
                              locale={locale}
                              task={task}
                              isDragging={activeTaskId === task.id}
                              isSaving={isSavingTask}
                              timeFraction={taskTimeEntries.get(task.id) ?? null}
                              isTimeSaving={pendingTimeEntryTaskIds.includes(task.id)}
                              onEdit={onEditTask}
                              onDelete={onDeleteTask}
                              onTimeFractionChange={onTaskTimeFractionChange}
                              formatPriority={formatPriority}
                              formatDateOnlyForLocale={formatDateOnlyForLocale}
                              formatPlannedTime={formatPlannedTime}
                              formatDayFraction={formatDayFraction}
                            />
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-line bg-surface-soft px-3 py-4 text-sm text-muted">
                          {hasActiveTaskFilters
                            ? isFrench
                              ? "Aucune tache visible avec ces filtres."
                              : "No visible tasks with these filters."
                            : column.emptyLabel}
                        </div>
                      )}
                    </TaskColumn>
                  </section>
                );
              })}
            </main>
          </DndContext>
        </>
      )}
    </section>
  );
}
