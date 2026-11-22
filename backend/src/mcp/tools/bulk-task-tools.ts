import { z } from "zod";
import { taskSnapshot } from "../actions/snapshots";
import { formatDateOnly } from "../mcp-dates";
import { createConfirmationToken, isValidConfirmationToken } from "./confirmation-token";
import { describeTask } from "./day-tools";
import { creerTacheShape, prepareTaskCreate } from "./task-tools";
import { McpTool } from "./tool-definition";
import { McpToolError, proof } from "./tool-kit";

const { date: _date, ...taskItemShape } = creerTacheShape;

const creerTachesShape = {
  taches: z.array(z.object(taskItemShape)).min(2).max(20).describe("Tâches à créer, dans l'ordre de priorité."),
  date: creerTacheShape.date.describe("Jour commun à toutes les tâches (AAAA-MM-JJ). Par défaut : aujourd'hui."),
  jeton_confirmation: z
    .string()
    .max(200)
    .optional()
    .describe("Jeton renvoyé par l'aperçu. À fournir UNIQUEMENT après accord explicite de Godwin."),
};

export const creerTaches: McpTool<typeof creerTachesShape> = {
  name: "creer_taches",
  title: "Créer plusieurs tâches",
  description:
    "Opération en masse, en deux temps : 1) sans jeton, renvoie l'aperçu des tâches telles qu'elles seront créées (dates, projets résolus), rien n'est créé ; 2) après accord explicite de Godwin, rappeler avec la même liste et le jeton. Sert notamment à préparer le lendemain pendant le bilan du soir.",
  inputSchema: creerTachesShape,
  write: true,
  reindexes: ["task"],
  async handler({ taches, date, jeton_confirmation }, ctx, stores) {
    const now = ctx.now();
    // Validates every task (dates, projects) before anything is written.
    const inputs = await Promise.all(taches.map((task) => prepareTaskCreate({ ...task, date }, ctx, stores)));
    const scope = `create-tasks:${ctx.userId}`;
    const content = JSON.stringify(
      inputs.map((input) => [
        input.title,
        input.description,
        formatDateOnly(input.targetDate),
        input.dueDate ? formatDateOnly(input.dueDate) : null,
        input.priority,
        input.projectId,
        input.project,
        input.plannedTime,
      ])
    );
    const preview = inputs.map((input) => ({
      titre: input.title,
      date: formatDateOnly(input.targetDate),
      echeance: input.dueDate ? formatDateOnly(input.dueDate) : null,
      priorite: input.priority,
      projet: input.subProject ? `${input.project} > ${input.subProject}` : input.project,
      duree_prevue_min: input.plannedTime,
    }));

    if (!jeton_confirmation) {
      const confirmation = createConfirmationToken(scope, content, now);
      return {
        apercu: true,
        modifie: false,
        nombre: inputs.length,
        taches: preview,
        jeton_confirmation: confirmation.token,
        expire_a: confirmation.expiresAt.toISOString(),
        consigne: "Montrer cette liste à Godwin et attendre son accord avant de rappeler avec la même liste et le jeton.",
      };
    }

    if (!isValidConfirmationToken(jeton_confirmation, scope, content, now)) {
      throw new McpToolError(
        "Jeton de confirmation invalide ou expiré, ou la liste a changé depuis l'aperçu. Refaire un aperçu sans jeton."
      );
    }

    const created = [];
    for (const input of inputs) {
      created.push(await stores.taskStore.create(input));
    }
    const actionId = await ctx.recordAction(
      created.map((task) => ({ entity: "task" as const, id: task.id, before: null, after: taskSnapshot(task) }))
    );
    return {
      ...proof(
        "taches",
        "creees",
        created.map((task) => task.id).join(","),
        formatDateOnly(inputs[0].targetDate),
        now,
        actionId
      ),
      nombre: created.length,
      taches: created.map(describeTask),
    };
  },
};
