import assert from "node:assert/strict";
import test from "node:test";
import { parseDateOnly } from "../tasks/task-store";
import { buildHarness, callTool, JOTLY_USER_ID, obtainTokens, TestHarness } from "./mcp-test-helpers";

const START = new Date("2026-11-23T09:00:00.000Z");
const day = (iso: string) => parseDateOnly(iso) as Date;

async function setup(): Promise<{ h: TestHarness; token: string; clock: { now: Date } }> {
  const clock = { now: START };
  const h = await buildHarness({}, { now: () => clock.now });
  const { access_token } = await obtainTokens(h);
  return { h, token: access_token, clock };
}

test("every write proof carries an action_id, and undoing a created task cancels it once", async () => {
  const { h, token } = await setup();
  const created = await callTool(h, token, "creer_tache", { titre: "Créée par erreur" });
  const actionId = created.data.preuve.action_id;
  assert.ok(actionId);

  const undone = await callTool(h, token, "annuler", { action_id: actionId });
  assert.equal(undone.isError, false);
  assert.equal(undone.data.preuve.type, "annulation");
  assert.equal(undone.data.outil_annule, "creer_tache");
  const task = await h.stores.taskStore.getById(created.data.preuve.id, JOTLY_USER_ID);
  assert.equal(task?.status, "cancelled", "cancelled, not deleted");

  const again = await callTool(h, token, "annuler", { action_id: actionId });
  assert.equal(again.isError, true);
  assert.match(again.data.erreur, /déjà été annulée/);
  await h.app.close();
});

test("undoing modifier_tache restores the previous values", async () => {
  const { h, token } = await setup();
  const { data } = await callTool(h, token, "creer_tache", { titre: "Avant", priorite: "low" });
  const id = data.preuve.id;
  const modified = await callTool(h, token, "modifier_tache", { id, titre: "Après", priorite: "high", statut: "done" });

  await callTool(h, token, "annuler", { action_id: modified.data.preuve.action_id });
  const task = await h.stores.taskStore.getById(id, JOTLY_USER_ID);
  assert.equal(task?.title, "Avant");
  assert.equal(task?.priority, "low");
  assert.equal(task?.status, "todo");
  assert.equal(task?.completedAt, null);
  await h.app.close();
});

test("undo is refused, with nothing changed, when the entity was modified since", async () => {
  const { h, token } = await setup();
  const { data } = await callTool(h, token, "creer_tache", { titre: "Tâche" });
  await h.stores.taskStore.update(data.preuve.id, { title: "Renommée dans Jotly" }, JOTLY_USER_ID);

  const result = await callTool(h, token, "annuler", { action_id: data.preuve.action_id });
  assert.equal(result.isError, true);
  assert.match(result.data.erreur, /modifiée depuis/);
  const task = await h.stores.taskStore.getById(data.preuve.id, JOTLY_USER_ID);
  assert.equal(task?.status, "todo");
  assert.equal(task?.title, "Renommée dans Jotly");
  await h.app.close();
});

test("undoing a bulk creation needs a preview and Godwin's confirmation", async () => {
  const { h, token } = await setup();
  const preview = await callTool(h, token, "creer_taches", { taches: [{ titre: "A" }, { titre: "B" }] });
  const created = await callTool(h, token, "creer_taches", {
    taches: [{ titre: "A" }, { titre: "B" }],
    jeton_confirmation: preview.data.jeton_confirmation,
  });
  const actionId = created.data.preuve.action_id;

  const undoPreview = await callTool(h, token, "annuler", { action_id: actionId });
  assert.equal(undoPreview.data.apercu, true);
  assert.equal(undoPreview.data.effets.length, 2);
  assert.ok((await h.stores.taskStore.listByUser(JOTLY_USER_ID)).every((task) => task.status === "todo"));

  const forged = await callTool(h, token, "annuler", { action_id: actionId, jeton_confirmation: "x.y" });
  assert.equal(forged.isError, true);

  const undone = await callTool(h, token, "annuler", {
    action_id: actionId,
    jeton_confirmation: undoPreview.data.jeton_confirmation,
  });
  assert.equal(undone.isError, false);
  assert.ok((await h.stores.taskStore.listByUser(JOTLY_USER_ID)).every((task) => task.status === "cancelled"));
  await h.app.close();
});

