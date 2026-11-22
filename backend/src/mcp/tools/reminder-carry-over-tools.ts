import { z } from "zod";
import { taskSnapshot } from "../actions/snapshots";
import { carryOverYesterdayTasks, listCarryOverCandidates } from "../../tasks/carry-over-service";
import { addUtcDays, getCarryOverDueDate, getPreviousDate } from "../../tasks/task-route-helpers";
import { formatDateOnly, formatLocalDateTime, parseReminderTime, resolveDay } from "../mcp-dates";
import { createConfirmationToken, isValidConfirmationToken } from "./confirmation-token";
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
  reindexes: ["reminder"],
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

    const actionId = await ctx.recordAction([
      { entity: "reminder", id: reminder.id, before: null, after: { status: reminder.status } },
    ]);
    return {
      ...proof("rappel", "cree", reminder.id, formatDateOnly(remindAt), now, actionId),
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
  reindexes: ["task"],
  async handler({ date, jeton_confirmation }, ctx, stores) {
    const now = ctx.now();
    const targetDate = resolveDay(date, ctx.timeZone, now);
    const day = formatDateOnly(targetDate);
    const candidates = await listCarryOverCandidates(stores.taskStore, ctx.userId, targetDate);
    const scope = `carry-over:${ctx.userId}:${day}`;
    const content = candidates
      .map((task) => task.id)
      .sort()
      .join(",");

    if (!jeton_confirmation) {
      const confirmation = createConfirmationToken(scope, content, now);
      return {
        apercu: true,
        modifie: false,
        depuis: formatDateOnly(getPreviousDate(targetDate)),
        vers: day,
        nombre: candidates.length,
        taches: candidates.map(describeTask),
        ...(candidates.length > 0
          ? {
              jeton_confirmation: confirmation.token,
              expire_a: confirmation.expiresAt.toISOString(),
              consigne: "Montrer cette liste à Godwin et demander son accord avant de rappeler avec le jeton.",
            }
          : { consigne: "Rien à reporter." }),
      };
    }

    if (!isValidConfirmationToken(jeton_confirmation, scope, content, now)) {
      throw new McpToolError(
        "Jeton de confirmation invalide ou expiré, ou la liste a changé depuis l'aperçu. Refaire un aperçu sans jeton."
      );
    }

    const { createdTasks, skippedCount } = await carryOverYesterdayTasks(stores.taskStore, ctx.userId, targetDate);
    const actionId = createdTasks.length
      ? await ctx.recordAction(
          createdTasks.map((task) => ({ entity: "task" as const, id: task.id, before: null, after: taskSnapshot(task) }))
        )
      : undefined;
    return {
      ...proof("report", "reportees", createdTasks.map((task) => task.id).join(",") || "aucune", day, now, actionId),
      copiees: createdTasks.length,
      deja_reportees: skippedCount,
      taches: createdTasks.map(describeTask),
    };
  },
};

// ---------------------------------------------------------------- one task (evening review, task by task)

const reporterTacheShape = {
  id: z.string().trim().min(1).max(100).describe("Tâche non terminée à reporter."),
  vers: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Jour cible (AAAA-MM-JJ). Par défaut : demain."),
};

export const reporterTache: McpTool<typeof reporterTacheShape> = {
  name: "reporter_tache",
  title: "Reporter une tâche",
  description:
    "Reporte UNE tâche non terminée sur un autre jour (demain par défaut), comme le report de Jotly : une copie est créée sur le jour cible et la tâche d'origine reste dans l'historique. Action unitaire, immédiate.",
  inputSchema: reporterTacheShape,
  write: true,
  reindexes: ["task"],
  async handler({ id, vers }, ctx, stores) {
    const now = ctx.now();
    const source = await stores.taskStore.getById(id, ctx.userId);
    if (!source) throw new McpToolError(`Tâche introuvable : ${id}. Utiliser lire_journee pour retrouver son id.`);
    if (source.status !== "todo" && source.status !== "in_progress") {
      throw new McpToolError(`La tâche « ${source.title} » est ${source.status === "done" ? "faite" : "annulée"} : rien à reporter.`);
    }
    const targetDate = vers ? resolveDay(vers, ctx.timeZone, now) : addUtcDays(resolveDay(undefined, ctx.timeZone, now), 1);
    if (targetDate <= source.targetDate) {
      throw new McpToolError("Le jour cible doit être postérieur au jour de la tâche.");
    }

    const existing = (await stores.taskStore.listByDate(targetDate, ctx.userId)).find(
      (task) => task.rolledFromTaskId === source.id
    );
    if (existing) {
      return {
        ...proof("tache", "deja_reportee", existing.id, formatDateOnly(targetDate), now),
        tache: describeTask(existing),
      };
    }

    const copy = await stores.taskStore.create({
      userId: ctx.userId,
      rolledFromTaskId: source.id,
      title: source.title,
      description: source.description,
      status: source.status,
      targetDate,
      dueDate: getCarryOverDueDate(source, targetDate),
      priority: source.priority,
      project: source.project,
      subProject: source.subProject,
      projectId: source.projectId,
      plannedTime: source.plannedTime,
      recurrenceSourceTaskId: null,
      recurrenceOccurrenceDate: null,
      completedAt: null,
      cancelledAt: null,
    });
    const actionId = await ctx.recordAction([{ entity: "task", id: copy.id, before: null, after: taskSnapshot(copy) }]);
    return {
      ...proof("tache", "reportee", copy.id, formatDateOnly(targetDate), now, actionId),
      tache: describeTask(copy),
      origine: { id: source.id, date: formatDateOnly(source.targetDate) },
    };
  },
};
