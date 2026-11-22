import type { Task } from "@prisma/client";
import { z } from "zod";
import { normalizeProjectName, ProjectStore, resolveProjectDenormalization } from "../../projects/project-store";
import { getTimestampsForNewStatus, getTimestampsForStatusTransition } from "../../tasks/task-route-helpers";
import { parseDateOnly, TaskCreateInput, TaskUpdateInput } from "../../tasks/task-store";
import { formatDateOnly, resolveDay } from "../mcp-dates";
import { describeTask } from "./day-tools";
import { McpTool } from "./tool-definition";
import { McpDomainStores, McpToolError, proof, ToolContext } from "./tool-kit";

const optionalDate = (description: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe(description);
const priority = z.enum(["low", "medium", "high"]);
const status = z.enum(["todo", "in_progress", "done", "cancelled"]);
const taskId = z.string().trim().min(1).max(100).describe("Identifiant de la tâche (champ id renvoyé par lire_journee).");

function parseOptionalDate(value: string | undefined, label: string): Date | undefined {
  if (value === undefined) return undefined;
  const parsed = parseDateOnly(value);
  if (!parsed) throw new McpToolError(`${label} invalide « ${value} » : format AAAA-MM-JJ.`);
  return parsed;
}

/** Resolves a project by name (case-insensitive, "Projet > Sous-projet" accepted). Unknown names list the options. */
export async function resolveProjectByName(projectStore: ProjectStore, userId: string, name: string) {
  const projects = await projectStore.listByUser(userId);
  const byId = new Map(projects.map((project) => [project.id, project]));
  const label = (project: (typeof projects)[number]) => {
    const parent = project.parentId ? byId.get(project.parentId) : undefined;
    return parent ? `${parent.name} > ${project.name}` : project.name;
  };
  const wanted = normalizeProjectName(name).toLowerCase();
  const matches = projects.filter(
    (project) => project.name.toLowerCase() === wanted || label(project).toLowerCase() === wanted
  );

  if (matches.length !== 1) {
    const available = projects.map(label).sort((a, b) => a.localeCompare(b, "fr"));
    const reason = matches.length === 0 ? `Projet inconnu « ${name} »` : `Projet ambigu « ${name} »`;
    throw new McpToolError(`${reason}. Projets disponibles : ${available.join(", ") || "aucun"}.`);
  }
  return resolveProjectDenormalization(projectStore, matches[0].id, userId);
}

async function getOwnedTask(id: string, userId: string, stores: { taskStore: { getById(id: string, userId: string): Promise<Task | null> } }) {
  const task = await stores.taskStore.getById(id, userId);
  if (!task) throw new McpToolError(`Tâche introuvable : ${id}. Utiliser lire_journee pour retrouver son id.`);
  return task;
}

export type NewTaskArgs = {
  titre: string;
  date?: string;
  description?: string;
  priorite?: "low" | "medium" | "high";
  echeance?: string;
  projet?: string;
  duree_prevue_min?: number;
};

/** Validates a new task (dates, project by name) into the store input. Shared by creer_tache and creer_taches. */
export async function prepareTaskCreate(
  args: NewTaskArgs,
  ctx: ToolContext,
  stores: Pick<McpDomainStores, "projectStore">
): Promise<TaskCreateInput> {
  const now = ctx.now();
  const targetDate = resolveDay(args.date, ctx.timeZone, now);
  const dueDate = parseOptionalDate(args.echeance, "Échéance") ?? targetDate;
  const project = args.projet
    ? await resolveProjectByName(stores.projectStore, ctx.userId, args.projet)
    : { projectId: null, project: null, subProject: null };

  return {
    userId: ctx.userId,
    title: args.titre,
    description: args.description || null,
    status: "todo",
    targetDate,
    dueDate,
    priority: args.priorite ?? "medium",
    ...project,
    plannedTime: args.duree_prevue_min ?? null,
    ...getTimestampsForNewStatus("todo", now),
  };
}

export const creerTacheShape = {
  titre: z.string().trim().min(1).max(300).describe("Titre court de la tâche."),
  date: optionalDate("Jour où la tâche est planifiée (AAAA-MM-JJ). Par défaut : aujourd'hui."),
  description: z.string().trim().max(5000).optional(),
  priorite: priority.optional().describe("low, medium (défaut) ou high."),
  echeance: optionalDate("Échéance (AAAA-MM-JJ). Par défaut : le jour planifié."),
  projet: z.string().trim().min(1).max(200).optional().describe("Nom d'un projet Jotly existant (ou « Projet > Sous-projet »)."),
  duree_prevue_min: z.number().int().min(0).max(24 * 60).optional().describe("Durée prévue en minutes."),
};

export const creerTache: McpTool<typeof creerTacheShape> = {
  name: "creer_tache",
  title: "Créer une tâche",
  description: "Crée UNE tâche dans Jotly. Pour plusieurs tâches d'un coup, utiliser creer_taches.",
  inputSchema: creerTacheShape,
  write: true,
  async handler(args, ctx, stores) {
    const now = ctx.now();
    const task = await stores.taskStore.create(await prepareTaskCreate(args, ctx, stores));
    return { ...proof("tache", "creee", task.id, formatDateOnly(task.targetDate), now), tache: describeTask(task) };
  },
};

const terminerTacheShape = { id: taskId };

export const terminerTache: McpTool<typeof terminerTacheShape> = {
  name: "terminer_tache",
  title: "Marquer une tâche faite",
  description: "Marque une tâche comme faite (statut done). Sans effet si elle l'est déjà.",
  inputSchema: terminerTacheShape,
  write: true,
  async handler({ id }, ctx, stores) {
    const now = ctx.now();
    const task = await getOwnedTask(id, ctx.userId, stores);
    if (task.status === "done") {
      return {
        ...proof("tache", "deja_faite", task.id, formatDateOnly(task.targetDate), task.completedAt ?? now),
        tache: describeTask(task),
      };
    }
    const updated = await stores.taskStore.update(
      id,
      { status: "done", ...getTimestampsForStatusTransition(task, "done", now) },
      ctx.userId
    );
    if (!updated) throw new McpToolError(`Tâche introuvable : ${id}.`);
    return {
      ...proof("tache", "faite", updated.id, formatDateOnly(updated.targetDate), now),
      tache: describeTask(updated),
      avant: { statut: task.status },
    };
  },
};

const modifierTacheShape = {
  id: taskId,
  titre: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).optional().describe("Chaîne vide pour effacer."),
  statut: status.optional().describe("todo, in_progress, done ou cancelled (annulée, réversible)."),
  priorite: priority.optional(),
  date: optionalDate("Nouveau jour planifié (AAAA-MM-JJ)."),
  echeance: optionalDate("Nouvelle échéance (AAAA-MM-JJ)."),
  duree_prevue_min: z.number().int().min(0).max(24 * 60).optional(),
};

