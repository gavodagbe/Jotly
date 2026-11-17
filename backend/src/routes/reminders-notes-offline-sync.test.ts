import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import { InMemoryNoteStore } from "../notes/note-store.in-memory";
import { InMemoryAuthStore } from "../recurrence/recurrence-test-doubles";
import { InMemoryReminderStore } from "../reminders/reminder-store.in-memory";

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    authStore: new InMemoryAuthStore(),
    reminderStore: new InMemoryReminderStore(),
    noteStore: new InMemoryNoteStore(),
  });
}

type TestApp = ReturnType<typeof createAppForTest>;

async function registerAndGetToken(app: TestApp): Promise<string> {
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
  return response.json().data.token;
}

function send(app: TestApp, token: string, method: "POST" | "PUT" | "PATCH", url: string, payload: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

const reminderBody = { title: "Call the bank", remindAt: "2026-11-18T09:00:00.000Z" };
const noteBody = { body: "Written offline", targetDate: "2026-11-17" };

for (const resource of [
  { name: "reminder", url: "/api/reminders", body: reminderBody, updateMethod: "PUT" as const, update: { title: "Edited" } },
  { name: "note", url: "/api/notes", body: noteBody, updateMethod: "PATCH" as const, update: { body: "Edited" } },
]) {
  test(`${resource.name}: create keeps the client id and a replay returns the same record`, async (t) => {
    const app = createAppForTest();
    t.after(() => app.close());
    const token = await registerAndGetToken(app);

    const first = await send(app, token, "POST", resource.url, { ...resource.body, id: "client-offline-01" });
    const replay = await send(app, token, "POST", resource.url, { ...resource.body, id: "client-offline-01" });

    assert.equal(first.statusCode, 201);
    assert.equal(first.json().data.id, "client-offline-01");
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.json().data.id, "client-offline-01");
  });

  test(`${resource.name}: a client id owned by another user is rejected with 409`, async (t) => {
    const app = createAppForTest();
    t.after(() => app.close());
    const ownerToken = await registerAndGetToken(app);
    const otherToken = await registerAndGetToken(app);

    await send(app, ownerToken, "POST", resource.url, { ...resource.body, id: "client-shared-01" });
    const response = await send(app, otherToken, "POST", resource.url, { ...resource.body, id: "client-shared-01" });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error.code, "CONFLICT");
  });

  test(`${resource.name}: invalid client ids are rejected`, async (t) => {
    const app = createAppForTest();
    t.after(() => app.close());
    const token = await registerAndGetToken(app);

    const response = await send(app, token, "POST", resource.url, { ...resource.body, id: "bad id" });
    assert.equal(response.statusCode, 400);
  });

  test(`${resource.name}: update with an up-to-date baseUpdatedAt is applied`, async (t) => {
    const app = createAppForTest();
    t.after(() => app.close());
    const token = await registerAndGetToken(app);
    const created = (await send(app, token, "POST", resource.url, resource.body)).json().data;

    const response = await send(app, token, resource.updateMethod, `${resource.url}/${created.id}`, {
      ...resource.update,
      baseUpdatedAt: created.updatedAt,
    });

    assert.equal(response.statusCode, 200);
  });

  test(`${resource.name}: update with a stale baseUpdatedAt returns 409 with the server copy`, async (t) => {
    const app = createAppForTest();
    t.after(() => app.close());
    const token = await registerAndGetToken(app);
    const created = (await send(app, token, "POST", resource.url, resource.body)).json().data;
    const staleBase = new Date(Date.parse(created.updatedAt) - 60_000).toISOString();

    const response = await send(app, token, resource.updateMethod, `${resource.url}/${created.id}`, {
      ...resource.update,
      baseUpdatedAt: staleBase,
    });

    assert.equal(response.statusCode, 409);
    const body = response.json();
    assert.equal(body.error.code, "CONFLICT");
    assert.equal(body.data.id, created.id);
  });

  test(`${resource.name}: update without baseUpdatedAt behaves as before`, async (t) => {
    const app = createAppForTest();
    t.after(() => app.close());
    const token = await registerAndGetToken(app);
    const created = (await send(app, token, "POST", resource.url, resource.body)).json().data;

    const response = await send(app, token, resource.updateMethod, `${resource.url}/${created.id}`, resource.update);
    assert.equal(response.statusCode, 200);
  });
}

test("reminder: complete and cancel can be replayed safely", async (t) => {
  const app = createAppForTest();
  t.after(() => app.close());
  const token = await registerAndGetToken(app);
  const created = (await send(app, token, "POST", "/api/reminders", reminderBody)).json().data;

  const first = await send(app, token, "POST", `/api/reminders/${created.id}/complete`, {});
  const replay = await send(app, token, "POST", `/api/reminders/${created.id}/complete`, {});

  assert.equal(first.statusCode, 200);
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.json().data.status, "completed");
});
