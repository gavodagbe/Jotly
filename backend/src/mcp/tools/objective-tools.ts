import { z } from "zod";
import { formatDateOnly, isoWeekOf, isoWeekRange, isoWeeksInYear, resolveDay } from "../mcp-dates";
import { createConfirmationToken, isValidConfirmationToken } from "./confirmation-token";
import { McpTool } from "./tool-definition";
import { McpDomainStores, McpToolError, proof } from "./tool-kit";

/**
 * Objectives are published from the Coffre Vision into Jotly's existing weekly and
 * monthly objective fields (no schema change). The first line of the text marks the
 * origin, so both Godwin and the LLM can tell a coffre objective from one typed in Jotly.
 */
export const COFFRE_MARKER = "[Coffre Vision]";

type Period = { periode: "mois" | "semaine"; year: number; number: number; cle: string };

function parsePeriod(periode: "mois" | "semaine", cle: string): Period {
  if (periode === "mois") {
    const match = cle.match(/^(\d{4})-(\d{2})$/);
    const month = match ? Number(match[2]) : 0;
    if (!match || month < 1 || month > 12) {
      throw new McpToolError(`Mois invalide « ${cle} » : format attendu AAAA-MM (ex. 2026-12).`);
    }
    return { periode, year: Number(match[1]), number: month, cle: `${match[1]}-${match[2]}` };
  }
  const match = cle.match(/^(\d{4})-[SW](\d{1,2})$/i);
  const year = match ? Number(match[1]) : 0;
  const week = match ? Number(match[2]) : 0;
  if (!match || week < 1 || week > isoWeeksInYear(year)) {
    throw new McpToolError(`Semaine invalide « ${cle} » : format attendu AAAA-Sxx (semaine ISO, ex. 2026-S49).`);
  }
  return { periode, year, number: week, cle: `${year}-S${String(week).padStart(2, "0")}` };
}

async function readObjective(stores: McpDomainStores, userId: string, period: Period) {
  const entry =
    period.periode === "mois"
      ? await stores.monthlyEntryStore.getByMonth(period.year, period.number, userId)
      : await stores.weeklyEntryStore.getByWeek(period.year, period.number, userId);
  return entry?.objective ?? null;
}

async function writeObjective(stores: McpDomainStores, userId: string, period: Period, text: string) {
  return period.periode === "mois"
    ? stores.monthlyEntryStore.upsert({ userId, year: period.year, month: period.number, objective: text })
    : stores.weeklyEntryStore.upsert({ userId, year: period.year, isoWeek: period.number, objective: text });
}

/** Describes an objective text: its origin and its items. */
export function describeObjective(text: string | null) {
  if (!text || !text.trim()) return null;
  const lines = text.split("\n");
  const fromCoffre = lines[0].startsWith(COFFRE_MARKER);
  return {
    origine: fromCoffre ? "coffre" : "jotly",
    entete: fromCoffre ? lines[0] : null,
    texte: (fromCoffre ? lines.slice(1) : lines).join("\n").trim(),
  };
}