export const modifierTache: McpTool<typeof modifierTacheShape> = {
  name: "modifier_tache",
  title: "Modifier une tâche",
  description:
    "Modifie une tâche existante (seuls les champs fournis changent). Renvoie une preuve et les valeurs avant/après pour pouvoir annuler. Aucune suppression possible.",
  inputSchema: modifierTacheShape,
  write: true,
  async handler(args, ctx, stores) {
    const now = ctx.now();
    const task = await getOwnedTask(args.id, ctx.userId, stores);
    const before = describeTask(task);
    const patch: TaskUpdateInput = {};

    if (args.titre !== undefined) patch.title = args.titre;
    if (args.description !== undefined) patch.description = args.description || null;
    if (args.priorite !== undefined) patch.priority = args.priorite;
    if (args.duree_prevue_min !== undefined) patch.plannedTime = args.duree_prevue_min;
    if (args.date !== undefined) patch.targetDate = parseOptionalDate(args.date, "Date");
    if (args.echeance !== undefined) patch.dueDate = parseOptionalDate(args.echeance, "Échéance");
    if (args.statut !== undefined) {
      patch.status = args.statut;
      Object.assign(patch, getTimestampsForStatusTransition(task, args.statut, now));
    }
    if (Object.keys(patch).length === 0) {
      throw new McpToolError("Rien à modifier : fournir au moins un champ.");
    }

    const updated = await stores.taskStore.update(args.id, patch, ctx.userId);
    if (!updated) throw new McpToolError(`Tâche introuvable : ${args.id}.`);
    const after = describeTask(updated);
    const changed = (Object.keys(after) as (keyof typeof after)[]).filter(
      (key) => JSON.stringify(after[key]) !== JSON.stringify(before[key])
    );

    return {
      ...proof("tache", "modifiee", updated.id, formatDateOnly(updated.targetDate), now),
      avant: Object.fromEntries(changed.map((key) => [key, before[key]])),
      apres: Object.fromEntries(changed.map((key) => [key, after[key]])),
    };
  },
};
