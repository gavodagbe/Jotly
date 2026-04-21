"use client";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  pointerWithin,
  SensorDescriptor,
  SensorOptions,
} from "@dnd-kit/core";
import type { Dispatch, DragEvent as ReactDragEvent, SetStateAction } from "react";

import { SectionIdentityPills, getMainContentSectionClass } from "@/components/layout/section-navigation";
import { TaskCard, TaskColumn } from "@/components/tasks/TaskBoardParts";
import { boardFilterFieldClass, controlButtonClass, iconButtonClass, sectionHeaderClass } from "@/components/ui/constants";
import { CloseIcon, CollapseChevronIcon, DragHandleIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";
type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
type TaskPriority = "low" | "medium" | "high";
type TaskFilterStatus = TaskStatus | "all";
type TaskFilterPriority = TaskPriority | "all";

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

type TaskFilterValues = {
  query: string;
  status: TaskFilterStatus;
  priority: TaskFilterPriority;
  project: string;
};

type BoardColumn = {
  status: TaskStatus;
  label: string;
  emptyLabel: string;
};

type PriorityOption = {
  value: TaskPriority;
  label: string;
};

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
  formatPriority: (priority: TaskPriority, locale: UserLocale) => string;
  formatDateOnlyForLocale: (value: string, locale: UserLocale) => string;
  formatPlannedTime: (totalMinutes: number) => string;
};

const statusColumnClassByStatus: Record<TaskStatus, string> = {
  todo: "border-t-sky-400",
  in_progress: "border-t-amber-400",
  done: "border-t-emerald-400",
  cancelled: "border-t-slate-400",
};

const TASK_STATUS_VALUES = new Set<string>(["todo", "in_progress", "done", "cancelled"]);
const TASK_PRIORITY_VALUES = new Set<string>(["low", "medium", "high"]);
const dashboardIconButtonClass = `${iconButtonClass} h-9 w-9 rounded-xl px-0`;

function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUS_VALUES.has(value);
}

function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITY_VALUES.has(value);
}

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
  formatPriority,
  formatDateOnlyForLocale,
  formatPlannedTime,
}: TaskBoardSectionProps) {
  const isFrench = locale === "fr";

  return (
    <section
      id="board"
      className={`animate-fade-in-up rounded-xl bg-surface p-6 shadow-sm ${getMainContentSectionClass("board", activeSectionId)} ${dropClassName}`}
      style={{ order: visualOrder, animationDelay: "0.2s" }}
      onDragOver={onBlockDragOver}
      onDrop={onBlockDrop}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionIdentityPills sectionId="board" locale={locale} isActive={activeSectionId === "board"} />
          <h2 className={sectionHeaderClass}>{isFrench ? "Tableau Kanban" : "Kanban Board"}</h2>
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
          <section className="mt-4 rounded-2xl border border-line bg-surface-soft/60 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.9fr))_auto]">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                {isFrench ? "Recherche" : "Search"}
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-muted">
                    <SearchIcon />
                  </span>
                  <input
                    type="search"
                    value={taskFilterValues.query}
                    onChange={(event) => {
                      setTaskFilterValues((currentValues) => ({
                        ...currentValues,
                        query: event.target.value,
                      }));
                    }}
                    className={`${boardFilterFieldClass} mt-0 pl-10 pr-10`}
                    placeholder={
                      isFrench
                        ? "Titre, projet, description..."
                        : "Title, project, description..."
                    }
                  />
                  {taskFilterValues.query ? (
                    <button
                      type="button"
                      className="absolute inset-y-0 right-2 inline-flex items-center justify-center rounded-md px-1 text-muted transition-colors hover:text-foreground"
                      onClick={() => {
                        setTaskFilterValues((currentValues) => ({
                          ...currentValues,
                          query: "",
                        }));
                      }}
                      aria-label={isFrench ? "Effacer la recherche" : "Clear search"}
                      title={isFrench ? "Effacer la recherche" : "Clear search"}
                    >
                      <CloseIcon />
                    </button>
                  ) : null}
                </div>
              </label>

              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                {isFrench ? "Statut" : "Status"}
                <select
                  value={taskFilterValues.status}
                  onChange={(event) => {
                    setTaskFilterValues((currentValues) => ({
                      ...currentValues,
                      status: isTaskStatus(event.target.value) ? event.target.value : "all",
                    }));
                  }}
                  className={`${boardFilterFieldClass} mt-2`}
                >
                  <option value="all">{isFrench ? "Tous les statuts" : "All statuses"}</option>
                  {boardColumns.map((column) => (
                    <option key={column.status} value={column.status}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                {isFrench ? "Priorite" : "Priority"}
                <select
                  value={taskFilterValues.priority}
                  onChange={(event) => {
                    setTaskFilterValues((currentValues) => ({
                      ...currentValues,
                      priority: isTaskPriority(event.target.value) ? event.target.value : "all",
                    }));
                  }}
                  className={`${boardFilterFieldClass} mt-2`}
                >
                  <option value="all">{isFrench ? "Toutes les priorites" : "All priorities"}</option>
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                {isFrench ? "Projet" : "Project"}
                <select
                  value={taskFilterValues.project}
                  onChange={(event) => {
                    setTaskFilterValues((currentValues) => ({
                      ...currentValues,
                      project: event.target.value,
                    }));
                  }}
                  className={`${boardFilterFieldClass} mt-2`}
                >
                  <option value="">{isFrench ? "Tous les projets" : "All projects"}</option>
                  {taskFilterProjectOptions.map((projectName) => (
                    <option key={projectName} value={projectName}>
                      {projectName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  className={`w-full xl:w-auto ${controlButtonClass}`}
                  onClick={() => setTaskFilterValues(defaultTaskFilterValues)}
                  disabled={!hasActiveTaskFilters}
                >
                  {isFrench ? "Reinitialiser" : "Reset"}
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-muted">
              {hasActiveTaskFilters
                ? isFrench
                  ? `${filteredTasks.length} tache${filteredTasks.length === 1 ? "" : "s"} visible${filteredTasks.length === 1 ? "" : "s"} sur ${tasks.length}.`
                  : `${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"} shown out of ${tasks.length}.`
                : isFrench
                ? "Filtrez rapidement par texte, statut, priorite ou projet."
                : "Quickly filter by text, status, priority, or project."}
            </p>
          </section>

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

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <main className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {boardColumns.map((column) => {
                const columnTasks = filteredTasksByStatus[column.status];
                const totalColumnTasks = tasksByStatus[column.status];

                return (
                  <section
                    key={column.status}
                    className={`flex h-[480px] flex-col rounded-xl border-t-2 bg-surface-soft/50 px-3 py-3 ${statusColumnClassByStatus[column.status]}`}
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
                              onEdit={onEditTask}
                              onDelete={onDeleteTask}
                              formatPriority={formatPriority}
                              formatDateOnlyForLocale={formatDateOnlyForLocale}
                              formatPlannedTime={formatPlannedTime}
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
