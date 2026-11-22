import { z } from "zod";
import { addUtcDays } from "../../tasks/task-route-helpers";
import { formatDateOnly, isoWeekOf, isoWeekRange, resolveDay } from "../mcp-dates";
import { summarizeTasks } from "./review-tools";
import { McpTool } from "./tool-definition";

const lireTendancesShape = {
  semaines: z.number().int().min(2).max(12).optional().describe("Nombre de semaines ISO à comparer, semaine en cours comprise (4 par défaut)."),
};

export const lireTendances: McpTool<typeof lireTendancesShape> = {
  name: "lire_tendances",
  title: "Lire les tendances",
  description:
    "Compare les dernières semaines, de la plus ancienne à la plus récente : taux de réalisation, tâches, reports, humeur moyenne, jours avec affirmation faite, projets dominants. Pour repérer une tendance (surcharge, baisse d'humeur, projet qui glisse).",
  inputSchema: lireTendancesShape,
  write: false,
  async handler({ semaines }, ctx, stores) {
    const today = resolveDay(undefined, ctx.timeZone, ctx.now());
    const count = semaines ?? 4;
    const current = isoWeekOf(today);
    const currentRange = isoWeekRange(current.year, current.week);
    const weeks = Array.from({ length: count }, (_, index) => {
      const start = addUtcDays(currentRange.start, -7 * (count - 1 - index));
      const { year, week } = isoWeekOf(start);
      return { year, week, start, end: addUtcDays(start, 6) };
    });

    const allTasks = await stores.taskStore.listByUser(ctx.userId);

    const rows = [];
    for (const week of weeks) {
      const days = Array.from({ length: 7 }, (_, index) => addUtcDays(week.start, index));
      const [affirmations, bilans] = await Promise.all([
        Promise.all(days.map((day) => stores.dayAffirmationStore.getByDate(day, ctx.userId))),
        Promise.all(days.map((day) => stores.dayBilanStore.getByDate(day, ctx.userId))),
      ]);
      const summary = summarizeTasks(allTasks.filter((task) => task.targetDate >= week.start && task.targetDate <= week.end));
      const moods = bilans.map((bilan) => bilan?.mood).filter((mood): mood is number => typeof mood === "number");

      rows.push({
        semaine: `${week.year}-S${String(week.week).padStart(2, "0")}`,
        du: formatDateOnly(week.start),
        en_cours: week.year === current.year && week.week === current.week,
        taches: summary.total,
        faites: summary.faites,
        taux_realisation: summary.taux_realisation,
        reportees: summary.reportees_depuis_la_veille,
        humeur_moyenne: moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
        jours_affirmation_faite: affirmations.filter((affirmation) => affirmation?.isCompleted).length,
        jours_avec_bilan: bilans.filter(Boolean).length,
        projets_principaux: summary.par_projet.slice(0, 3),
      });
    }

    return {
      semaines: rows,
      note: "La semaine en cours est incomplète : la comparer avec prudence.",
    };
  },
};
