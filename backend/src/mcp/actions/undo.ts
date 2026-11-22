import { getTimestampsForStatusTransition } from "../../tasks/task-route-helpers";
import { parseDateOnly } from "../../tasks/task-store";
import { McpDomainStores, McpToolError } from "../tools/tool-kit";
import { McpActionRecord } from "./action-log-store";
import {
  ActionChange,
  affirmationSnapshot,
  bilanSnapshot,
  sameSnapshot,
  TaskSnapshot,
  taskSnapshot,
} from "./snapshots";

export const UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const day = (value: string) => parseDateOnly(value) as Date;
const instant = (value: string | null) => (value ? new Date(value) : null);

function describe(change: ActionChange): string {
  switch (change.entity) {
    case "task":
      return `tâche « ${change.after.title} » (${change.id})`;
    case "reminder":
      return `rappel ${change.id}`;
    case "affirmation":
      return `affirmation du ${change.date}`;
    case "bilan":
      return `bilan du ${change.date}`;
    case "objective":
      return `objectif ${change.periode} ${change.year}-${change.number}`;
  }
}

async function currentState(change: ActionChange, userId: string, stores: McpDomainStores): Promise<object | null> {
  switch (change.entity) {
    case "task": {
      const task = await stores.taskStore.getById(change.id, userId);
      return task ? taskSnapshot(task) : null;
    }
    case "reminder": {
      const reminder = await stores.reminderStore.getById(change.id, userId);
      return reminder ? { status: reminder.status } : null;
    }
    case "affirmation": {
      const affirmation = await stores.dayAffirmationStore.getByDate(day(change.date), userId);
      return affirmation ? affirmationSnapshot(affirmation) : null;
    }
    case "bilan": {
      const bilan = await stores.dayBilanStore.getByDate(day(change.date), userId);
      return bilan ? bilanSnapshot(bilan) : null;
    }
    case "objective": {
      const entry =
        change.periode === "mois"
          ? await stores.monthlyEntryStore.getByMonth(change.year, change.number, userId)
          : await stores.weeklyEntryStore.getByWeek(change.year, change.number, userId);
      return entry ? { objective: entry.objective } : null;
    }
  }
}

function restoreTaskFields(before: TaskSnapshot) {
  return {
    title: before.title,
    description: before.description,
    status: before.status,
    priority: before.priority,
    targetDate: day(before.targetDate),
    dueDate: before.dueDate ? day(before.dueDate) : null,
    plannedTime: before.plannedTime,
    completedAt: instant(before.completedAt),
    cancelledAt: instant(before.cancelledAt),
  };
}

/** What undoing a change does, in words (for the preview). */
export function undoEffect(change: ActionChange): string {
  if (change.before) return `${describe(change)} : retour à l'état d'avant`;
  switch (change.entity) {
    case "task":
      return `${describe(change)} : passée en annulée (pas de suppression)`;
    case "reminder":
      return `${describe(change)} : annulé`;
    case "bilan":
      return `${describe(change)} : champs vidés`;
    case "objective":
      return `${describe(change)} : objectif vidé`;
    case "affirmation":
      return `${describe(change)} : impossible sans suppression`;
  }
}

/** Refuses the whole undo if anything changed since the action, or if it would need a deletion. */
export async function checkUndoable(record: McpActionRecord, now: Date, stores: McpDomainStores): Promise<void> {
  if (record.undoneAt) {
    throw new McpToolError(`Cette action a déjà été annulée le ${record.undoneAt.toISOString()}.`);
  }
  if (now.getTime() - record.createdAt.getTime() > UNDO_WINDOW_MS) {
    throw new McpToolError("Cette action date de plus de 7 jours : l'annulation n'est plus possible, corriger à la main.");
  }

  const problems: string[] = [];
  for (const change of record.changes) {
    if (change.entity === "affirmation" && !change.before) {
      problems.push(`${describe(change)} : une création ne s'annule pas sans suppression ; la réécrire avec ecrire_affirmation`);
      continue;
    }
    const current = await currentState(change, record.userId, stores);
    if (!sameSnapshot(current, change.after)) {
      problems.push(`${describe(change)} a été modifiée depuis`);
    }
  }
  if (problems.length > 0) {
    throw new McpToolError(`Annulation impossible, rien n'a été modifié : ${problems.join(" ; ")}.`);
  }
}

export async function applyUndo(record: McpActionRecord, now: Date, stores: McpDomainStores): Promise<void> {
  const userId = record.userId;
  for (const change of record.changes) {
    switch (change.entity) {
      case "task": {
        if (change.before) {
          await stores.taskStore.update(change.id, restoreTaskFields(change.before), userId);
        } else {
          const task = await stores.taskStore.getById(change.id, userId);
          if (task) {
            await stores.taskStore.update(
              change.id,
              { status: "cancelled", ...getTimestampsForStatusTransition(task, "cancelled", now) },
              userId
            );
          }
        }
        break;
      }
      case "reminder":
        await stores.reminderStore.cancel(change.id, userId);
        break;
      case "affirmation":
        if (change.before) {
          await stores.dayAffirmationStore.upsert({
            userId,
            targetDate: day(change.date),
            text: change.before.text,
            isCompleted: change.before.isCompleted,
            completedAt: instant(change.before.completedAt),
          });
        }
        break;
      case "bilan": {
        const before = change.before ?? { mood: null, wins: null, blockers: null, lessonsLearned: null, tomorrowTop3: null };
        await stores.dayBilanStore.upsert({ userId, targetDate: day(change.date), ...before });
        break;
      }
      case "objective": {
        const objective = change.before?.objective ?? null;
        if (change.periode === "mois") {
          await stores.monthlyEntryStore.upsert({ userId, year: change.year, month: change.number, objective });
        } else {
          await stores.weeklyEntryStore.upsert({ userId, year: change.year, isoWeek: change.number, objective });
        }
        break;
      }
    }
  }
}
