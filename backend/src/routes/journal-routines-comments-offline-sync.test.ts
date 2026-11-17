import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import { InMemoryCommentStore } from "../comments/comment-store.in-memory";
import { InMemoryDayAffirmationStore } from "../day-affirmation/day-affirmation-store.in-memory";
import { InMemoryDayBilanStore } from "../day-bilan/day-bilan-store.in-memory";
import { InMemoryMonthlyEntryStore } from "../monthly-entry/monthly-entry-store.in-memory";
import { InMemoryAuthStore, InMemoryTaskStore } from "../recurrence/recurrence-test-doubles";
import { InMemoryRoutineStore } from "../routines/routine-store.in-memory";
import { InMemoryWeeklyEntryStore } from "../weekly-entry/weekly-entry-store.in-memory";

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    authStore: new InMemoryAuthStore(),
    taskStore: new InMemoryTaskStore(),
    commentStore: new InMemoryCommentStore(),
    dayAffirmationStore: new InMemoryDayAffirmationStore(),
    dayBilanStore: new InMemoryDayBilanStore(),
    weeklyEntryStore: new InMemoryWeeklyEntryStore(),
    monthlyEntryStore: new InMemoryMonthlyEntryStore(),
    routineStore: new InMemoryRoutineStore(),
  });
}

type TestApp = ReturnType<typeof createAppForTest>;
type Method = "POST" | "PUT" | "PATCH" | "DELETE";

async function setup(t: { after: (fn: () => unknown) => void }) {
  const app = createAppForTest();
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: `user-${Math.random().toString(36).slice(2)}@example.com`,
      password: "password123",
      displayName: "Offline Tester",
    },
  });
  assert.equal(response.statusCode, 201);
  const token: string = response.json().data.token;
  const send = (method: Method, url: string, payload?: object) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
  return { app, send };
}

const staleBase = (updatedAt: string) => new Date(Date.parse(updatedAt) - 60_000).toISOString();

const journalCases = [
  { name: "day affirmation", url: "/api/day-affirmation", body: { date: "2026-11-17", text: "I focus", isCompleted: false } },
  { name: "day bilan", url: "/api/day-bilan", body: { date: "2026-11-17", wins: "Shipped offline mode" } },
  { name: "weekly entry", url: "/api/weekly-entry", body: { year: 2026, week: 47, objective: "Offline" } },
  { name: "monthly entry", url: "/api/monthly-entry", body: { year: 2026, month: 11, review: "Good month" } },
];

for (const journal of journalCases) {
  test(`${journal.name}: replaying the same save is harmless`, async (t) => {
    const { send } = await setup(t);
    const first = await send("PUT", journal.url, journal.body);
    const replay = await send("PUT", journal.url, journal.body);
    assert.equal(first.statusCode, 200);
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.json().data.id, first.json().data.id);
  });

  test(`${journal.name}: an up-to-date baseUpdatedAt is applied`, async (t) => {
    const { send } = await setup(t);
    const saved = (await send("PUT", journal.url, journal.body)).json().data;
    const response = await send("PUT", journal.url, { ...journal.body, baseUpdatedAt: saved.updatedAt });
    assert.equal(response.statusCode, 200);
  });

  test(`${journal.name}: a stale baseUpdatedAt returns 409 with the server copy`, async (t) => {
    const { send } = await setup(t);
    const saved = (await send("PUT", journal.url, journal.body)).json().data;
    const response = await send("PUT", journal.url, { ...journal.body, baseUpdatedAt: staleBase(saved.updatedAt) });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error.code, "CONFLICT");
    assert.equal(response.json().data.id, saved.id);
  });

  test(`${journal.name}: a first save with a base succeeds (nothing to conflict with)`, async (t) => {
    const { send } = await setup(t);
    const response = await send("PUT", journal.url, { ...journal.body, baseUpdatedAt: "2026-11-17T08:00:00.000Z" });
    assert.equal(response.statusCode, 200);
  });
}

test("routine: create keeps the client id and a replay returns the same routine", async (t) => {
  const { send } = await setup(t);
  const body = { id: "client-routine-01", title: "Read 20 minutes", challenge: "normal" };
  const first = await send("POST", "/api/routines", body);
  const replay = await send("POST", "/api/routines", body);
  assert.equal(first.statusCode, 201);
  assert.equal(first.json().data.id, "client-routine-01");
  assert.equal(replay.statusCode, 200);
});

test("routine: a stale baseUpdatedAt returns 409; without base the update applies", async (t) => {
  const { send } = await setup(t);
  const created = (await send("POST", "/api/routines", { title: "Stretch" })).json().data;
  const conflict = await send("PATCH", `/api/routines/${created.id}`, {
    title: "Stretch 10 min",
    baseUpdatedAt: staleBase(created.updatedAt),
  });
  const plain = await send("PATCH", `/api/routines/${created.id}`, { title: "Stretch 10 min" });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().data.title, "Stretch");
  assert.equal(plain.statusCode, 200);
  assert.equal(plain.json().data.title, "Stretch 10 min");
});

test("routine: deleting twice and ticking twice are both harmless", async (t) => {
  const { send } = await setup(t);
  const created = (await send("POST", "/api/routines", { title: "Walk" })).json().data;
  const tick = { routineId: created.id, targetDate: "2026-11-17", isCompleted: true };
  assert.equal((await send("PUT", "/api/routine-completions", tick)).statusCode, 200);
  assert.equal((await send("PUT", "/api/routine-completions", tick)).statusCode, 200);
  assert.equal((await send("DELETE", `/api/routines/${created.id}`)).statusCode, 200);
  assert.equal((await send("DELETE", `/api/routines/${created.id}`)).statusCode, 200);
});

test("comment: create keeps the client id and a replay returns the same comment", async (t) => {
  const { send } = await setup(t);
  const task = (await send("POST", "/api/tasks", { title: "Task", targetDate: "2026-11-17" })).json().data;
  const body = { id: "client-comment-01", body: "Written offline" };
  const first = await send("POST", `/api/tasks/${task.id}/comments`, body);
  const replay = await send("POST", `/api/tasks/${task.id}/comments`, body);
  assert.equal(first.statusCode, 201);
  assert.equal(first.json().data.id, "client-comment-01");
  assert.equal(replay.statusCode, 200);
});

test("comment: a client id already used on another task is rejected", async (t) => {
  const { send } = await setup(t);
  const taskA = (await send("POST", "/api/tasks", { title: "A", targetDate: "2026-11-17" })).json().data;
  const taskB = (await send("POST", "/api/tasks", { title: "B", targetDate: "2026-11-17" })).json().data;
  await send("POST", `/api/tasks/${taskA.id}/comments`, { id: "client-comment-02", body: "On A" });
  const response = await send("POST", `/api/tasks/${taskB.id}/comments`, { id: "client-comment-02", body: "On B" });
  assert.equal(response.statusCode, 409);
});

test("comment: a stale baseUpdatedAt returns 409 with the server copy", async (t) => {
  const { send } = await setup(t);
  const task = (await send("POST", "/api/tasks", { title: "Task", targetDate: "2026-11-17" })).json().data;
  const comment = (await send("POST", `/api/tasks/${task.id}/comments`, { body: "Original" })).json().data;
  const response = await send("PATCH", `/api/tasks/${task.id}/comments/${comment.id}`, {
    body: "Offline edit",
    baseUpdatedAt: staleBase(comment.updatedAt),
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().data.body, "Original");
});
