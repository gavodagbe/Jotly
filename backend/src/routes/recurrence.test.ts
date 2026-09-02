import { TaskPriority, TaskStatus } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import {
  DuplicateGeneratedTaskStore,
  InMemoryAuthStore,
  InMemoryRecurrenceStore,
  InMemoryTaskStore,
  type RecurrenceFrequency,
} from "../recurrence/recurrence-test-doubles";

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

function authHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
  };
}

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new InMemoryTaskStore(),
    recurrenceStore: new InMemoryRecurrenceStore(),
    authStore: new InMemoryAuthStore(),
  });
}

function createAppForDuplicateGenerationTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new DuplicateGeneratedTaskStore(),
    recurrenceStore: new InMemoryRecurrenceStore(),
    authStore: new InMemoryAuthStore(),
  });
}

async function registerAndGetToken(app: ReturnType<typeof createAppForTest>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: `user-${Math.random().toString(36).slice(2)}@example.com`,
      password: "password123",
    },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  return (body.data as { token: string }).token;
}

async function createTask(app: ReturnType<typeof createAppForTest>, token: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Daily sync",
      targetDate: "2026-03-06",
      status: "todo" satisfies TaskStatus,
      priority: "medium" satisfies TaskPriority,
    },
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  return (body.data as { id: string }).id;
}

test("recurrence rules can be upserted and auto-generate future task instances", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const taskId = await createTask(app, token);

  const upsertResponse = await app.inject({
    method: "PUT",
    url: `/api/tasks/${taskId}/recurrence`,
    headers: authHeaders(token),
    payload: {
      frequency: "daily" satisfies RecurrenceFrequency,
      interval: 1,
    },
  });

  assert.equal(upsertResponse.statusCode, 200);

  const listFutureResponse = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-07",
    headers: authHeaders(token),
  });

  assert.equal(listFutureResponse.statusCode, 200);
  const listFuturePayload = parsePayload(listFutureResponse.payload);
  const futureTasks = listFuturePayload.data as Array<{
    id: string;
    recurrenceSourceTaskId: string | null;
    dueDate: string | null;
  }>;

  assert.equal(futureTasks.length, 1);
  assert.equal(futureTasks[0].recurrenceSourceTaskId, taskId);
  assert.equal(futureTasks[0].dueDate, "2026-03-07");

  const listFutureAgainResponse = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-07",
    headers: authHeaders(token),
  });

  assert.equal(listFutureAgainResponse.statusCode, 200);
  const listFutureAgainPayload = parsePayload(listFutureAgainResponse.payload);
  const futureTasksAgain = listFutureAgainPayload.data as Array<{ id: string }>;
  assert.equal(futureTasksAgain.length, 1);

  const deleteRuleResponse = await app.inject({
    method: "DELETE",
    url: `/api/tasks/${taskId}/recurrence`,
    headers: authHeaders(token),
  });

  assert.equal(deleteRuleResponse.statusCode, 200);

  const listAfterDeleteResponse = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-08",
    headers: authHeaders(token),
  });

  assert.equal(listAfterDeleteResponse.statusCode, 200);
  const listAfterDeletePayload = parsePayload(listAfterDeleteResponse.payload);
  const tasksAfterDelete = listAfterDeletePayload.data as Array<unknown>;
  assert.equal(tasksAfterDelete.length, 0);
});

test("recurrence cannot be configured on generated task instances", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const taskId = await createTask(app, token);

  await app.inject({
    method: "PUT",
    url: `/api/tasks/${taskId}/recurrence`,
    headers: authHeaders(token),
    payload: {
      frequency: "daily" satisfies RecurrenceFrequency,
      interval: 1,
    },
  });

  const generatedTasksResponse = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-07",
    headers: authHeaders(token),
  });

  assert.equal(generatedTasksResponse.statusCode, 200);
  const generatedTasksPayload = parsePayload(generatedTasksResponse.payload);
  const generatedTask = (generatedTasksPayload.data as Array<{ id: string }>)[0];

  const conflictResponse = await app.inject({
    method: "PUT",
    url: `/api/tasks/${generatedTask.id}/recurrence`,
    headers: authHeaders(token),
    payload: {
      frequency: "weekly" satisfies RecurrenceFrequency,
      interval: 1,
      weekdays: [1],
    },
  });

  assert.equal(conflictResponse.statusCode, 409);
  const conflictPayload = parsePayload(conflictResponse.payload);
  assert.deepEqual(conflictPayload.error, {
    code: "CONFLICT",
    message: "Recurrence can only be configured on source tasks.",
  });
});

test("recurrence task generation tolerates duplicate-occurrence conflicts", async (t) => {
  const app = createAppForDuplicateGenerationTest();

  t.after(async () => {
    await app.close();
  });

  const token = await registerAndGetToken(app);
  const taskId = await createTask(app, token);

  const upsertResponse = await app.inject({
    method: "PUT",
    url: `/api/tasks/${taskId}/recurrence`,
    headers: authHeaders(token),
    payload: {
      frequency: "daily" satisfies RecurrenceFrequency,
      interval: 1,
    },
  });

  assert.equal(upsertResponse.statusCode, 200);

  const listFutureResponse = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-07",
    headers: authHeaders(token),
  });

  assert.equal(listFutureResponse.statusCode, 200);
  const listFuturePayload = parsePayload(listFutureResponse.payload);
  const futureTasks = listFuturePayload.data as Array<{ recurrenceSourceTaskId: string | null }>;
  assert.equal(futureTasks.length, 1);
  assert.equal(futureTasks[0].recurrenceSourceTaskId, taskId);
});

test("recurrence endpoints enforce task ownership boundaries", async (t) => {
  const app = createAppForTest();

  t.after(async () => {
    await app.close();
  });

  const ownerToken = await registerAndGetToken(app);
  const otherUserToken = await registerAndGetToken(app);
  const taskId = await createTask(app, ownerToken);

  const getResponse = await app.inject({
    method: "GET",
    url: `/api/tasks/${taskId}/recurrence`,
    headers: authHeaders(otherUserToken),
  });

  assert.equal(getResponse.statusCode, 404);

  const putResponse = await app.inject({
    method: "PUT",
    url: `/api/tasks/${taskId}/recurrence`,
    headers: authHeaders(otherUserToken),
    payload: {
      frequency: "daily" satisfies RecurrenceFrequency,
      interval: 1,
    },
  });

  assert.equal(putResponse.statusCode, 404);
});
