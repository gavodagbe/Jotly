import assert from "node:assert/strict";
import test from "node:test";
import { parseDateOnly } from "../tasks/task-store";
import { buildHarness, callTool, JOTLY_USER_ID, obtainTokens, TestHarness } from "./mcp-test-helpers";

// Sunday 22/11/2026, 21:00 in Paris — evening review time, ISO week 2026-W47.
const NOW = new Date("2026-11-22T20:00:00.000Z");
const day = (iso: string) => parseDateOnly(iso) as Date;

async function setup(): Promise<{ h: TestHarness; token: string }> {
  const h = await buildHarness({}, { now: () => NOW });
  const { access_token } = await obtainTokens(h);
  return { h, token: access_token };
}

async function seedTask(h: TestHarness, overrides: Record<string, unknown>) {
  return h.stores.taskStore.create({
    userId: JOTLY_USER_ID,
    title: "Tâche",
    description: null,
    status: "todo",
    targetDate: day("2026-11-22"),
    dueDate: null,
    priority: "medium",
    project: null,
    plannedTime: null,
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  });
}

test("ecrire_bilan creates the day's bilan, then merges only the fields provided", async () => {
  const { h, token } = await setup();
  const first = await callTool(h, token, "ecrire_bilan", { humeur: 4, victoires: "Proposition envoyée" });
  assert.equal(first.isError, false);
  assert.equal(first.data.preuve.type, "bilan");
  assert.equal(first.data.preuve.action, "cree");
  assert.equal(first.data.preuve.date, "2026-11-22");
  assert.equal(first.data.avant, null);

  const second = await callTool(h, token, "ecrire_bilan", { blocages: "Réseau lent", victoires: "" });
  assert.equal(second.data.preuve.action, "modifie");
  assert.deepEqual(second.data.bilan, {
    humeur_sur_5: 4,
    victoires: null,
    blocages: "Réseau lent",
    lecons: null,
    top3_demain: null,
  });
  assert.equal(second.data.avant.victoires, "Proposition envoyée");

  const empty = await callTool(h, token, "ecrire_bilan", {});
  assert.equal(empty.isError, true);
  await h.app.close();
});

test("creer_taches previews resolved tasks, then creates them all only with the matching token", async () => {
  const { h, token } = await setup();
  await h.stores.projectStore.create({ userId: JOTLY_USER_ID, name: "Tenbou" });
  const request = {
    date: "2026-11-23",
    taches: [
      { titre: "Relancer Serge", priorite: "high", projet: "Tenbou" },
      { titre: "Préparer le point hebdo", duree_prevue_min: 30 },
    ],
  };

  const preview = await callTool(h, token, "creer_taches", request);
  assert.equal(preview.data.apercu, true);
  assert.deepEqual(preview.data.taches[0], {
    titre: "Relancer Serge",
    date: "2026-11-23",
    echeance: "2026-11-23",
    priorite: "high",
    projet: "Tenbou",
    duree_prevue_min: null,
  });
  assert.equal((await h.stores.taskStore.listByDate(day("2026-11-23"), JOTLY_USER_ID)).length, 0);

  const changed = await callTool(h, token, "creer_taches", {
    ...request,
    taches: [...request.taches, { titre: "Ajoutée en douce" }],
    jeton_confirmation: preview.data.jeton_confirmation,
  });
  assert.equal(changed.isError, true);

  const done = await callTool(h, token, "creer_taches", { ...request, jeton_confirmation: preview.data.jeton_confirmation });
  assert.equal(done.isError, false);
  assert.equal(done.data.preuve.type, "taches");
  assert.equal(done.data.nombre, 2);
  const created = await h.stores.taskStore.listByDate(day("2026-11-23"), JOTLY_USER_ID);
  assert.deepEqual(created.map((task) => task.title).sort(), ["Préparer le point hebdo", "Relancer Serge"]);
  await h.app.close();
});

