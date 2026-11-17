import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createTaskComment, deleteTaskComment, loadTaskComments } from "./comment-repository";
import { JotlyOfflineDb } from "./db";
import { getIsoWeek } from "./journal-local";
import {
  loadDayAffirmation,
  loadWeeklyEntry,
  upsertDayAffirmation,
  upsertDayBilan,
  upsertWeeklyEntry,
} from "./journal-repository";
import { countOutbox } from "./outbox";
import { calculatePercentages, getMonthDays } from "./routine-local";
import {
  createRoutineApi,
  deleteRoutineApi,
  loadRoutineMonth,
  updateRoutineApi,
  upsertRoutineCompletionApi,
} from "./routine-repository";
import { clearOfflineSessionState, getOfflineSession, setOfflineSession } from "./session";
import { syncNow } from "./sync-engine";
import { getSyncState, resetSyncState } from "./sync-status";
import { FakeTaskServer, TEST_TOKEN } from "./test-support";

let server: FakeTaskServer;
let uninstall: () => void;
let dbCounter = 0;
const DAY = "2026-11-17";
const MONTH = "2026-11";
const form = (title: string) => ({ challenge: "normal" as const, startTime: "", endTime: "", title });

function db() {
  const session = getOfflineSession();
  assert.ok(session);
  return session.db;
}

function writes() {
  return server.requests.filter((request) => request.method !== "GET").map((request) => `${request.method} ${request.path}`);
}

beforeEach(() => {
  resetSyncState();
  server = new FakeTaskServer();
  uninstall = server.install();
  dbCounter += 1;
  setOfflineSession("user-1", TEST_TOKEN, () => new JotlyOfflineDb(`jotly-p4-test-${dbCounter}`));
});

afterEach(() => {
  clearOfflineSessionState();
  uninstall();
});

test("ISO week matches known calendar weeks", () => {
  assert.deepEqual(getIsoWeek("2026-11-17"), { year: 2026, week: 47 });
  assert.deepEqual(getIsoWeek("2021-01-03"), { year: 2020, week: 53 });
  assert.deepEqual(getIsoWeek("2024-12-30"), { year: 2025, week: 1 });
  assert.deepEqual(getIsoWeek("2026-01-01"), { year: 2026, week: 1 });
});

test("journal: affirmation written twice offline is pushed as one save", async () => {
  server.online = false;
  await upsertDayAffirmation({ date: DAY, text: "I focus", isCompleted: false }, TEST_TOKEN);
  const ticked = await upsertDayAffirmation({ date: DAY, text: "I focus", isCompleted: true }, TEST_TOKEN);
  assert.equal(ticked.isCompleted, true);
  assert.equal((await loadDayAffirmation(DAY, TEST_TOKEN))?.text, "I focus");
  assert.equal(await countOutbox(db()), 1);

  server.online = true;
  await syncNow({ pull: false });
  assert.deepEqual(writes(), ["PUT /day-affirmation"]);
  assert.equal(server.phase4.journal.get(`affirmation:${DAY}`)?.isCompleted, true);
});

test("journal: weekly objective then review offline are merged into one save", async () => {
  server.online = false;
  await upsertWeeklyEntry({ year: 2026, week: 47, objective: "Ship offline" }, TEST_TOKEN);
  const saved = await upsertWeeklyEntry({ year: 2026, week: 47, review: "Done" }, TEST_TOKEN);
  assert.equal(saved.objective, "Ship offline");
  assert.equal(saved.review, "Done");

  server.online = true;
  await syncNow({ pull: false });
  const onServer = server.phase4.journal.get("weekly:2026-47");
  assert.equal(onServer?.objective, "Ship offline");
  assert.equal(onServer?.review, "Done");
  assert.equal((await loadWeeklyEntry(2026, 47, TEST_TOKEN))?.review, "Done");
});

test("journal: a newer edit made elsewhere wins over an older offline edit", async () => {
  await upsertDayBilan({ date: DAY, mood: 3, wins: "First", blockers: null, lessonsLearned: null, tomorrowTop3: null }, TEST_TOKEN);
  server.online = false;
  await upsertDayBilan({ date: DAY, mood: 4, wins: "Offline", blockers: null, lessonsLearned: null, tomorrowTop3: null }, TEST_TOKEN);
  const remote = server.phase4.journal.get(`bilan:${DAY}`);
  assert.ok(remote);
  server.phase4.journal.set(`bilan:${DAY}`, { ...remote, wins: "Desktop", updatedAt: new Date(Date.now() + 3_600_000).toISOString() });

  server.online = true;
  await syncNow({ pull: false });
  assert.equal(server.phase4.journal.get(`bilan:${DAY}`)?.wins, "Desktop");
  assert.equal(getSyncState().issues.at(-1)?.kind, "conflict");
});

