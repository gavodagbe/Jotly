"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { boardFilterFieldClass, controlButtonClass } from "@/components/ui/constants";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import type { BoardColumn, PriorityOption, TaskFilterValues, TaskPriority, TaskStatus } from "./task-board-types";

const TASK_STATUS_VALUES = new Set<string>(["todo", "in_progress", "done", "cancelled"]);
const TASK_PRIORITY_VALUES = new Set<string>(["low", "medium", "high"]);

function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUS_VALUES.has(value);
}

function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITY_VALUES.has(value);
}

/** Number of filters that differ from "show everything" (badge on the mobile Filters button). */
export function countActiveTaskFilters(values: TaskFilterValues): number {
  return [values.query.trim() !== "", values.status !== "all", values.priority !== "all", values.project !== "", values.subProject !== ""].filter(Boolean).length;
}

type TaskBoardFiltersProps = {
  isFrench: boolean;
  taskFilterValues: TaskFilterValues;
  defaultTaskFilterValues: TaskFilterValues;
  setTaskFilterValues: Dispatch<SetStateAction<TaskFilterValues>>;
  hasActiveTaskFilters: boolean;
  boardColumns: ReadonlyArray<BoardColumn>;
  priorityOptions: ReadonlyArray<PriorityOption>;
  taskFilterProjectOptions: string[];
  taskFilterSubProjectOptions: string[];
  visibleCount: number;
  totalCount: number;
};

/** Board filters. Always visible on desktop; folded behind a "Filters" button below lg. */
export function TaskBoardFilters({
  isFrench,
  taskFilterValues,
  defaultTaskFilterValues,
  setTaskFilterValues,
  hasActiveTaskFilters,
  boardColumns,
  priorityOptions,
  taskFilterProjectOptions,
  taskFilterSubProjectOptions,
  visibleCount,
  totalCount,
}: TaskBoardFiltersProps) {
  const [isOpenOnMobile, setIsOpenOnMobile] = useState(false);
  const activeCount = countActiveTaskFilters(taskFilterValues);

  return (
    <>
      <div className="mt-3 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium ${
            activeCount > 0 ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-foreground"
          }`}
          aria-expanded={isOpenOnMobile}
          onClick={() => setIsOpenOnMobile((open) => !open)}
        >
          <SearchIcon />
          {isFrench ? "Filtres" : "Filters"}
          {activeCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">{activeCount}</span>
          )}
        </button>
        {activeCount > 0 && (
          <button type="button" className="h-10 px-2 text-sm text-muted" onClick={() => setTaskFilterValues(defaultTaskFilterValues)}>
            {isFrench ? "Effacer" : "Clear"}
          </button>
        )}
      </div>
    <section className={`mt-4 rounded-2xl border border-line bg-surface-soft/60 p-4 lg:block ${isOpenOnMobile ? "block" : "hidden"}`}>
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
                subProject: "",
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

        {taskFilterValues.project && taskFilterSubProjectOptions.length > 0 ? (
          <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {isFrench ? "Sous-projet" : "Sub-project"}
            <select
              value={taskFilterValues.subProject}
              onChange={(event) => {
                setTaskFilterValues((currentValues) => ({
                  ...currentValues,
                  subProject: event.target.value,
                }));
              }}
              className={`${boardFilterFieldClass} mt-2`}
            >
              <option value="">{isFrench ? "Tous les sous-projets" : "All sub-projects"}</option>
              {taskFilterSubProjectOptions.map((subProjectName) => (
                <option key={subProjectName} value={subProjectName}>
                  {subProjectName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

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
            ? `${visibleCount} tache${visibleCount === 1 ? "" : "s"} visible${visibleCount === 1 ? "" : "s"} sur ${totalCount}.`
            : `${visibleCount} task${visibleCount === 1 ? "" : "s"} shown out of ${totalCount}.`
          : isFrench
          ? "Filtrez rapidement par texte, statut, priorite ou projet."
          : "Quickly filter by text, status, priority, or project."}
      </p>
    </section>
    </>
  );
}