test("creer_taches validates every task before writing anything", async () => {
  const { h, token } = await setup();
  const result = await callTool(h, token, "creer_taches", {
    taches: [{ titre: "Valide" }, { titre: "Projet inconnu", projet: "Nulle part" }],
  });
  assert.equal(result.isError, true);
  assert.match(result.data.erreur, /Projet inconnu/);
  assert.equal((await h.stores.taskStore.listByUser(JOTLY_USER_ID)).length, 0);
  await h.app.close();
});

test("lire_periode summarizes the current week: tasks, affirmations, bilans, objective", async () => {
  const { h, token } = await setup();
  await seedTask(h, { title: "Faite lundi", status: "done", targetDate: day("2026-11-16"), completedAt: NOW });
  await seedTask(h, { title: "Ouverte", targetDate: day("2026-11-20"), project: "Tenbou" });
  await seedTask(h, { title: "Annulée", status: "cancelled", targetDate: day("2026-11-21"), cancelledAt: NOW });
  await seedTask(h, { title: "Reportée", targetDate: day("2026-11-22"), rolledFromTaskId: "x", project: "Tenbou" });
  await seedTask(h, { title: "Hors semaine", targetDate: day("2026-11-23") });
  await h.stores.dayAffirmationStore.upsert({
    userId: JOTLY_USER_ID,
    targetDate: day("2026-11-17"),
    text: "Calme",
    isCompleted: true,
    completedAt: NOW,
  });
  await h.stores.dayBilanStore.upsert({
    userId: JOTLY_USER_ID,
    targetDate: day("2026-11-18"),
    mood: 3,
    wins: "Contrat signé",
    blockers: null,
    lessonsLearned: null,
    tomorrowTop3: null,
  });
  await h.stores.dayBilanStore.upsert({
    userId: JOTLY_USER_ID,
    targetDate: day("2026-11-19"),
    mood: 4,
    wins: null,
    blockers: null,
    lessonsLearned: null,
    tomorrowTop3: null,
  });
  await h.stores.weeklyEntryStore.upsert({ userId: JOTLY_USER_ID, year: 2026, isoWeek: 47, objective: "Signer Tenbou", review: "Bonne semaine" });

  const { data } = await callTool(h, token, "lire_periode", { periode: "semaine" });
  assert.equal(data.cle, "2026-S47");
  assert.equal(data.du, "2026-11-16");
  assert.equal(data.au, "2026-11-22");
  assert.equal(data.taches.total, 4);
  assert.equal(data.taches.faites, 1);
  assert.equal(data.taches.annulees, 1);
  assert.equal(data.taches.reportees_depuis_la_veille, 1);
  assert.equal(data.taches.taux_realisation, 0.33);
  assert.deepEqual(data.taches.par_projet[0], { projet: "Tenbou", total: 2, faites: 0 });
  assert.deepEqual(data.affirmations, { jours_avec_affirmation: 1, jours_faites: 1, sur_jours: 7 });
  assert.equal(data.bilans.jours_avec_bilan, 2);
  assert.equal(data.bilans.humeur_moyenne, 3.5);
  assert.equal(data.objectif.texte, "Signer Tenbou");
  assert.equal(data.revue, "Bonne semaine");
  await h.app.close();
});

test("lire_periode reads a given month and rejects invalid keys", async () => {
  const { h, token } = await setup();
  await seedTask(h, { title: "Février", targetDate: day("2026-02-28") });
  const { data } = await callTool(h, token, "lire_periode", { periode: "mois", cle: "2026-02" });
  assert.equal(data.du, "2026-02-01");
  assert.equal(data.au, "2026-02-28");
  assert.equal(data.taches.total, 1);
  assert.equal(data.affirmations.sur_jours, 28);

  const invalid = await callTool(h, token, "lire_periode", { periode: "semaine", cle: "2026-S60" });
  assert.equal(invalid.isError, true);
  await h.app.close();
});
