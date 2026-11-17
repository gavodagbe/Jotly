import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { countOutbox } from "./outbox";
import { JotlyOfflineDb } from "./db";
import { clearOfflineSessionState, getOfflineSession, setOfflineSession } from "./session";
import { getSyncWindow, syncNow } from "./sync-engine";
import { getSyncState, resetSyncState } from "./sync-status";
import {
  createTask,
  deleteTaskById,
  loadTaskTimeEntries,
  loadTasksByDate,
  saveTaskTimeEntry,
  updateTask,
  updateTaskStatus,
} from "./task-repository";
import { FakeTaskServer, taskInput, TEST_TOKEN } from "./test-support";

let server: FakeTaskServer;
let uninstall: () => void;
let dbCounter = 0;

function db() {
  const session = getOfflineSession();
  assert.ok(session);
  return session.db;
}

beforeEach(() => {
  resetSyncState();
  server = new FakeTaskServer();
  uninstall = server.install();
  dbCounter += 1;
  setOfflineSession("user-1", TEST_TOKEN, () => new JotlyOfflineDb(`jotly-test-${dbCounter}`));
});

afterEach(() => {
  clearOfflineSessionState();
  uninstall();
});

test("online writes go straight to the server with a client id", async () => {
  const created = await createTask(taskInput(), TEST_TOKEN);
  assert.ok(server.tasks.has(created.id));
  assert.equal(await countOutbox(db()), 0);
  assert.ok(created.updatedAt);
});

test("offline: create, edit and complete are applied locally and queued", async () => {
  server.online = false;
  const created = await createTask(taskInput({ title: "Written in airplane mode" }), TEST_TOKEN);
  await updateTaskStatus(created.id, "done", TEST_TOKEN);

  const local = await loadTasksByDate("2026-11-17", TEST_TOKEN);
  assert.equal(local.length, 1);
  assert.equal(local[0].status, "done");
  assert.equal(server.tasks.size, 0);
  assert.equal(await countOutbox(db()), 1, "update merged into the pending create");
});

test("when the network is back the queue is pushed once, in order", async () => {
  server.online = false;
  const created = await createTask(taskInput({ title: "Offline" }), TEST_TOKEN);
  await updateTask(created.id, { ...taskInput({ title: "Offline, renamed" }) }, TEST_TOKEN);
  await saveTaskTimeEntry(created.id, { date: "2026-11-17", fraction: 0.5 }, TEST_TOKEN);

  server.online = true;
  await syncNow();

  assert.equal(await countOutbox(db()), 0);
  assert.equal(server.tasks.get(created.id)?.title, "Offline, renamed");
  assert.equal(server.timeEntries.get(`2026-11-17|${created.id}`), 0.5);
  const writes = server.requests.filter((request) => request.method !== "GET").map((request) => request.method);
  assert.deepEqual(writes, ["POST", "PUT"]);

  await syncNow();
  assert.equal(server.tasks.size, 1, "a second sync does not duplicate anything");
});

test("deleting offline a task created offline sends nothing", async () => {
  server.online = false;
  const created = await createTask(taskInput(), TEST_TOKEN);
  await deleteTaskById(created.id, TEST_TOKEN);
  assert.equal(await countOutbox(db()), 0);

  server.online = true;
  await syncNow();
  assert.equal(server.requests.filter((request) => request.method !== "GET").length, 0);
});

test("offline delete of a synced task is replayed; an already-deleted task is fine", async () => {
  const seeded = server.seed({ id: "srv-a", title: "Existing", targetDate: "2026-11-17" });
  await loadTasksByDate("2026-11-17", TEST_TOKEN);

  server.online = false;
  await deleteTaskById(seeded.id, TEST_TOKEN);
  assert.deepEqual(await loadTasksByDate("2026-11-17", TEST_TOKEN), []);

  server.online = true;
  server.tasks.delete(seeded.id); // deleted on another device meanwhile → 404 on replay
  await syncNow();
  assert.equal(await countOutbox(db()), 0);
  assert.equal(getSyncState().issues.length, 0);
});

