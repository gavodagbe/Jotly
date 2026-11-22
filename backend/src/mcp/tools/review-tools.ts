import type { DayBilan, Task } from "@prisma/client";
import { bilanSnapshot } from "../actions/snapshots";
import { z } from "zod";
import { addUtcDays } from "../../tasks/task-route-helpers";
import { formatDateOnly, isoWeekOf, isoWeekRange, isoWeeksInYear, resolveDay } from "../mcp-dates";
import { projectLabel } from "./day-tools";
import { describeObjective } from "./objective-tools";
import { McpTool } from "./tool-definition";
import { McpToolError, proof, truncate } from "./tool-kit";

// ---------------------------------------------------------------- ecrire_bilan

const text = (description: string) => z.string().trim().max(10000).optional().describe(description);

const ecrireBilanShape = {
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Jour du bilan (AAAA-MM-JJ). Par défaut : aujourd'hui."),
  humeur: z.number().int().min(1).max(5).optional().describe("Humeur de 1 (mauvaise) à 5 (excellente)."),
  victoires: text("Ce qui a bien marché, dans les mots de Godwin."),
  blocages: text("Ce qui a bloqué."),
  lecons: text("Leçons apprises."),
  top3_demain: text("Les trois priorités du lendemain, une par ligne."),
};

function describeBilan(bilan: DayBilan | null) {
  if (!bilan) return null;
  return {
    humeur_sur_5: bilan.mood,
    victoires: bilan.wins,
    blocages: bilan.blockers,
    lecons: bilan.lessonsLearned,
    top3_demain: bilan.tomorrowTop3,
  };
}

export const ecrireBilan: McpTool<typeof ecrireBilanShape> = {
  name: "ecrire_bilan",
  title: "Écrire le bilan du jour",
  description:
    "Écrit le bilan du soir dans Jotly. Seuls les champs fournis changent (une chaîne vide efface le champ). Renvoie une preuve et les valeurs d'avant.",
  inputSchema: ecrireBilanShape,
  write: true,
  reindexes: ["bilan"],
  async handler(args, ctx, stores) {
    const { date, humeur, victoires, blocages, lecons, top3_demain } = args;
    if ([humeur, victoires, blocages, lecons, top3_demain].every((value) => value === undefined)) {
      throw new McpToolError("Rien à écrire : fournir au moins un champ du bilan.");
    }
    const now = ctx.now();
    const day = resolveDay(date, ctx.timeZone, now);
    const existing = await stores.dayBilanStore.getByDate(day, ctx.userId);
    const merge = (value: string | undefined, current: string | null | undefined) =>
      value !== undefined ? value || null : current ?? null;

    const saved = await stores.dayBilanStore.upsert({
      userId: ctx.userId,
      targetDate: day,
      mood: humeur !== undefined ? humeur : existing?.mood ?? null,
      wins: merge(victoires, existing?.wins),
      blockers: merge(blocages, existing?.blockers),
      lessonsLearned: merge(lecons, existing?.lessonsLearned),
      tomorrowTop3: merge(top3_demain, existing?.tomorrowTop3),
    });

    const actionId = await ctx.recordAction([
      {
        entity: "bilan",
        date: formatDateOnly(day),
        before: existing ? bilanSnapshot(existing) : null,
        after: bilanSnapshot(saved),
      },
    ]);
    return {
      ...proof("bilan", existing ? "modifie" : "cree", saved.id, formatDateOnly(day), now, actionId),
      bilan: describeBilan(saved),
      avant: describeBilan(existing),
    };
  },
};

// ---------------------------------------------------------------- lire_periode

type Range = { periode: "semaine" | "mois"; cle: string; start: Date; end: Date };

function resolveRange(periode: "semaine" | "mois", cle: string | undefined, today: Date): Range {
  if (periode === "mois") {
    const key = cle ?? formatDateOnly(today).slice(0, 7);
    const match = key.match(/^(\d{4})-(\d{2})$/);
    const month = match ? Number(match[2]) : 0;
    if (!match || month < 1 || month > 12) throw new McpToolError(`Mois invalide « ${key} » : format AAAA-MM.`);
    const year = Number(match[1]);
    return {
      periode,
      cle: key,
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 0)),
    };
  }
  const current = isoWeekOf(today);
  const match = cle?.match(/^(\d{4})-[SW](\d{1,2})$/i);
  if (cle && !match) throw new McpToolError(`Semaine invalide « ${cle} » : format AAAA-Sxx.`);
  const year = match ? Number(match[1]) : current.year;
  const week = match ? Number(match[2]) : current.week;
  if (week < 1 || week > isoWeeksInYear(year)) throw new McpToolError(`Semaine invalide « ${cle} ».`);
  return { periode, cle: `${year}-S${String(week).padStart(2, "0")}`, ...isoWeekRange(year, week) };
}

