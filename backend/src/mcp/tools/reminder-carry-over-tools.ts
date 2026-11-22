import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import { carryOverYesterdayTasks, listCarryOverCandidates } from "../../tasks/carry-over-service";
import { getPreviousDate } from "../../tasks/task-route-helpers";
import { formatDateOnly, formatLocalDateTime, parseReminderTime, resolveDay } from "../mcp-dates";
import { safeEqual } from "../oauth/oauth-crypto";
import { describeTask, projectLabel } from "./day-tools";
import { resolveProjectByName } from "./task-tools";
import { McpTool } from "./tool-definition";
import { McpToolError, proof } from "./tool-kit";

const creerRappelShape = {
  titre: z.string().trim().min(1).max(200).describe("Objet du rappel."),
  quand: z
    .string()
    .trim()
    .min(16)
    .max(40)
    .describe("Date et heure, de préférence en heure locale de Godwin : AAAA-MM-JJTHH:MM (ex. 2026-11-26T09:00)."),
  description: z.string().trim().max(5000).optional(),
  projet: z.string().trim().min(1).max(200).optional().describe("Nom d'un projet Jotly existant."),
};

export const creerRappel: McpTool<typeof creerRappelShape> = {
  name: "creer_rappel",
  title: "Créer un rappel",
  description: "Crée un rappel daté dans Jotly (notification à l'heure indiquée).",
  inputSchema: creerRappelShape,
  write: true,
  async handler(args, ctx, stores) {
    const now = ctx.now();
    const remindAt = parseReminderTime(args.quand, ctx.timeZone);
    if (remindAt.getTime() < now.getTime() - 60_000) {
      throw new McpToolError(
        `L'heure demandée (${formatLocalDateTime(remindAt, ctx.timeZone)}) est déjà passée. Vérifier la date avec Godwin.`
      );
    }
    const project = args.projet
      ? await resolveProjectByName(stores.projectStore, ctx.userId, args.projet)
      : { projectId: null, project: null, subProject: null };

    const reminder = await stores.reminderStore.create({
      userId: ctx.userId,
      title: args.titre,
      description: args.description || null,
      ...project,
      remindAt,
    });

    return {
      ...proof("rappel", "cree", reminder.id, formatDateOnly(remindAt), now),
      rappel: {
        id: reminder.id,
        titre: reminder.title,
        quand: formatLocalDateTime(reminder.remindAt, ctx.timeZone),
        quand_utc: reminder.remindAt.toISOString(),
        projet: projectLabel(reminder),
      },
    };
  },
};

// ---------------------------------------------------------------- carry-over (bulk: preview, then confirm)

const CONFIRMATION_TTL_MS = 10 * 60 * 1000;
// Per-process secret: a restart simply invalidates pending previews.
const confirmationSecret = randomBytes(32);

function signPreview(userId: string, day: string, taskIds: string[], expiresAt: number): string {
  return createHmac("sha256", confirmationSecret)
    .update([userId, day, [...taskIds].sort().join(","), String(expiresAt)].join("|"))
    .digest("base64url");
}

function confirmationToken(userId: string, day: string, taskIds: string[], expiresAt: number): string {
  return `${expiresAt.toString(36)}.${signPreview(userId, day, taskIds, expiresAt)}`;
}

function isValidConfirmation(token: string, userId: string, day: string, taskIds: string[], now: number): boolean {
  const [expiry, signature] = token.split(".");
  const expiresAt = parseInt(expiry ?? "", 36);
  if (!signature || !Number.isFinite(expiresAt) || expiresAt < now) return false;
  return safeEqual(signature, signPreview(userId, day, taskIds, expiresAt));
}

const reporterShape = {
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Jour qui reçoit les tâches (AAAA-MM-JJ). Par défaut : aujourd'hui ; la veille est le jour précédent."),
  jeton_confirmation: z
    .string()
    .max(200)
    .optional()
    .describe("Jeton renvoyé par l'aperçu. À fournir UNIQUEMENT après accord explicite de Godwin."),
};

export const reporterTachesVeille: McpTool<typeof reporterShape> = {
  name: "reporter_taches_veille",
  title: "Reporter les tâches de la veille",
  description:
    "Opération en masse, en deux temps. 1) Sans jeton : renvoie l'aperçu des tâches non terminées de la veille et un jeton_confirmation, sans rien modifier. 2) Après accord explicite de Godwin sur cet aperçu : rappeler avec le jeton pour copier ces tâches sur le jour demandé.",
  inputSchema: reporterShape,
  write: true,
  async handler({ date, jeton_confirmation }, ctx, stores) {
    const now = ctx.now();
    const targetDate = resolveDay(date, ctx.timeZone, now);
    const day = formatDateOnly(targetDate);
    const candidates = await listCarryOverCandidates(stores.taskStore, ctx.userId, targetDate);
    const ids = candidates.map((task) => task.id);

    if (!jeton_confirmation) {
      const expiresAt = now.getTime() + CONFIRMATION_TTL_MS;
      return {
        apercu: true,
        modifie: false,
        depuis: formatDateOnly(getPreviousDate(targetDate)),
        vers: day,
        nombre: candidates.length,
        taches: candidates.map(describeTask),
        ...(candidates.length > 0
          ? {
              jeton_confirmation: confirmationToken(ctx.userId, day, ids, expiresAt),
              expire_a: new Date(expiresAt).toISOString(),
              consigne: "Montrer cette liste à Godwin et demander son accord avant de rappeler avec le jeton.",
            }
          : { consigne: "Rien à reporter." }),
      };
    }

    if (!isValidConfirmation(jeton_confirmation, ctx.userId, day, ids, now.getTime())) {
      throw new McpToolError(
        "Jeton de confirmation invalide ou expiré, ou la liste a changé depuis l'aperçu. Refaire un aperçu sans jeton."
      );
    }

    const { createdTasks, skippedCount } = await carryOverYesterdayTasks(stores.taskStore, ctx.userId, targetDate);
    return {
      ...proof("report", "reportees", createdTasks.map((task) => task.id).join(",") || "aucune", day, now),
      copiees: createdTasks.length,
      deja_reportees: skippedCount,
      taches: createdTasks.map(describeTask),
    };
  },
};