test("conflict: a more recent offline edit wins", async () => {
  const seeded = server.seed({ id: "srv-b", title: "Original", targetDate: "2026-11-17" });
  await loadTasksByDate("2026-11-17", TEST_TOKEN);
  server.tasks.set(seeded.id, { ...seeded, title: "Desktop edit", updatedAt: "2026-11-17T08:30:00.000Z" });

  server.online = false;
  await updateTaskStatus(seeded.id, "done", TEST_TOKEN); // edited "now" (2026 test clock is in the past)

  server.online = true;
  await syncNow();
  assert.equal(server.tasks.get(seeded.id)?.status, "done");
  assert.equal(getSyncState().issues.at(-1)?.kind, "conflict");
});

test("conflict: a more recent server edit wins", async () => {
  const seeded = server.seed({ id: "srv-c", title: "Original", targetDate: "2026-11-17" });
  await loadTasksByDate("2026-11-17", TEST_TOKEN);

  server.online = false;
  await updateTaskStatus(seeded.id, "done", TEST_TOKEN);
  const future = new Date(Date.now() + 3_600_000).toISOString();
  server.tasks.set(seeded.id, { ...seeded, title: "Edited later elsewhere", updatedAt: future });

  server.online = true;
  await syncNow();
  assert.equal(server.tasks.get(seeded.id)?.status, "todo");
  const local = await loadTasksByDate("2026-11-17", TEST_TOKEN);
  assert.equal(local[0].title, "Edited later elsewhere");
  assert.equal(getSyncState().issues.at(-1)?.kind, "conflict");
});

test("a change rejected by the server is set aside and does not block the queue", async () => {
  server.online = false;
  await createTask(taskInput({ title: "" }), TEST_TOKEN); // server will reject: title required
  const valid = await createTask(taskInput({ title: "Valid" }), TEST_TOKEN);

  server.online = true;
  await syncNow();
  assert.equal(await countOutbox(db()), 0);
  assert.ok(server.tasks.has(valid.id));
  assert.equal(getSyncState().issues.at(-1)?.kind, "rejected");
});

test("sync stops and keeps the queue when the network drops again", async () => {
  server.online = false;
  await createTask(taskInput(), TEST_TOKEN);
  await syncNow();
  assert.equal(await countOutbox(db()), 1);
});

test("pull replaces the window but never overwrites pending local edits", async () => {
  const today = getSyncWindow().from; // any date inside the window
  server.seed({ id: "srv-d", title: "Server copy", targetDate: today });
  server.seed({ id: "srv-e", title: "Will be deleted remotely", targetDate: today });
  await syncNow();
  assert.equal((await loadTasksByDate(today, TEST_TOKEN)).length, 2);

  server.online = false;
  await updateTaskStatus("srv-d", "in_progress", TEST_TOKEN);
  server.online = true;
  server.tasks.delete("srv-e");
  await syncNow();

  const local = await loadTasksByDate(today, TEST_TOKEN);
  assert.deepEqual(local.map((task) => task.id), ["srv-d"]);
  assert.equal(local[0].status, "in_progress");
});

test("time entries are readable offline with the local day total", async () => {
  server.online = false;
  const created = await createTask(taskInput(), TEST_TOKEN);
  const saved = await saveTaskTimeEntry(created.id, { date: "2026-11-17", fraction: 0.75 }, TEST_TOKEN);
  assert.equal(saved.dayTotal, 0.75);
  const payload = await loadTaskTimeEntries("2026-11-17", TEST_TOKEN);
  assert.deepEqual(payload.entries, [{ taskId: created.id, fraction: 0.75 }]);
});

test("editing offline a task never loaded locally gives a clear error", async () => {
  server.online = false;
  await assert.rejects(() => updateTaskStatus("unknown-task", "done", TEST_TOKEN), /not available offline/);
});
