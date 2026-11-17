import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import { InMemoryAuthStore, InMemoryTaskStore } from "../recurrence/recurrence-test-doubles";

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new InMemoryTaskStore(),
    authStore: new InMemoryAuthStore(),
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

function createTask(app: TestApp, token: string, payload: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: { authorization: `Bearer ${token}` },
    payload: { title: "Offline task", targetDate: "2026-11-17", ...payload },
  });
}

function patchTask(app: TestApp, token: string, id: string, payload: Record<string, unknown>) {
  return app.inject({
    method: "PATCH",
    url: `/api/tasks/${id}`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

test("POST /api/tasks keeps a client-generated id", async (t) => {
  const app = createAppForTest();
  t.after(() => app.close());
  const token = await registerAndGetToken(app);

  const response = await createTask(app, token, { id: "client-abc12345" });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.id, "client-abc12345");
});

test("replaying a create with the same client id returns the existing task", async (t) => {
  const app = createAppForTest();
  t.after(() => app.close());
  const token = await registerAndGetToken(app);

  const first = await createTask(app, token, { id: "client-replay-01", title: "First" });
  const replay = await createTask(app, token, { id: "client-replay-01", title: "First" });

  assert.equal(first.statusCode, 201);
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.json().data.id, "client-replay-01");

  const list = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-11-17",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(list.json().data.length, 1);
});

test("a client id owned by another user is rejected with 409", async (t) => {
  const app = createAppForTest();
  t.after(() => app.close());
  const ownerToken = await registerAndGetToken(app);
  const otherToken = await registerAndGetToken(app);

  await createTask(app, ownerToken, { id: "client-shared-01" });
  const response = await createTask(app, otherToken, { id: "client-shared-01" });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "CONFLICT");
});

test("invalid client ids are rejected", async (t) => {
  const app = createAppForTest();
  t.after(() => app.close());
  const token = await registerAndGetToken(app);

  const tooShort = await createTask(app, token, { id: "abc" });
  const badChars = await createTask(app, token, { id: "client id with spaces" });

  assert.equal(tooShort.statusCode, 400);
  assert.equal(badChars.statusCode, 400);
});

test("PATCH with an up-to-date baseUpdatedAt is applied", async (t) => {
  const app = createAppForTest();
  t.after(() => app.close());
  const token = await registerAndGetToken(app);
  const created = (await createTask(app, token, {})).json().data;

  const response = await patchTask(app, token, created.id, { status: "done", baseUpdatedAt: created.updatedAt });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.status, "done");
});

test("PATCH with a stale baseUpdatedAt returns 409 with the server copy", async (t) => {
  const app = createAppForTest();
  t.after(() => app.close());
  const token = await registerAndGetToken(app);
  const created = (await createTask(app, token, {})).json().data;
  const staleBase = new Date(Date.parse(created.updatedAt) - 60_000).toISOString();

  const response = await patchTask(app, token, created.id, { title: "Offline edit", baseUpdatedAt: staleBase });

  assert.equal(response.statusCode, 409);
  const body = response.json();
  assert.equal(body.error.code, "CONFLICT");
  assert.equal(body.data.id, created.id);
  assert.equal(body.data.title, "Offline task");
});

test("PATCH without baseUpdatedAt behaves as before", async (t) => {
  const app = createAppForTest();
  t.after(() => app.close());
  const token = await registerAndGetToken(app);
  const created = (await createTask(app, token, {})).json().data;

  const response = await patchTask(app, token, created.id, { title: "Renamed" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.title, "Renamed");
});

test("PATCH with only baseUpdatedAt is still rejected as empty", async (t) => {
  const app = createAppForTest();
  t.after(() => app.close());
  const token = await registerAndGetToken(app);
  const created = (await createTask(app, token, {})).json().data;

  const response = await patchTask(app, token, created.id, { baseUpdatedAt: created.updatedAt });

  assert.equal(response.statusCode, 400);
});
