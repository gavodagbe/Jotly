import type { CalendarEvent } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import type {
  AssistantSearchDocumentRecord,
  AssistantSearchDocumentStore,
  AssistantSearchSourceType,
} from "../assistant/assistant-search-document-store";
import { InMemoryCommentStore } from "../comments/comment-store.in-memory";
import type { CalendarEventStore } from "../google-calendar/calendar-event-store";
import { InMemoryNoteStore } from "../notes/note-store.in-memory";
import { addUtcDays } from "../tasks/task-route-helpers";
import { parseDateOnly } from "../tasks/task-store";
import { dayBoundsUtc } from "./mcp-dates";
import { buildHarness, callTool, JOTLY_USER_ID, obtainTokens, TestHarness } from "./mcp-test-helpers";

// Monday 23/11/2026, 20:00 in Paris.
const NOW = new Date("2026-11-23T19:00:00.000Z");
const day = (iso: string) => parseDateOnly(iso) as Date;

/** Minimal search index: substring match over title and body, like a tiny full-text search. */
class FakeSearchStore {
  readonly documents: AssistantSearchDocumentRecord[] = [];

  add(userId: string, sourceType: AssistantSearchSourceType, sourceId: string, title: string, bodyText: string, metadataJson = {}) {
    this.documents.push({
      id: `doc-${this.documents.length + 1}`,
      userId,
      sourceType,
      sourceId,
      title,
      bodyText,
      metadataJson,
      contentHash: "",
      sourceUpdatedAt: NOW,
      extractionStatus: null,
      extractionWarning: null,
      embeddingModel: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
  }

  async listByUser(userId: string, options?: { sourceTypes?: AssistantSearchSourceType[] }) {
    return this.documents.filter(
      (document) => document.userId === userId && (!options?.sourceTypes || options.sourceTypes.includes(document.sourceType))
    );
  }

  async searchDirect(userId: string, query: string, options?: { sourceTypes?: AssistantSearchSourceType[]; limit?: number }) {
    const needle = query.toLowerCase();
    const hits = (await this.listByUser(userId, options)).filter((document) =>
      `${document.title} ${document.bodyText}`.toLowerCase().includes(needle)
    );
    return {
      totalCount: hits.length,
      results: hits.slice(0, options?.limit ?? 20).map((document) => ({
        sourceType: document.sourceType,
        sourceId: document.sourceId,
        title: document.title,
        bodyText: document.bodyText,
        snippet: document.bodyText.slice(0, 80),
        score: 1,
        matchedBy: "fulltext" as const,
        metadataJson: document.metadataJson,
        updatedAt: document.updatedAt,
      })),
    };
  }
}

function meeting(id: string, title: string, start: string, overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id,
    userId: JOTLY_USER_ID,
    connectionId: "c",
    googleEventId: id,
    title,
    description: null,
    location: null,
    startTime: new Date(start),
    endTime: new Date(new Date(start).getTime() + 3_600_000),
    isAllDay: false,
    startDate: null,
    endDate: null,
    status: "confirmed",
    htmlLink: null,
    attendees: "serge@tenbou.test",
    organizer: null,
    recurringEventId: null,
    syncedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

async function setup(reindexCalls: { userId: string; types: string[] }[] = []) {
  const h = await buildHarness(
    {},
    { now: () => NOW, reindex: (userId, types) => reindexCalls.push({ userId, types }) }
  );
  const events = new Map<string, CalendarEvent>([
    ["ev-1", meeting("ev-1", "Point Tenbou", "2026-11-20T09:00:00Z")],
    ["ev-2", meeting("ev-2", "Annulée", "2026-11-21T09:00:00Z", { status: "cancelled" })],
    ["ev-3", meeting("ev-3", "Comité Mikan", "2026-11-23T13:30:00Z", { location: "Visio" })],
    [
      "ev-4",
      meeting("ev-4", "Salon IA", "2026-11-23T00:00:00Z", {
        isAllDay: true,
        startDate: day("2026-11-23"),
        endDate: day("2026-11-25"),
      }),
    ],
  ]);
  // Mirrors the Prisma store: the range END DATE IS EXCLUSIVE, cancelled events are filtered out.
  const overlaps = (event: CalendarEvent, start: Date, endExclusive: Date) =>
    event.isAllDay
      ? (event.startDate as Date) < endExclusive && (event.endDate as Date) > start
      : event.startTime < dayBoundsUtc(endExclusive, "Europe/Paris").start &&
        event.endTime > dayBoundsUtc(start, "Europe/Paris").start;
  const calendarEventStore = {
    async getById(id: string, userId: string) {
      const event = events.get(id);
      return event && event.userId === userId ? event : null;
    },
    async listByDate(date: Date, userId: string) {
      return [...events.values()].filter(
        (event) => event.userId === userId && event.status !== "cancelled" && overlaps(event, date, addUtcDays(date, 1))
      );
    },
    async listByDateRange(start: Date, endExclusive: Date, userId: string) {
      return [...events.values()].filter(
        (event) => event.userId === userId && event.status !== "cancelled" && overlaps(event, start, endExclusive)
      );
    },
  } as unknown as CalendarEventStore;
  const search = new FakeSearchStore();
  const noteStore = new InMemoryNoteStore(events);
  const commentStore = new InMemoryCommentStore();
  h.stores.memory = {
    searchDocumentStore: search as unknown as AssistantSearchDocumentStore,
    noteStore,
    calendarEventStore,
    commentStore,
  };
  const { access_token } = await obtainTokens(h);
  return { h, token: access_token, search, noteStore, commentStore };
}

async function seedTask(h: TestHarness, overrides: Record<string, unknown> = {}) {
  return h.stores.taskStore.create({
    userId: JOTLY_USER_ID,
    title: "Relancer Serge",
    description: null,
    status: "todo",
    targetDate: day("2026-11-23"),
    dueDate: day("2026-11-23"),
    priority: "medium",
    project: "Tenbou",
    plannedTime: null,
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  });
}

test("chercher returns hits with a pointer to the full element, and filters by type", async () => {
  const { h, token, search } = await setup();
  search.add(JOTLY_USER_ID, "note", "note-1", "Proposition Tenbou", "Budget de 40 K€ pour Tenbou");
  search.add(JOTLY_USER_ID, "comment", "com-1", "Commentaire", "Tenbou veut un devis", { taskId: "task-9" });
  search.add(JOTLY_USER_ID, "calendarNote", "cn-1:chunk:2", "Note de réunion", "Tenbou : relancer", { calendarEventId: "ev-1" });
  search.add("someone-else", "note", "note-x", "Tenbou", "Autre utilisateur");

  const { data } = await callTool(h, token, "chercher", { requete: "tenbou" });
  assert.equal(data.total, 3);
  assert.deepEqual(
    data.resultats.map((hit: { type: string; lire_avec: unknown }) => [hit.type, hit.lire_avec]),
    [
      ["note", { type: "note", id: "note-1" }],
      ["commentaire", { type: "tache", id: "task-9" }],
      ["note_reunion", { type: "reunion", id: "ev-1" }],
    ]
  );

  const notesOnly = await callTool(h, token, "chercher", { requete: "tenbou", types: ["notes"] });
  assert.equal(notesOnly.data.total, 1);
  await h.app.close();
});

test("lire_element reads a note with its attachments' extracted text", async () => {
  const { h, token, search, noteStore } = await setup();
  const note = await noteStore.create({ userId: JOTLY_USER_ID, title: "Proposition", body: "<p>Budget <b>40 K€</b></p>" });
  search.add(JOTLY_USER_ID, "noteAttachment", "att-1:chunk:0", "devis.pdf", "Ligne 1", { noteId: note.id });
  search.add(JOTLY_USER_ID, "noteAttachment", "att-1:chunk:1", "devis.pdf", "Ligne 2", { noteId: note.id });

  const { data } = await callTool(h, token, "lire_element", { type: "note", id: note.id });
  assert.equal(data.note.titre, "Proposition");
  assert.match(data.note.texte, /Budget\s+40 K€/);
  assert.deepEqual(data.pieces_jointes, [{ id: "att-1", nom: "devis.pdf", texte_extrait: "Ligne 1\nLigne 2" }]);
  await h.app.close();
});

test("lire_element reads a task with its comments, and a meeting with its note", async () => {
  const { h, token, commentStore, noteStore } = await setup();
  const task = await seedTask(h);
  await commentStore.create({ taskId: task.id, body: "Serge rappelle jeudi" });
  const taskRead = await callTool(h, token, "lire_element", { type: "tache", id: task.id });
  assert.equal(taskRead.data.tache.titre, "Relancer Serge");
  assert.equal(taskRead.data.commentaires[0].texte, "Serge rappelle jeudi");

  await noteStore.create({ userId: JOTLY_USER_ID, body: "Décision : devis avant vendredi", calendarEventId: "ev-1" });
  const meetingRead = await callTool(h, token, "lire_element", { type: "reunion", id: "ev-1" });
  assert.equal(meetingRead.data.reunion.titre, "Point Tenbou");
  assert.equal(meetingRead.data.reunion.debut, "2026-11-20 10:00");
  assert.equal(meetingRead.data.note.texte, "Décision : devis avant vendredi");

  const missing = await callTool(h, token, "lire_element", { type: "note", id: "nope" });
  assert.equal(missing.isError, true);
  await h.app.close();
});

test("lire_agenda includes the last day: a single day (du = au) returns its events", async () => {
  const { h, token, noteStore } = await setup();
  await noteStore.create({ userId: JOTLY_USER_ID, body: "Ordre du jour validé", calendarEventId: "ev-3" });

  // The case that returned nothing in production on 23/11/2026.
  for (const args of [{ du: "2026-11-23", au: "2026-11-23" }, { du: "2026-11-23" }]) {
    const { data } = await callTool(h, token, "lire_agenda", args);
    assert.equal(data.nombre, 2, JSON.stringify(args));
    assert.deepEqual(data.evenements[0], {
      id: "ev-3",
      titre: "Comité Mikan",
      toute_la_journee: false,
      debut: "2026-11-23 14:30",
      fin: "2026-11-23 15:30",
      lieu: "Visio",
      participants: "serge@tenbou.test",
      a_une_note: true,
      extrait_note: "Ordre du jour validé",
    });
    assert.deepEqual(
      { ...data.evenements[1], participants: undefined },
      {
        id: "ev-4",
        titre: "Salon IA",
        toute_la_journee: true,
        du: "2026-11-23",
        au: "2026-11-24",
        lieu: null,
        participants: undefined,
        a_une_note: false,
        extrait_note: null,
      }
    );
  }
  await h.app.close();
});

test("lire_agenda covers a period, skips cancelled events and bounds the range", async () => {
  const { h, token } = await setup();
  const { data } = await callTool(h, token, "lire_agenda", { du: "2026-11-20", au: "2026-11-23" });
  assert.deepEqual(
    data.evenements.map((event: { titre: string }) => event.titre).sort(),
    ["Comité Mikan", "Point Tenbou", "Salon IA"]
  );
  const before = await callTool(h, token, "lire_agenda", { du: "2026-11-16", au: "2026-11-19" });
  assert.equal(before.data.nombre, 0);
  const tooLong = await callTool(h, token, "lire_agenda", { du: "2026-01-01", au: "2026-06-01" });
  assert.equal(tooLong.isError, true);
  await h.app.close();
});

test("lire_journee includes the day's agenda", async () => {
  const { h, token } = await setup();
  const { data } = await callTool(h, token, "lire_journee");
  assert.deepEqual(
    data.agenda.map((event: { titre: string }) => event.titre).sort(),
    ["Comité Mikan", "Salon IA"]
  );

  const noAgenda = await buildHarness({}, { now: () => NOW });
  const fresh = (await obtainTokens(noAgenda)).access_token;
  const without = await callTool(noAgenda, fresh, "lire_journee");
  assert.match(without.data.agenda.indisponible, /pas connecté/);
  await noAgenda.app.close();
  await h.app.close();
});

test("reporter_tache copies one open task to tomorrow, once, and refuses finished tasks", async () => {
  const { h, token } = await setup();
  const task = await seedTask(h);
  const first = await callTool(h, token, "reporter_tache", { id: task.id });
  assert.equal(first.data.preuve.action, "reportee");
  assert.equal(first.data.preuve.date, "2026-11-24");
  assert.ok(first.data.preuve.action_id);
  assert.equal(first.data.tache.reportee_depuis, task.id);
  assert.equal((await h.stores.taskStore.getById(task.id, JOTLY_USER_ID))?.status, "todo", "the original stays in history");

  const second = await callTool(h, token, "reporter_tache", { id: task.id });
  assert.equal(second.data.preuve.action, "deja_reportee");
  assert.equal(second.data.preuve.id, first.data.preuve.id);

  const done = await seedTask(h, { title: "Faite", status: "done", completedAt: NOW });
  const refused = await callTool(h, token, "reporter_tache", { id: done.id });
  assert.match(refused.data.erreur, /faite/);
  await h.app.close();
});

test("lire_tendances compares weeks from oldest to most recent", async () => {
  const { h, token } = await setup();
  await seedTask(h, { targetDate: day("2026-11-10"), status: "done", completedAt: NOW });
  await seedTask(h, { targetDate: day("2026-11-11") });
  await seedTask(h, { targetDate: day("2026-11-23"), status: "done", completedAt: NOW });
  await h.stores.dayBilanStore.upsert({
    userId: JOTLY_USER_ID,
    targetDate: day("2026-11-12"),
    mood: 2,
    wins: null,
    blockers: null,
    lessonsLearned: null,
    tomorrowTop3: null,
  });

  const { data } = await callTool(h, token, "lire_tendances", { semaines: 3 });
  assert.deepEqual(
    data.semaines.map((week: { semaine: string; taches: number; taux_realisation: number | null; humeur_moyenne: number | null; en_cours: boolean }) => [
      week.semaine,
      week.taches,
      week.taux_realisation,
      week.humeur_moyenne,
      week.en_cours,
    ]),
    [
      ["2026-S46", 2, 0.5, 2, false],
      ["2026-S47", 0, null, null, false],
      ["2026-S48", 1, 1, null, true],
    ]
  );
  await h.app.close();
});

test("successful writes trigger a scoped reindex; reads and refusals do not", async () => {
  const calls: { userId: string; types: string[] }[] = [];
  const { h, token } = await setup(calls);
  await callTool(h, token, "lire_journee");
  await callTool(h, token, "creer_tache", { titre: "Nouvelle" });
  await callTool(h, token, "ecrire_bilan", { humeur: 4 });
  await callTool(h, token, "terminer_tache", { id: "inconnue" });
  assert.deepEqual(calls, [
    { userId: JOTLY_USER_ID, types: ["task"] },
    { userId: JOTLY_USER_ID, types: ["bilan"] },
  ]);
  await h.app.close();
});

test("memory tools explain when search is not available", async () => {
  const h = await buildHarness({}, { now: () => NOW });
  const { access_token } = await obtainTokens(h);
  const result = await callTool(h, access_token, "chercher", { requete: "tenbou" });
  assert.equal(result.isError, true);
  assert.match(result.data.erreur, /pas disponible/);
  await h.app.close();
});
