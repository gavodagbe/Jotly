import assert from "node:assert/strict";
import test from "node:test";
import { parseDateOnly } from "../tasks/task-store";
import { buildHarness, callTool, JOTLY_USER_ID, obtainTokens, TestHarness } from "./mcp-test-helpers";

// Sunday 22/11/2026, 23:30 in Paris (UTC+1) — still the 22nd locally, already late evening.
const NOW = new Date("2026-11-22T22:30:00.000Z");

async function setup(): Promise<{ h: TestHarness; token: string }> {
  const h = await buildHarness({}, { now: () => NOW });
  const { access_token } = await obtainTokens(h);
  return { h, token: access_token };
}

async function seedTask(h: TestHarness, overrides: Record<string, unknown> = {}) {
  return h.stores.taskStore.create({
    userId: JOTLY_USER_ID,
    title: "Préparer la proposition",
    description: null,
    status: "todo",
    targetDate: parseDateOnly("2026-11-22") as Date,
    dueDate: parseDateOnly("2026-11-22") as Date,
    priority: "medium",
    project: null,
    plannedTime: null,
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  });
}

test("creer_tache defaults to today in the user's time zone and returns a proof", async () => {
  const { h, token } = await setup();
  const { data, isError } = await callTool(h, token, "creer_tache", { titre: "Appeler le notaire", priorite: "high" });

  assert.equal(isError, false);
  assert.equal(data.preuve.type, "tache");
  assert.equal(data.preuve.action, "creee");
  assert.equal(data.preuve.date, "2026-11-22");
  assert.equal(data.preuve.horodatage, NOW.toISOString());
  const stored = await h.stores.taskStore.getById(data.preuve.id, JOTLY_USER_ID);
  assert.equal(stored?.title, "Appeler le notaire");
  assert.equal(stored?.priority, "high");
  assert.equal(stored?.status, "todo");
  await h.app.close();
});

test("creer_tache resolves a project by name and lists the options when unknown", async () => {
  const { h, token } = await setup();
  const parent = await h.stores.projectStore.create({ userId: JOTLY_USER_ID, name: "Tenbou" });
  await h.stores.projectStore.create({ userId: JOTLY_USER_ID, name: "Site web", parentId: parent.id });

  const ok = await callTool(h, token, "creer_tache", { titre: "Maquette", projet: "tenbou > site web" });
  assert.equal(ok.isError, false);
  assert.equal(ok.data.tache.projet, "Tenbou > Site web");

  const unknown = await callTool(h, token, "creer_tache", { titre: "X", projet: "Inconnu" });
  assert.equal(unknown.isError, true);
  assert.match(unknown.data.erreur, /Projet inconnu « Inconnu ».*Tenbou, Tenbou > Site web/);
  await h.app.close();
});

test("terminer_tache marks done once, then reports it was already done", async () => {
  const { h, token } = await setup();
  const task = await seedTask(h);

  const first = await callTool(h, token, "terminer_tache", { id: task.id });
  assert.equal(first.data.preuve.action, "faite");
  assert.equal(first.data.avant.statut, "todo");
  const stored = await h.stores.taskStore.getById(task.id, JOTLY_USER_ID);
  assert.equal(stored?.status, "done");
  assert.ok(stored?.completedAt);

  const second = await callTool(h, token, "terminer_tache", { id: task.id });
  assert.equal(second.data.preuve.action, "deja_faite");
  await h.app.close();
});

test("tools refuse tasks that do not belong to the Jotly user", async () => {
  const { h, token } = await setup();
  const foreign = await seedTask(h, { userId: "someone-else" });
  const result = await callTool(h, token, "terminer_tache", { id: foreign.id });
  assert.equal(result.isError, true);
  assert.match(result.data.erreur, /introuvable/);
  assert.equal((await h.stores.taskStore.getById(foreign.id, "someone-else"))?.status, "todo");
  await h.app.close();
});

test("modifier_tache returns only the changed fields, before and after; cancelled is allowed", async () => {
  const { h, token } = await setup();
  const task = await seedTask(h);
  const { data } = await callTool(h, token, "modifier_tache", {
    id: task.id,
    statut: "cancelled",
    priorite: "low",
    titre: "Préparer la proposition",
  });

  assert.equal(data.preuve.action, "modifiee");
  assert.deepEqual(data.avant, { statut: "todo", priorite: "medium" });
  assert.deepEqual(data.apres, { statut: "cancelled", priorite: "low" });
  assert.ok((await h.stores.taskStore.getById(task.id, JOTLY_USER_ID))?.cancelledAt);

  const empty = await callTool(h, token, "modifier_tache", { id: task.id });
  assert.equal(empty.isError, true);
  await h.app.close();
});

test("ecrire_affirmation creates, then updates with the previous text as proof of undo", async () => {
  const { h, token } = await setup();
  const created = await callTool(h, token, "ecrire_affirmation", { texte: "Je suis calme et efficace." });
  assert.equal(created.data.preuve.action, "creee");
  assert.equal(created.data.avant, null);

  const done = await callTool(h, token, "ecrire_affirmation", { faite: true });
  assert.equal(done.data.preuve.action, "modifiee");
  assert.equal(done.data.affirmation.faite, true);
  assert.deepEqual(done.data.avant, { texte: "Je suis calme et efficace.", faite: false });

  const read = await callTool(h, token, "lire_affirmation");
  assert.equal(read.data.affirmation.texte, "Je suis calme et efficace.");
  assert.equal(read.data.date, "2026-11-22");
  await h.app.close();
});

