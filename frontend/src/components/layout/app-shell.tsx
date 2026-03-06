"use client";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-meta";

type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
type TaskPriority = "low" | "medium" | "high";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: string;
  priority: TaskPriority;
  project: string | null;
  plannedTime: number | null;
};

type ApiErrorPayload = { error?: { message?: string } } | null;

const BOARD_COLUMNS: ReadonlyArray<{
  status: TaskStatus;
  label: string;
  emptyLabel: string;
}> = [
  { status: "todo", label: "To Do", emptyLabel: "No tasks ready for this day." },
  { status: "in_progress", label: "In Progress", emptyLabel: "No tasks in progress." },
  { status: "done", label: "Done", emptyLabel: "Nothing completed yet." },
  { status: "cancelled", label: "Cancelled", emptyLabel: "No cancelled tasks." },
];
const BOARD_COLUMN_STATUSES = new Set<TaskStatus>(BOARD_COLUMNS.map((column) => column.status));

const dateHeadingFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const controlButtonClass =
  "rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent";

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function shiftDate(value: string, offsetDays: number): string {
  const shifted = parseDateInput(value);
  shifted.setDate(shifted.getDate() + offsetDays);
  return toDateInputValue(shifted);
}

function getDateHeading(value: string): string {
  return dateHeadingFormatter.format(parseDateInput(value));
}

