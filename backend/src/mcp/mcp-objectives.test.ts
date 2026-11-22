import assert from "node:assert/strict";
import test from "node:test";
import { isoWeekOf, isoWeekRange, isoWeeksInYear } from "./mcp-dates";
import { buildHarness, callTool, JOTLY_USER_ID, obtainTokens, TestHarness } from "./mcp-test-helpers";

// Monday 23/11/2026, 09:00 in Paris — ISO week 2026-W48.
const NOW = new Date("2026-11-23T08:00:00.000Z");

async function setup(): Promise<{ h: TestHarness; token: string }> {
  const h = await buildHarness({}, { now: () => NOW });
  const { access_token } = await obtainTokens(h);
  return { h, token: access_token };
}

const DECEMBER = {
  publications: [
    { periode: "mois", cle: "2026-12", objectifs: ["Clôturer l'année à 250 K€", "Holding immatriculée"] },
    { periode: "semaine", cle: "2026-S49", objectifs: ["Rendez-vous expert-comptable"] },
  ],
  note_source: "Plan annuel 2026",
};

test("ISO week helpers follow ISO 8601", () => {
  assert.deepEqual(isoWeekOf(new Date(Date.UTC(2026, 10, 23))), { year: 2026, week: 48 });
  assert.deepEqual(isoWeekOf(new Date(Date.UTC(2027, 0, 1))), { year: 2026, week: 53 });
  assert.equal(isoWeeksInYear(2026), 53);
  assert.equal(isoWeeksInYear(2027), 52);
  const range = isoWeekRange(2026, 49);
  assert.equal(range.start.toISOString().slice(0, 10), "2026-11-30");
  assert.equal(range.end.toISOString().slice(0, 10), "2026-12-06");
});

test("publier_objectifs previews without writing, then writes into the existing month and week fields", async () => {
  const { h, token } = await setup();
  const preview = await callTool(h, token, "publier_objectifs", DECEMBER);
  assert.equal(preview.isError, false);
  assert.equal(preview.data.apercu, true);
  assert.equal(preview.data.periodes.length, 2);
  assert.equal(preview.data.periodes[0].avant, null);
  assert.match(preview.data.periodes[0].apres.texte, /- Clôturer l'année à 250 K€\n- Holding immatriculée/);
  assert.equal(await h.stores.monthlyEntryStore.getByMonth(2026, 12, JOTLY_USER_ID), null);

  const done = await callTool(h, token, "publier_objectifs", {
    ...DECEMBER,
    jeton_confirmation: preview.data.jeton_confirmation,
  });
  assert.equal(done.isError, false);
  assert.equal(done.data.preuve.type, "objectifs");
  assert.equal(done.data.preuve.date, "2026-11-23");

  const month = await h.stores.monthlyEntryStore.getByMonth(2026, 12, JOTLY_USER_ID);
  assert.match(month?.objective ?? "", /^\[Coffre Vision\] publié le 23\/11\/2026 depuis « Plan annuel 2026 »/);
  const week = await h.stores.weeklyEntryStore.getByWeek(2026, 49, JOTLY_USER_ID);
  assert.match(week?.objective ?? "", /- Rendez-vous expert-comptable$/);
  assert.equal(done.data.preuve.id, `${month?.id},${week?.id}`);
  await h.app.close();
});

test("publier_objectifs refuses a token reused with different content or after the target changed", async () => {
  const { h, token } = await setup();
  const preview = await callTool(h, token, "publier_objectifs", DECEMBER);

  const tampered = await callTool(h, token, "publier_objectifs", {
    ...DECEMBER,
    publications: [{ periode: "mois", cle: "2026-12", objectifs: ["Autre chose"] }],
    jeton_confirmation: preview.data.jeton_confirmation,
  });
  assert.equal(tampered.isError, true);

  // Godwin edits the month in Jotly between preview and confirmation.
  await h.stores.monthlyEntryStore.upsert({ userId: JOTLY_USER_ID, year: 2026, month: 12, objective: "Saisi à la main" });
  const stale = await callTool(h, token, "publier_objectifs", {
    ...DECEMBER,
    jeton_confirmation: preview.data.jeton_confirmation,
  });
  assert.equal(stale.isError, true);
  assert.match(stale.data.erreur, /changé depuis l'aperçu/);
  await h.app.close();
});

test("the preview flags an objective typed in Jotly that would be replaced", async () => {
  const { h, token } = await setup();
  await h.stores.weeklyEntryStore.upsert({ userId: JOTLY_USER_ID, year: 2026, isoWeek: 49, objective: "Mon objectif" });
  const preview = await callTool(h, token, "publier_objectifs", DECEMBER);
  const week = preview.data.periodes[1];
  assert.deepEqual(week.avant, { origine: "jotly", entete: null, texte: "Mon objectif" });
  assert.equal(week.remplace_un_objectif_saisi_dans_jotly, true);
  assert.equal(preview.data.periodes[0].remplace_un_objectif_saisi_dans_jotly, false);
  await h.app.close();
});

test("publier_objectifs rejects invalid period keys and duplicates", async () => {
  const { h, token } = await setup();
  for (const publication of [
    { periode: "mois", cle: "2026-13", objectifs: ["x"] },
    { periode: "semaine", cle: "2027-S53", objectifs: ["x"] },
    { periode: "semaine", cle: "décembre", objectifs: ["x"] },
  ]) {
    const result = await callTool(h, token, "publier_objectifs", { publications: [publication], note_source: "n" });
    assert.equal(result.isError, true, publication.cle);
  }
  const duplicate = await callTool(h, token, "publier_objectifs", {
    publications: [
      { periode: "semaine", cle: "2026-S49", objectifs: ["a"] },
      { periode: "semaine", cle: "2026-W49", objectifs: ["b"] },
    ],
    note_source: "n",
  });
  assert.match(duplicate.data.erreur, /deux fois/);
  await h.app.close();
});

test("lire_objectifs and lire_journee show the week and month covering the day, with their origin", async () => {
  const { h, token } = await setup();
  await h.stores.weeklyEntryStore.upsert({ userId: JOTLY_USER_ID, year: 2026, isoWeek: 48, objective: "Saisi dans Jotly" });
  await h.stores.monthlyEntryStore.upsert({
    userId: JOTLY_USER_ID,
    year: 2026,
    month: 11,
    objective: "[Coffre Vision] publié le 01/11/2026 depuis « Plan annuel 2026 ».\n- Holding",
  });

  const { data } = await callTool(h, token, "lire_objectifs");
  assert.equal(data.date, "2026-11-23");
  assert.deepEqual(data.semaine, {
    cle: "2026-S48",
    du: "2026-11-23",
    au: "2026-11-29",
    objectif: { origine: "jotly", entete: null, texte: "Saisi dans Jotly" },
  });
  assert.equal(data.mois.cle, "2026-11");
  assert.equal(data.mois.objectif.origine, "coffre");
  assert.equal(data.mois.objectif.texte, "- Holding");

  const day = await callTool(h, token, "lire_journee");
  assert.deepEqual(day.data.objectifs, { mois: data.mois, semaine: data.semaine });
  await h.app.close();
});
