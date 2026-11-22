import type { DayAffirmation, Reminder, Task } from "@prisma/client";
import { affirmationSnapshot } from "../actions/snapshots";
import { z } from "zod";
import { materializeRecurringTasksForDate } from "../../recurrence/recurrence-service";
import { listTaskAlerts } from "../../tasks/task-alerts-service";
import { dayBoundsUtc, formatDateOnly, formatLocalDateTime, resolveDay } from "../mcp-dates";
import { objectivesForDay } from "./objective-tools";
import { McpTool } from "./tool-definition";
import { McpToolError, proof, truncate } from "./tool-kit";

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .describe("Jour au format AAAA-MM-JJ. Par défaut : aujourd'hui (fuseau de Godwin).");

export function projectLabel(item: { project: string | null; subProject: string | null }): string | null {
  if (item.project && item.subProject) return `${item.project} > ${item.subProject}`;
  return item.project ?? item.subProject ?? null;
}

export function describeTask(task: Task) {
  return {
    id: task.id,
    titre: task.title,
    statut: task.status,
    priorite: task.priority,
    projet: projectLabel(task),
    date: formatDateOnly(task.targetDate),
    echeance: task.dueDate ? formatDateOnly(task.dueDate) : null,
    duree_prevue_min: task.plannedTime,
    description: truncate(task.description),
    reportee_depuis: task.rolledFromTaskId ?? null,
  };
}

function describeAffirmation(affirmation: DayAffirmation | null) {
  if (!affirmation) return null;
  return {
    id: affirmation.id,
    date: formatDateOnly(affirmation.targetDate),
    texte: affirmation.text,
    faite: affirmation.isCompleted,
  };
}