function formatPriority(priority: TaskPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function isTaskStatus(value: string): value is TaskStatus {
  return BOARD_COLUMN_STATUSES.has(value as TaskStatus);
}

function getApiErrorMessage(statusCode: number, payload: ApiErrorPayload, fallback: string): string {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  return `${fallback} (HTTP ${statusCode}).`;
}

async function loadTasksByDate(date: string, signal?: AbortSignal): Promise<Task[]> {
  const response = await fetch(`/backend-api/tasks?date=${encodeURIComponent(date)}`, {
    method: "GET",
    signal,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Task[]; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load tasks for this date"));
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  const response = await fetch(`/backend-api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: Task; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to move task"));
  }

  if (!payload?.data) {
    throw new Error("Unable to move task.");
  }

  return payload.data;
}

type TaskCardProps = {
  task: Task;
  isDragging: boolean;
  isSaving: boolean;
};

function TaskCard({ task, isDragging, isSaving }: TaskCardProps) {
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
      className={`rounded-2xl border border-line bg-background/80 px-3 py-3 shadow-sm transition ${
        isDragging ? "opacity-60 shadow-md" : ""
      } ${isSaving ? "cursor-wait opacity-80" : "cursor-grab active:cursor-grabbing"}`}
      aria-busy={isSaving}
      {...attributes}
      {...listeners}
    >
      <h3 className="text-sm font-semibold text-foreground">{task.title}</h3>
      {task.description ? <p className="mt-2 text-sm leading-6 text-muted">{task.description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
          {formatPriority(task.priority)}
        </span>
        {task.project ? (
          <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">
            {task.project}
          </span>
        ) : null}
        {typeof task.plannedTime === "number" ? (
          <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">
            {task.plannedTime} min
          </span>
        ) : null}
      </div>
    </article>
  );
}

type TaskColumnProps = {
  status: TaskStatus;
  children: React.ReactNode;
};

function TaskColumn({ status, children }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 flex-1 space-y-3 rounded-2xl p-1 transition ${isOver ? "bg-accent-soft/60" : ""}`}
    >
      {children}
    </div>
  );
}

export function AppShell() {
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragErrorMessage, setDragErrorMessage] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  function markTaskAsPending(taskId: string, isPending: boolean) {
    setPendingTaskIds((previousIds) => {
      if (isPending) {
        return previousIds.includes(taskId) ? previousIds : [...previousIds, taskId];
      }

      return previousIds.filter((id) => id !== taskId);
    });
  }

  function handleDateChange(nextDate: string) {
    if (nextDate === selectedDate) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setDragErrorMessage(null);
    setActiveTaskId(null);
    setPendingTaskIds([]);
    setSelectedDate(nextDate);
  }

  useEffect(() => {
    const controller = new AbortController();

    loadTasksByDate(selectedDate, controller.signal)
      .then((nextTasks) => {
        setTasks(nextTasks);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setTasks([]);
        setErrorMessage(error instanceof Error ? error.message : "Unable to load tasks for this date.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedDate]);

  const tasksByStatus = useMemo(() => {
    return {
      todo: tasks.filter((task) => task.status === "todo"),
      in_progress: tasks.filter((task) => task.status === "in_progress"),
      done: tasks.filter((task) => task.status === "done"),
      cancelled: tasks.filter((task) => task.status === "cancelled"),
    };
  }, [tasks]);

  const isEmptyBoard = !isLoading && !errorMessage && tasks.length === 0;

  function handleDragStart(event: DragStartEvent) {
    if (isLoading || pendingTaskIds.length > 0) {
      return;
    }

    setDragErrorMessage(null);
    setActiveTaskId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);

    if (isLoading || pendingTaskIds.length > 0) {
      return;
    }

    const taskId = String(event.active.id);
    const nextStatusId = event.over ? String(event.over.id) : null;

    if (!nextStatusId || !isTaskStatus(nextStatusId)) {
      return;
    }

    const movingTask = tasks.find((task) => task.id === taskId);

    if (!movingTask || movingTask.status === nextStatusId) {
      return;
    }

    setDragErrorMessage(null);
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: nextStatusId,
            }
          : task
      )
    );
    markTaskAsPending(taskId, true);

    try {
      const updatedTask = await updateTaskStatus(taskId, nextStatusId);
      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === taskId ? { ...task, ...updatedTask } : task))
      );
    } catch (error) {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: movingTask.status,
              }
            : task
        )
      );
      setDragErrorMessage(error instanceof Error ? error.message : "Unable to move task.");
    } finally {
      markTaskAsPending(taskId, false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col gap-6 px-4 py-8 sm:px-8 lg:px-10">
      <header className="rounded-3xl border border-line bg-surface/90 px-6 py-7 shadow-sm backdrop-blur sm:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">JOT-7 Date Board</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{APP_NAME}</h1>
        <p className="mt-2 max-w-2xl text-base text-muted sm:text-lg">{APP_TAGLINE}</p>
      </header>

      <section className="rounded-3xl border border-line bg-surface px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={controlButtonClass}
            onClick={() => handleDateChange(shiftDate(selectedDate, -1))}
          >
            Previous Day
          </button>
          <button
            type="button"
            className={controlButtonClass}
            onClick={() => handleDateChange(toDateInputValue(new Date()))}
          >
            Today
          </button>
          <button
            type="button"
            className={controlButtonClass}
            onClick={() => handleDateChange(shiftDate(selectedDate, 1))}
          >
            Next Day
          </button>
          <label className="ml-auto flex min-w-[190px] flex-col gap-1 text-xs uppercase tracking-[0.14em] text-muted">
            Selected Date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                if (event.target.value) {
                  handleDateChange(event.target.value);
                }
              }}
              className="rounded-xl border border-line bg-background px-3 py-2 text-sm tracking-normal text-foreground outline-none transition focus:border-accent"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <p className="font-medium text-foreground">{getDateHeading(selectedDate)}</p>
          <p>
            {isLoading
              ? "Loading tasks..."
              : `${tasks.length} task${tasks.length === 1 ? "" : "s"} for the selected date`}
          </p>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </section>
      ) : null}

      {dragErrorMessage ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {dragErrorMessage}
        </section>
      ) : null}

      {isEmptyBoard ? (
        <section className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted shadow-sm">
          No tasks are scheduled for this date yet.
        </section>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTaskId(null)}
      >
        <main className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BOARD_COLUMNS.map((column) => {
            const columnTasks = tasksByStatus[column.status];

            return (
              <section
                key={column.status}
                className="flex min-h-[320px] flex-col rounded-3xl border border-line bg-surface px-4 py-4 shadow-sm"
              >
                <header className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">
                    {column.label}
                  </h2>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                    {columnTasks.length}
                  </span>
                </header>

                <TaskColumn status={column.status}>
                  {isLoading ? (
                    <>
                      <div className="h-20 animate-pulse rounded-2xl bg-background" />
                      <div className="h-16 animate-pulse rounded-2xl bg-background" />
                    </>
                  ) : columnTasks.length > 0 ? (
                    columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isDragging={activeTaskId === task.id}
                        isSaving={pendingTaskIds.includes(task.id)}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted">{column.emptyLabel}</p>
                  )}
                </TaskColumn>
              </section>
            );
          })}
        </main>
      </DndContext>
    </div>
  );
}
