import { z } from "zod";
import { McpActionLogStore } from "../actions/action-log-store";
import { applyUndo, checkUndoable, undoEffect } from "../actions/undo";
import { formatDateOnly, resolveDay } from "../mcp-dates";
import { createConfirmationToken, isValidConfirmationToken } from "./confirmation-token";
import { McpTool } from "./tool-definition";
import { McpToolError, proof } from "./tool-kit";

const annulerShape = {
  action_id: z.string().trim().min(1).max(100).describe("action_id figurant dans la preuve de l'action à annuler."),
  jeton_confirmation: z
    .string()
    .max(200)
    .optional()
    .describe("Uniquement pour une action qui a touché plusieurs éléments : jeton de l'aperçu, après accord de Godwin."),
};

/**
 * Undo needs the action log, which is not a Jotly domain store: the tool is built
 * with it rather than reading it from the stores passed to every handler.
 */
export function createAnnulerTool(actionLog: McpActionLogStore): McpTool<typeof annulerShape> {
  return {
    name: "annuler",
    title: "Annuler une action",
    description:
      "Annule une écriture faite par un LLM, à partir de l'action_id de sa preuve (7 jours au plus). Rien n'est supprimé : une tâche créée passe en annulée, un rappel créé est annulé, une modification revient à l'état d'avant. Refusé si l'élément a changé depuis. Si l'action a touché plusieurs éléments : aperçu d'abord, puis jeton après accord de Godwin.",
    inputSchema: annulerShape,
    write: true,
    reindexes: ["task", "reminder", "affirmation", "bilan", "weeklyObjective", "monthlyObjective"],
    async handler({ action_id, jeton_confirmation }, ctx, stores) {
      const now = ctx.now();
      const record = await actionLog.get(action_id, ctx.userId);
      if (!record) {
        throw new McpToolError(`Action inconnue : ${action_id}. Utiliser l'action_id renvoyé dans la preuve.`);
      }
      await checkUndoable(record, now, stores);

      const effects = record.changes.map(undoEffect);
      if (record.changes.length > 1) {
        const scope = `undo:${ctx.userId}:${record.id}`;
        const content = JSON.stringify(record.changes);
        if (!jeton_confirmation) {
          const confirmation = createConfirmationToken(scope, content, now);
          return {
            apercu: true,
            modifie: false,
            action: { outil: record.tool, date: record.createdAt.toISOString() },
            effets: effects,
            jeton_confirmation: confirmation.token,
            expire_a: confirmation.expiresAt.toISOString(),
            consigne: "Montrer ces effets à Godwin et attendre son accord avant de rappeler avec le jeton.",
          };
        }
        if (!isValidConfirmationToken(jeton_confirmation, scope, content, now)) {
          throw new McpToolError("Jeton de confirmation invalide ou expiré. Refaire un aperçu sans jeton.");
        }
      }

      if (!(await actionLog.markUndone(record.id, now))) {
        throw new McpToolError("Cette action vient déjà d'être annulée.");
      }
      await applyUndo(record, now, stores);

      return {
        ...proof("annulation", "annulee", record.id, formatDateOnly(resolveDay(undefined, ctx.timeZone, now)), now),
        outil_annule: record.tool,
        effets: effects,
      };
    },
  };
}