function daysOf(range: Range): Date[] {
  const days: Date[] = [];
  for (let day = range.start; day <= range.end; day = addUtcDays(day, 1)) days.push(day);
  return days;
}

export function summarizeTasks(tasks: Task[]) {
  const count = (status: Task["status"]) => tasks.filter((task) => task.status === status).length;
  const done = count("done");
  const cancelled = count("cancelled");
  const counted = tasks.length - cancelled;

  const byProject = new Map<string, { total: number; faites: number }>();
  for (const task of tasks) {
    if (task.status === "cancelled") continue;
    const key = projectLabel(task) ?? "(sans projet)";
    const entry = byProject.get(key) ?? { total: 0, faites: 0 };
    entry.total += 1;
    if (task.status === "done") entry.faites += 1;
    byProject.set(key, entry);
  }

  return {
    total: tasks.length,
    faites: done,
    a_faire: count("todo"),
    en_cours: count("in_progress"),
    annulees: cancelled,
    reportees_depuis_la_veille: tasks.filter((task) => task.rolledFromTaskId).length,
    taux_realisation: counted > 0 ? Math.round((done / counted) * 100) / 100 : null,
    par_projet: [...byProject.entries()]
      .map(([projet, stats]) => ({ projet, ...stats }))
      .sort((a, b) => b.total - a.total),
    non_terminees: tasks
      .filter((task) => task.status === "todo" || task.status === "in_progress")
      .slice(0, 30)
      .map((task) => ({ id: task.id, titre: task.title, date: formatDateOnly(task.targetDate), priorite: task.priority })),
  };
}

const lirePeriodeShape = {
  periode: z.enum(["semaine", "mois"]),
  cle: z
    .string()
    .trim()
    .max(10)
    .optional()
    .describe("Semaine ISO AAAA-Sxx ou mois AAAA-MM. Par défaut : la semaine ou le mois en cours."),
};

export const lirePeriode: McpTool<typeof lirePeriodeShape> = {
  name: "lire_periode",
  title: "Lire une semaine ou un mois",
  description:
    "Synthèse d'une semaine ou d'un mois dans Jotly, pour une revue ou l'analyse mensuelle : tâches (par statut, par projet, taux de réalisation, reports, tâches non terminées), affirmations faites, humeur et bilans de chaque jour, objectif et revue de la période.",
  inputSchema: lirePeriodeShape,
  write: false,
  async handler({ periode, cle }, ctx, stores) {
    const range = resolveRange(periode, cle, resolveDay(undefined, ctx.timeZone, ctx.now()));
    const days = daysOf(range);
    const inRange = (date: Date) => date >= range.start && date <= range.end;

    const [allTasks, affirmations, bilans, entry] = await Promise.all([
      stores.taskStore.listByUser(ctx.userId),
      Promise.all(days.map((day) => stores.dayAffirmationStore.getByDate(day, ctx.userId))),
      Promise.all(days.map((day) => stores.dayBilanStore.getByDate(day, ctx.userId))),
      range.periode === "mois"
        ? stores.monthlyEntryStore.getByMonth(range.start.getUTCFullYear(), range.start.getUTCMonth() + 1, ctx.userId)
        : stores.weeklyEntryStore.getByWeek(
            Number(range.cle.slice(0, 4)),
            Number(range.cle.slice(6)),
            ctx.userId
          ),
    ]);

    const tasks = allTasks.filter((task) => inRange(task.targetDate));
    const writtenBilans = bilans.filter((bilan): bilan is DayBilan => bilan !== null);
    const moods = writtenBilans.map((bilan) => bilan.mood).filter((mood): mood is number => mood !== null);

    return {
      periode: range.periode,
      cle: range.cle,
      du: formatDateOnly(range.start),
      au: formatDateOnly(range.end),
      taches: summarizeTasks(tasks),
      affirmations: {
        jours_avec_affirmation: affirmations.filter(Boolean).length,
        jours_faites: affirmations.filter((affirmation) => affirmation?.isCompleted).length,
        sur_jours: days.length,
      },
      bilans: {
        jours_avec_bilan: writtenBilans.length,
        humeur_moyenne: moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
        jours: writtenBilans.map((bilan) => ({
          date: formatDateOnly(bilan.targetDate),
          humeur_sur_5: bilan.mood,
          victoires: truncate(bilan.wins, 300),
          blocages: truncate(bilan.blockers, 300),
          lecons: truncate(bilan.lessonsLearned, 300),
        })),
      },
      objectif: describeObjective(entry?.objective ?? null),
      revue: entry?.review ?? null,
    };
  },
};
