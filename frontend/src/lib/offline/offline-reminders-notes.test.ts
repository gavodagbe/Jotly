import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { JotlyOfflineDb } from "./db";
import { createNoteApi, deleteNoteApi, loadNotes, updateNoteApi } from "./note-repository";
import { countOutbox } from "./outbox";
import {
  cancelReminderApi,
  completeReminderApi,
  createReminderApi,
  loadPendingReminders,
  loadReminders,
  updateReminderApi,
} from "./reminder-repository";
import { clearOfflineSessionState, getOfflineSession, setOfflineSession } from "./session";
import { getSyncWindow, syncNow } from "./sync-engine";
import { getSyncState, resetSyncState } from "./sync-status";
import { FakeTaskServer, TEST_TOKEN } from "./test-support";

let server: FakeTaskServer;
let uninstall: () => void;
let dbCounter = 0;
const TODAY = getSyncWindow().from; // a date inside the sync window
const PAST = new Date(Date.now() - 60_000).toISOString();
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

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
  setOfflineSession("user-1", TEST_TOKEN, () => new JotlyOfflineDb(`jotly-rn-test-${dbCounter}`));
});

afterEach(() => {
  clearOfflineSessionState();
  uninstall();
});

test("reminder: created, edited and completed offline, pushed once on reconnect", async () => {
  server.online = false;
  const created = await createReminderApi({ title: "Call the bank", remindAt: FUTURE }, TEST_TOKEN);
  await updateReminderApi(created.id, { title: "Call the bank back" }, TEST_TOKEN);
  const completed = await completeReminderApi(created.id, TEST_TOKEN);
  assert.equal(completed.status, "completed");
  assert.equal(await countOutbox(db()), 2, "edit merged into the create, complete queued after it");

  server.online = true;
  await syncNow();

  assert.equal(await countOutbox(db()), 0);
  const onServer = server.reminders.get(created.id);
  assert.equal(onServer?.title, "Call the bank back");
  assert.equal(onServer?.status, "completed");
  const writes = server.requests.filter((request) => request.method !== "GET").map((request) => `${request.method} ${request.path}`);
  assert.deepEqual(writes, ["POST /reminders", `POST /reminders/${created.id}/complete`]);
});

test("reminder: a reminder that becomes due offline still raises an alert, once", async () => {
  server.seedReminder({ id: "srv-r-due", title: "Take medicine", remindAt: PAST });
  await syncNow();

  server.online = false;
  const firstPoll = await loadPendingReminders(TEST_TOKEN);
  const secondPoll = await loadPendingReminders(TEST_TOKEN);

  assert.deepEqual(firstPoll.map((reminder) => reminder.id), ["srv-r-due"]);
  assert.equal(firstPoll[0].status, "fired");
  assert.equal(secondPoll.length, 0);
});

test("reminder: the day list works offline and follows local changes", async () => {
  server.seedReminder({ id: "srv-r-1", title: "Today", remindAt: `${TODAY}T08:00:00.000Z` });
  await loadReminders(TODAY, TEST_TOKEN);

  server.online = false;
  await cancelReminderApi("srv-r-1", TEST_TOKEN);
  assert.deepEqual(await loadReminders(TODAY, TEST_TOKEN), [], "cancelled reminders leave the active list");
});

test("reminder: conflict keeps the most recent version", async () => {
  const seeded = server.seedReminder({ id: "srv-r-2", title: "Original", remindAt: FUTURE });
  await syncNow();

  server.online = false;
  await updateReminderApi(seeded.id, { title: "Offline edit" }, TEST_TOKEN);
  server.reminders.set(seeded.id, { ...seeded, title: "Desktop edit", updatedAt: "2026-11-17T08:30:00.000Z" });

  server.online = true;
  await syncNow();
  assert.equal(server.reminders.get(seeded.id)?.title, "Offline edit");
  assert.equal(getSyncState().issues.at(-1)?.kind, "conflict");
});

test("note: created and edited offline is pushed as a single create", async () => {
  server.online = false;
  const created = await createNoteApi({ body: "Idea on the train", targetDate: TODAY }, TEST_TOKEN);
  await updateNoteApi(created.id, { body: "Idea on the train, refined" }, TEST_TOKEN);
  assert.deepEqual((await loadNotes(TEST_TOKEN, TODAY)).map((note) => note.body), ["Idea on the train, refined"]);

  server.online = true;
  await syncNow();
  assert.equal(server.notes.get(created.id)?.body, "Idea on the train, refined");
  assert.equal(server.requests.filter((request) => request.method === "POST").length, 1);
});

test("note: deleting offline a note created offline sends nothing", async () => {
  server.online = false;
  const created = await createNoteApi({ body: "Draft", targetDate: TODAY }, TEST_TOKEN);
  await deleteNoteApi(created.id, TEST_TOKEN);
  assert.equal(await countOutbox(db()), 0);
});

test("note: offline delete of a synced note is replayed; already gone is fine", async () => {
  server.seedNote({ id: "srv-n-1", body: "Old note", targetDate: TODAY });
  await syncNow();

  server.online = false;
  await deleteNoteApi("srv-n-1", TEST_TOKEN);
  assert.deepEqual(await loadNotes(TEST_TOKEN, TODAY), []);

  server.online = true;
  server.notes.delete("srv-n-1");
  await syncNow();
  assert.equal(await countOutbox(db()), 0);
  assert.equal(getSyncState().issues.length, 0);
});

test("note: a more recent server edit wins over an older offline edit", async () => {
  const seeded = server.seedNote({ id: "srv-n-2", body: "Original", targetDate: TODAY });
  await syncNow();

  server.online = false;
  await updateNoteApi(seeded.id, { body: "Offline edit" }, TEST_TOKEN);
  server.notes.set(seeded.id, { ...seeded, body: "Edited later elsewhere", updatedAt: new Date(Date.now() + 3_600_000).toISOString() });

  server.online = true;
  await syncNow();
  assert.equal(server.notes.get(seeded.id)?.body, "Edited later elsewhere");
  assert.equal((await loadNotes(TEST_TOKEN, TODAY))[0].body, "Edited later elsewhere");
});

test("pull keeps reminders and in-window notes for offline use", async () => {
  server.seedReminder({ id: "srv-r-3", title: "Later", remindAt: FUTURE });
  server.seedNote({ id: "srv-n-in", body: "In window", targetDate: TODAY });
  server.seedNote({ id: "srv-n-out", body: "Too old", targetDate: "2020-01-01" });
  await syncNow();

  assert.ok(await db().reminders.get("srv-r-3"));
  assert.ok(await db().notes.get("srv-n-in"));
  assert.equal(await db().notes.get("srv-n-out"), undefined);
});