test("routines: create, rename and tick offline, then pushed in order", async () => {
  server.online = false;
  const created = await createRoutineApi(form("Read"), TEST_TOKEN);
  await updateRoutineApi(created.id, form("Read 20 min"), TEST_TOKEN);
  await upsertRoutineCompletionApi({ routineId: created.id, targetDate: DAY, isCompleted: true }, TEST_TOKEN);

  const summary = await loadRoutineMonth(MONTH, TEST_TOKEN);
  assert.deepEqual(summary.routines.map((routine) => routine.title), ["Read 20 min"]);
  assert.equal(summary.dailyPercentages.find((entry) => entry.date === DAY)?.percentage, 100);

  server.online = true;
  await syncNow({ pull: false });
  assert.deepEqual(writes(), ["POST /routines", "PUT /routine-completions"]);
  assert.equal(server.phase4.routines.get(created.id)?.title, "Read 20 min");
  assert.equal(server.phase4.completions.get(`${created.id}:${DAY}`)?.isCompleted, true);
});

test("routines: deleting offline a routine created offline drops its ticks too", async () => {
  server.online = false;
  const created = await createRoutineApi(form("Temporary"), TEST_TOKEN);
  await upsertRoutineCompletionApi({ routineId: created.id, targetDate: DAY, isCompleted: true }, TEST_TOKEN);
  await deleteRoutineApi(created.id, TEST_TOKEN);
  assert.equal(await countOutbox(db()), 0);
  assert.deepEqual((await loadRoutineMonth(MONTH, TEST_TOKEN)).routines, []);
});

test("routines: ticking twice offline keeps only the last state", async () => {
  const routine = server.phase4.seedRoutine({ id: "srv-routine-a", title: "Walk" });
  await loadRoutineMonth(MONTH, TEST_TOKEN);
  server.online = false;
  await upsertRoutineCompletionApi({ routineId: routine.id, targetDate: DAY, isCompleted: true }, TEST_TOKEN);
  await upsertRoutineCompletionApi({ routineId: routine.id, targetDate: DAY, isCompleted: false }, TEST_TOKEN);
  assert.equal(await countOutbox(db()), 1);

  server.online = true;
  await syncNow({ pull: false });
  assert.equal(server.phase4.completions.get(`${routine.id}:${DAY}`)?.isCompleted, false);
});

test("routines: local percentages follow the server formula (bonus only counts alone)", () => {
  const base = { startTime: null, endTime: null, sortOrder: 0, isActive: true, createdAt: "", updatedAt: "" };
  const routines = [
    { ...base, id: "a", challenge: "normal" as const, title: "A" },
    { ...base, id: "b", challenge: "normal" as const, title: "B" },
    { ...base, id: "c", challenge: "bonus" as const, title: "C" },
  ];
  const done = (routineId: string, targetDate: string) => ({
    id: `${routineId}-${targetDate}`, routineId, targetDate, isCompleted: true, completedAt: null, createdAt: "", updatedAt: "",
  });
  const days = ["2026-11-01", "2026-11-02"];
  const result = calculatePercentages({ routines, completions: [done("a", "2026-11-01"), done("c", "2026-11-01")], days });
  assert.deepEqual(result.dailyPercentages, [{ date: "2026-11-01", percentage: 50 }, { date: "2026-11-02", percentage: 0 }]);
  assert.equal(result.monthPercentage, 25);
  assert.equal(getMonthDays("2026-02").length, 28);
});

test("comments: added offline, shown locally, pushed with their own id", async () => {
  server.seed({ id: "srv-task-1", title: "Task", targetDate: DAY });
  server.online = false;
  const comment = await createTaskComment("srv-task-1", "Written in the metro", TEST_TOKEN);
  assert.deepEqual((await loadTaskComments("srv-task-1", TEST_TOKEN)).map((c) => c.body), ["Written in the metro"]);

  server.online = true;
  await syncNow({ pull: false });
  assert.equal(server.phase4.comments.get(comment.id)?.body, "Written in the metro");
  await syncNow({ pull: false });
  assert.equal(server.phase4.comments.size, 1);
});

test("comments: a comment added then deleted offline sends nothing", async () => {
  server.online = false;
  const comment = await createTaskComment("srv-task-1", "Oops", TEST_TOKEN);
  await deleteTaskComment("srv-task-1", comment.id, TEST_TOKEN);
  assert.equal(await countOutbox(db()), 0);
});

test("pull downloads today's journal and the routine month for offline use", async () => {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  server.phase4.journal.set(`affirmation:${todayKey}`, { id: "srv-aff", text: "Pulled", isCompleted: false, updatedAt: server.tick() });
  server.phase4.seedRoutine({ id: "srv-routine-p", title: "Pulled routine" });
  await syncNow();

  server.online = false;
  assert.equal((await loadDayAffirmation(todayKey, TEST_TOKEN))?.text, "Pulled");
  const summary = await loadRoutineMonth(todayKey.slice(0, 7), TEST_TOKEN);
  assert.deepEqual(summary.routines.map((routine) => routine.title), ["Pulled routine"]);
});