function formatFr(date: Date): string {
  const iso = formatDateOnly(date);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function composeText(items: string[], sourceNote: string, publishedOn: Date): string {
  const header = `${COFFRE_MARKER} publié le ${formatFr(publishedOn)} depuis « ${sourceNote} ». Modifier dans le coffre puis republier.`;
  return [header, ...items.map((item) => `- ${item}`)].join("\n");
}

/** Objectives of the week and month covering a day. */
export async function objectivesForDay(stores: McpDomainStores, userId: string, day: Date) {
  const { year, week } = isoWeekOf(day);
  const month = { periode: "mois" as const, year: day.getUTCFullYear(), number: day.getUTCMonth() + 1, cle: formatDateOnly(day).slice(0, 7) };
  const weekPeriod = { periode: "semaine" as const, year, number: week, cle: `${year}-S${String(week).padStart(2, "0")}` };
  const [monthText, weekText] = await Promise.all([
    readObjective(stores, userId, month),
    readObjective(stores, userId, weekPeriod),
  ]);
  const range = isoWeekRange(year, week);
  return {
    mois: { cle: month.cle, objectif: describeObjective(monthText) },
    semaine: {
      cle: weekPeriod.cle,
      du: formatDateOnly(range.start),
      au: formatDateOnly(range.end),
      objectif: describeObjective(weekText),
    },
  };
}

const lireObjectifsShape = {
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Jour de référence (AAAA-MM-JJ). Par défaut : aujourd'hui."),
};

export const lireObjectifs: McpTool<typeof lireObjectifsShape> = {
  name: "lire_objectifs",
  title: "Lire les objectifs",
  description:
    "Lit les objectifs de la semaine et du mois qui couvrent un jour, avec leur origine (coffre ou saisis dans Jotly). Les objectifs du jour sont les tâches du jour : utiliser lire_journee.",
  inputSchema: lireObjectifsShape,
  write: false,
  async handler({ date }, ctx, stores) {
    const day = resolveDay(date, ctx.timeZone, ctx.now());
    return { date: formatDateOnly(day), ...(await objectivesForDay(stores, ctx.userId, day)) };
  },
};

const publierShape = {
  publications: z
    .array(
      z.object({
        periode: z.enum(["mois", "semaine"]),
        cle: z.string().trim().max(10).describe("Mois : AAAA-MM. Semaine ISO : AAAA-Sxx."),
        objectifs: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
      })
    )
    .min(1)
    .max(12)
    .describe("Périodes à publier, par exemple un mois et ses semaines."),
  note_source: z.string().trim().min(1).max(200).describe("Note du coffre d'où viennent ces objectifs."),
  jeton_confirmation: z
    .string()
    .max(200)
    .optional()
    .describe("Jeton renvoyé par l'aperçu. À fournir UNIQUEMENT après accord explicite de Godwin."),
};

export const publierObjectifs: McpTool<typeof publierShape> = {
  name: "publier_objectifs",
  title: "Publier des objectifs du coffre",
  description:
    "Publie dans Jotly des objectifs de mois et de semaine décidés dans le Coffre Vision. Opération en masse, en deux temps : 1) sans jeton, aperçu (ancien et nouveau texte de chaque période), rien n'est modifié ; 2) après accord explicite de Godwin, rappeler avec le même contenu et le jeton. Remplace l'objectif existant de chaque période.",
  inputSchema: publierShape,
  write: true,
  async handler({ publications, note_source, jeton_confirmation }, ctx, stores) {
    const now = ctx.now();
    const periods = publications.map((publication) => ({
      period: parsePeriod(publication.periode, publication.cle),
      items: publication.objectifs,
    }));
    const keys = periods.map(({ period }) => `${period.periode}:${period.cle}`);
    if (new Set(keys).size !== keys.length) {
      throw new McpToolError("Une même période apparaît deux fois : fusionner ses objectifs.");
    }

    const today = resolveDay(undefined, ctx.timeZone, now);
    const planned = await Promise.all(
      periods.map(async ({ period, items }) => ({
        period,
        before: await readObjective(stores, ctx.userId, period),
        after: composeText(items, note_source, today),
      }))
    );

    const scope = `objectives:${ctx.userId}`;
    // Signed over the new texts AND the current ones: any change since the preview voids the token.
    const content = JSON.stringify(planned.map(({ period, before, after }) => [period.periode, period.cle, before, after]));

    if (!jeton_confirmation) {
      const confirmation = createConfirmationToken(scope, content, now);
      return {
        apercu: true,
        modifie: false,
        periodes: planned.map(({ period, before, after }) => ({
          periode: period.periode,
          cle: period.cle,
          avant: describeObjective(before),
          apres: describeObjective(after),
          remplace_un_objectif_saisi_dans_jotly: describeObjective(before)?.origine === "jotly",
        })),
        jeton_confirmation: confirmation.token,
        expire_a: confirmation.expiresAt.toISOString(),
        consigne: "Montrer cet aperçu à Godwin, signaler tout objectif saisi dans Jotly qui serait remplacé, et attendre son accord avant de rappeler avec le jeton.",
      };
    }

    if (!isValidConfirmationToken(jeton_confirmation, scope, content, now)) {
      throw new McpToolError(
        "Jeton de confirmation invalide ou expiré, ou le contenu a changé depuis l'aperçu. Refaire un aperçu sans jeton."
      );
    }

    const saved = [];
    for (const { period, before, after } of planned) {
      const entry = await writeObjective(stores, ctx.userId, period, after);
      saved.push({ periode: period.periode, cle: period.cle, id: entry.id, avant: before });
    }
    return {
      ...proof("objectifs", "publies", saved.map((entry) => entry.id).join(","), formatDateOnly(today), now),
      periodes: saved,
    };
  },
};
