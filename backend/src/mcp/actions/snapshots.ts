import type { DayAffirmation, DayBilan, Reminder, Task } from "@prisma/client";
import { formatDateOnly } from "../../tasks/task-store";

/** Restorable state of each entity an MCP tool can write (JSON-serializable). */
export type TaskSnapshot = {
  title: string;
  description: string | null;
  status: Task["status"];
  priority: Task["priority"];
  targetDate: string;
  dueDate: string | null;
  plannedTime: number | null;
  completedAt: string | null;
  cancelledAt: string | null;
};
export type ReminderSnapshot = { status: Reminder["status"] };
export type AffirmationSnapshot = { text: string; isCompleted: boolean; completedAt: string | null };
export type BilanSnapshot = {
  mood: number | null;
  wins: string | null;
  blockers: string | null;
  lessonsLearned: string | null;
  tomorrowTop3: string | null;
};
export type ObjectiveSnapshot = { objective: string | null };

/** One entity changed by a tool call. `before` is null for a creation. */
export type ActionChange =
  | { entity: "task"; id: string; before: TaskSnapshot | null; after: TaskSnapshot }
  | { entity: "reminder"; id: string; before: null; after: ReminderSnapshot }
  | { entity: "affirmation"; date: string; before: AffirmationSnapshot | null; after: AffirmationSnapshot }
  | { entity: "bilan"; date: string; before: BilanSnapshot | null; after: BilanSnapshot }
  | {
      entity: "objective";
      periode: "mois" | "semaine";
      year: number;
      number: number;
      before: ObjectiveSnapshot | null;
      after: ObjectiveSnapshot;
    };

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function taskSnapshot(task: Task): TaskSnapshot {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    targetDate: formatDateOnly(task.targetDate),
    dueDate: task.dueDate ? formatDateOnly(task.dueDate) : null,
    plannedTime: task.plannedTime,
    completedAt: iso(task.completedAt),
    cancelledAt: iso(task.cancelledAt),
  };
}

export function affirmationSnapshot(affirmation: DayAffirmation): AffirmationSnapshot {
  return { text: affirmation.text, isCompleted: affirmation.isCompleted, completedAt: iso(affirmation.completedAt) };
}

export function bilanSnapshot(bilan: DayBilan): BilanSnapshot {
  return {
    mood: bilan.mood,
    wins: bilan.wins,
    blockers: bilan.blockers,
    lessonsLearned: bilan.lessonsLearned,
    tomorrowTop3: bilan.tomorrowTop3,
  };
}

export function sameSnapshot(a: object | null, b: object | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