test("lire_journee gathers tasks, counters, affirmation, alerts and the day's reminders", async () => {
  const { h, token } = await setup();
  await seedTask(h, { title: "Faite", status: "done", completedAt: NOW });
  await seedTask(h, { title: "Urgente", priority: "high" });
  await seedTask(h, {
    title: "En retard",
    targetDate: parseDateOnly("2026-11-20") as Date,
    dueDate: parseDateOnly("2026-11-20") as Date,
  });
  await callTool(h, token, "ecrire_affirmation", { texte: "Un pas après l'autre." });
  // 23:45 Paris on the 22nd is 22:45Z; 00:15 Paris on the 23rd is 23:15Z (next day).
  await h.stores.reminderStore.create({ userId: JOTLY_USER_ID, title: "Ce soir", remindAt: new Date("2026-11-22T22:45:00Z") });
  await h.stores.reminderStore.create({ userId: JOTLY_USER_ID, title: "Demain", remindAt: new Date("2026-11-22T23:15:00Z") });

  const { data } = await callTool(h, token, "lire_journee");
  assert.equal(data.date, "2026-11-22");
  assert.equal(data.fuseau, "Europe/Paris");
  assert.deepEqual(data.compteurs, { total: 2, a_faire: 1, en_cours: 0, faites: 1, annulees: 0 });
  assert.deepEqual(data.taches.map((task: { titre: string }) => task.titre), ["Urgente", "Faite"]);
  assert.equal(data.affirmation.texte, "Un pas après l'autre.");
  assert.equal(data.bilan, null);
  assert.equal(data.alertes.en_retard, 1);
  assert.equal(data.alertes.echeances_aujourdhui, 1);
  assert.deepEqual(data.rappels.map((reminder: { titre: string; quand: string }) => [reminder.titre, reminder.quand]), [
    ["Ce soir", "2026-11-22 23:45"],
  ]);
  await h.app.close();
});

test("creer_rappel reads a local time in the user's time zone and refuses past times", async () => {
  const { h, token } = await setup();
  const { data } = await callTool(h, token, "creer_rappel", { titre: "Appeler Mikan", quand: "2026-11-26T09:00" });
  assert.equal(data.preuve.type, "rappel");
  assert.equal(data.preuve.date, "2026-11-26");
  assert.equal(data.rappel.quand_utc, "2026-11-26T08:00:00.000Z");
  assert.equal(data.rappel.quand, "2026-11-26 09:00");

  // Summer time: 09:00 Paris is 07:00Z.
  const summer = await callTool(h, token, "creer_rappel", { titre: "Été", quand: "2027-07-01T09:00" });
  assert.equal(summer.data.rappel.quand_utc, "2027-07-01T07:00:00.000Z");

  const past = await callTool(h, token, "creer_rappel", { titre: "Trop tard", quand: "2026-11-22T08:00" });
  assert.equal(past.isError, true);
  assert.match(past.data.erreur, /déjà passée/);

  const invalid = await callTool(h, token, "creer_rappel", { titre: "?", quand: "jeudi prochain 9h" });
  assert.equal(invalid.isError, true);
  await h.app.close();
});

test("reporter_taches_veille previews without writing, then copies only with a valid confirmation", async () => {
  const { h, token } = await setup();
  const yesterday = { targetDate: parseDateOnly("2026-11-21") as Date, dueDate: parseDateOnly("2026-11-21") as Date };
  await seedTask(h, { ...yesterday, title: "Ouverte" });
  await seedTask(h, { ...yesterday, title: "Faite hier", status: "done", completedAt: NOW });

  const preview = await callTool(h, token, "reporter_taches_veille");
  assert.equal(preview.data.apercu, true);
  assert.equal(preview.data.modifie, false);
  assert.equal(preview.data.depuis, "2026-11-21");
  assert.equal(preview.data.nombre, 1);
  assert.ok(preview.data.jeton_confirmation);
  assert.equal((await h.stores.taskStore.listByDate(parseDateOnly("2026-11-22") as Date, JOTLY_USER_ID)).length, 0);

  const forged = await callTool(h, token, "reporter_taches_veille", { jeton_confirmation: "abc.def" });
  assert.equal(forged.isError, true);

  const confirmed = await callTool(h, token, "reporter_taches_veille", {
    jeton_confirmation: preview.data.jeton_confirmation,
  });
  assert.equal(confirmed.isError, false);
  assert.equal(confirmed.data.preuve.type, "report");
  assert.equal(confirmed.data.copiees, 1);
  const today = await h.stores.taskStore.listByDate(parseDateOnly("2026-11-22") as Date, JOTLY_USER_ID);
  assert.deepEqual(today.map((task) => task.title), ["Ouverte"]);
  await h.app.close();
});

test("reporter_taches_veille rejects a confirmation once the list has changed", async () => {
  const { h, token } = await setup();
  const yesterday = { targetDate: parseDateOnly("2026-11-21") as Date, dueDate: parseDateOnly("2026-11-21") as Date };
  await seedTask(h, { ...yesterday, title: "A" });
  const preview = await callTool(h, token, "reporter_taches_veille");
  await seedTask(h, { ...yesterday, title: "B ajoutée après l'aperçu" });

  const result = await callTool(h, token, "reporter_taches_veille", {
    jeton_confirmation: preview.data.jeton_confirmation,
  });
  assert.equal(result.isError, true);
  assert.match(result.data.erreur, /la liste a changé/);
  await h.app.close();
});