function describeReminder(reminder: Reminder, timeZone: string) {
  return {
    id: reminder.id,
    titre: reminder.title,
    quand: formatLocalDateTime(reminder.remindAt, timeZone),
    statut: reminder.status,
    projet: projectLabel(reminder),
  };
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
const STATUS_RANK = { in_progress: 0, todo: 1, done: 2, cancelled: 3 } as const;

const dateOnlyShape = { date: dateParam };

export const lireJournee: McpTool<typeof dateOnlyShape> = {
  name: "lire_journee",
  title: "Lire la journée",
  description:
    "Lit une journée dans Jotly : tâches du jour avec leur statut (ce sont les objectifs du jour), compteurs, affirmation, bilan, alertes d'échéance (en retard, aujourd'hui, demain), rappels du jour et objectifs de la semaine et du mois. À appeler pour toute question sur la journée ou l'avancement.",
  inputSchema: dateOnlyShape,
  write: false,
  async handler({ date }, ctx, stores) {
    const day = resolveDay(date, ctx.timeZone, ctx.now());
    if (stores.recurrenceStore) {
      await materializeRecurringTasksForDate(day, stores.taskStore, stores.recurrenceStore, ctx.userId);
    }

    const { start, end } = dayBoundsUtc(day, ctx.timeZone);
    const [tasks, affirmation, bilan, alerts, reminders, objectives] = await Promise.all([
      stores.taskStore.listByDate(day, ctx.userId),
      stores.dayAffirmationStore.getByDate(day, ctx.userId),
      stores.dayBilanStore.getByDate(day, ctx.userId),
      listTaskAlerts(stores.taskStore, ctx.userId, day),
      stores.reminderStore.listByUser(ctx.userId, { dateFrom: start, dateTo: end }),
      objectivesForDay(stores, ctx.userId, day),
    ]);

    const sorted = [...tasks].sort(
      (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    );
    const count = (status: Task["status"]) => tasks.filter((task) => task.status === status).length;
    const today = formatDateOnly(day);

    return {
      date: today,
      fuseau: ctx.timeZone,
      compteurs: {
        total: tasks.length,
        a_faire: count("todo"),
        en_cours: count("in_progress"),
        faites: count("done"),
        annulees: count("cancelled"),
      },
      taches: sorted.map(describeTask),
      affirmation: describeAffirmation(affirmation),
      bilan: bilan
        ? {
            id: bilan.id,
            humeur_sur_5: bilan.mood,
            victoires: bilan.wins,
            blocages: bilan.blockers,
            lecons: bilan.lessonsLearned,
            top3_demain: bilan.tomorrowTop3,
          }
        : null,
      alertes: {
        echeances_aujourdhui: alerts.dueTodayCount,
        echeances_demain: alerts.dueTomorrowCount,
        en_retard: alerts.tasks.filter((task) => task.dueDate && formatDateOnly(task.dueDate) < today).length,
        taches: alerts.tasks.map((task) => ({
          id: task.id,
          titre: task.title,
          echeance: task.dueDate ? formatDateOnly(task.dueDate) : null,
          priorite: task.priority,
          statut: task.status,
        })),
      },
      rappels: reminders.map((reminder) => describeReminder(reminder, ctx.timeZone)),
      objectifs: objectives,
    };
  },
};

export const lireAffirmation: McpTool<typeof dateOnlyShape> = {
  name: "lire_affirmation",
  title: "Lire l'affirmation du jour",
  description: "Lit l'affirmation d'un jour dans Jotly (par défaut aujourd'hui).",
  inputSchema: dateOnlyShape,
  write: false,
  async handler({ date }, ctx, stores) {
    const day = resolveDay(date, ctx.timeZone, ctx.now());
    const affirmation = await stores.dayAffirmationStore.getByDate(day, ctx.userId);
    return {
      date: formatDateOnly(day),
      affirmation: describeAffirmation(affirmation),
      ...(affirmation ? {} : { message: "Aucune affirmation pour ce jour." }),
    };
  },
};

const ecrireAffirmationShape = {
  texte: z.string().trim().min(1).max(5000).optional().describe("Texte de l'affirmation, tel que dicté par Godwin."),
  date: dateParam,
  faite: z.boolean().optional().describe("true pour marquer l'affirmation comme faite (récitée), false pour l'inverse."),
};

export const ecrireAffirmation: McpTool<typeof ecrireAffirmationShape> = {
  name: "ecrire_affirmation",
  title: "Écrire l'affirmation du jour",
  description:
    "Écrit ou remplace l'affirmation d'un jour, et/ou la marque faite. Renvoie une preuve et l'ancien texte (pour pouvoir revenir en arrière).",
  inputSchema: ecrireAffirmationShape,
  write: true,
  async handler({ texte, date, faite }, ctx, stores) {
    const day = resolveDay(date, ctx.timeZone, ctx.now());
    const existing = await stores.dayAffirmationStore.getByDate(day, ctx.userId);
    const text = texte ?? existing?.text;
    if (!text) {
      throw new McpToolError("Aucune affirmation pour ce jour : fournir « texte ».");
    }
    if (texte === undefined && faite === undefined) {
      throw new McpToolError("Rien à modifier : fournir « texte » et/ou « faite ».");
    }

    const now = ctx.now();
    const isCompleted = faite ?? existing?.isCompleted ?? false;
    const saved = await stores.dayAffirmationStore.upsert({
      userId: ctx.userId,
      targetDate: day,
      text,
      isCompleted,
      completedAt: isCompleted ? existing?.completedAt ?? now : null,
    });

    const actionId = await ctx.recordAction([
      {
        entity: "affirmation",
        date: formatDateOnly(day),
        before: existing ? affirmationSnapshot(existing) : null,
        after: affirmationSnapshot(saved),
      },
    ]);
    return {
      ...proof("affirmation", existing ? "modifiee" : "creee", saved.id, formatDateOnly(day), now, actionId),
      affirmation: describeAffirmation(saved),
      avant: existing ? { texte: existing.text, faite: existing.isCompleted } : null,
    };
  },
};