test("undoing an objective publication restores the objectives typed in Jotly", async () => {
  const { h, token } = await setup();
  await h.stores.weeklyEntryStore.upsert({ userId: JOTLY_USER_ID, year: 2026, isoWeek: 49, objective: "Mon objectif" });
  const request = {
    publications: [
      { periode: "mois", cle: "2026-12", objectifs: ["Holding"] },
      { periode: "semaine", cle: "2026-S49", objectifs: ["Expert-comptable"] },
    ],
    note_source: "Plan annuel 2026",
  };
  const preview = await callTool(h, token, "publier_objectifs", request);
  const published = await callTool(h, token, "publier_objectifs", { ...request, jeton_confirmation: preview.data.jeton_confirmation });

  const undoPreview = await callTool(h, token, "annuler", { action_id: published.data.preuve.action_id });
  await callTool(h, token, "annuler", {
    action_id: published.data.preuve.action_id,
    jeton_confirmation: undoPreview.data.jeton_confirmation,
  });
  assert.equal((await h.stores.weeklyEntryStore.getByWeek(2026, 49, JOTLY_USER_ID))?.objective, "Mon objectif");
  assert.equal((await h.stores.monthlyEntryStore.getByMonth(2026, 12, JOTLY_USER_ID))?.objective, null);
  await h.app.close();
});

test("affirmation: an update can be undone, a creation cannot (it would need a deletion)", async () => {
  const { h, token } = await setup();
  const created = await callTool(h, token, "ecrire_affirmation", { texte: "Première" });
  const refused = await callTool(h, token, "annuler", { action_id: created.data.preuve.action_id });
  assert.equal(refused.isError, true);
  assert.match(refused.data.erreur, /sans suppression/);

  const updated = await callTool(h, token, "ecrire_affirmation", { texte: "Seconde", faite: true });
  await callTool(h, token, "annuler", { action_id: updated.data.preuve.action_id });
  const affirmation = await h.stores.dayAffirmationStore.getByDate(day("2026-11-23"), JOTLY_USER_ID);
  assert.equal(affirmation?.text, "Première");
  assert.equal(affirmation?.isCompleted, false);
  await h.app.close();
});

test("undoing a new bilan empties it; undoing a reminder cancels it", async () => {
  const { h, token } = await setup();
  const bilan = await callTool(h, token, "ecrire_bilan", { humeur: 2, blocages: "Fatigue" });
  await callTool(h, token, "annuler", { action_id: bilan.data.preuve.action_id });
  const stored = await h.stores.dayBilanStore.getByDate(day("2026-11-23"), JOTLY_USER_ID);
  assert.equal(stored?.mood, null);
  assert.equal(stored?.blockers, null);

  const reminder = await callTool(h, token, "creer_rappel", { titre: "Appel", quand: "2026-11-26T09:00" });
  await callTool(h, token, "annuler", { action_id: reminder.data.preuve.action_id });
  assert.equal((await h.stores.reminderStore.getById(reminder.data.preuve.id, JOTLY_USER_ID))?.status, "cancelled");
  await h.app.close();
});

test("undo is limited to 7 days and to the caller's own actions", async () => {
  const { h, token, clock } = await setup();
  const { data } = await callTool(h, token, "creer_tache", { titre: "Ancienne" });

  clock.now = new Date(START.getTime() + 8 * 24 * 60 * 60 * 1000);
  // The 1-hour access token has expired too: reconnect, as a client would.
  const fresh = (await obtainTokens(h)).access_token;
  const late = await callTool(h, fresh, "annuler", { action_id: data.preuve.action_id });
  assert.equal(late.isError, true);
  assert.match(late.data.erreur, /plus de 7 jours/);

  const unknown = await callTool(h, fresh, "annuler", { action_id: "action-999" });
  assert.match(unknown.data.erreur, /Action inconnue/);

  // The undo log is never visible across users.
  const foreignId = await h.actionLog.create({ userId: "someone-else", clientId: null, tool: "creer_tache", changes: [] });
  const foreign = await callTool(h, fresh, "annuler", { action_id: foreignId });
  assert.match(foreign.data.erreur, /Action inconnue/);
  await h.app.close();
});
