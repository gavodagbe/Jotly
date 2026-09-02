import { TaskPriority, TaskStatus } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../app";
import {
  InMemoryAuthStore,
  InMemoryRecurrenceStore,
  InMemoryTaskStore,
  type RecurrenceFrequency,
} from "../recurrence/recurrence-test-doubles";

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new InMemoryTaskStore(),
    recurrenceStore: new InMemoryRecurrenceStore(),
    authStore: new InMemoryAuthStore(),
  });
}

async function registerAndGetToken(app: ReturnType<typeof createAppForTest>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: `user-${Math.random().toString(36).slice(2)}@example.com`, password: "password123" },
  });
  assert.equal(response.statusCode, 201);
  return (parsePayload(response.payload).data as { token: string }).token;
}

async function createTaskOn(
  app: ReturnType<typeof createAppForTest>,
  token: string,
  targetDate: string
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(token),
    payload: {
      title: "Recurring task",
      targetDate,
      status: "todo" satisfies TaskStatus,
      priority: "medium" satisfies TaskPriority,
    },
  });
  assert.equal(response.statusCode, 201);
  return (parsePayload(response.payload).data as { id: string }).id;
}

async function setRecurrence(
  app: ReturnType<typeof createAppForTest>,
  token: string,
  taskId: string,
  payload: Record<string, unknown>
) {
  return app.inject({
    method: "PUT",
    url: `/api/tasks/${taskId}/recurrence`,
    headers: authHeaders(token),
    payload,
  });
}

async function listTasksOn(
  app: ReturnType<typeof createAppForTest>,
  token: string,
  date: string
): Promise<Array<{ id: string; recurrenceSourceTaskId: string | null; targetDate: string }>> {
  const response = await app.inject({
    method: "GET",
    url: `/api/tasks?date=${date}`,
    headers: authHeaders(token),
  });
  assert.equal(response.statusCode, 200);
  return parsePayload(response.payload).data as Array<{
    id: string;
    recurrenceSourceTaskId: string | null;
    targetDate: string;
  }>;
}

test("quarterly recurrence generates an instance on the next calendar-quarter month", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  const taskId = await createTaskOn(app, token, "2026-02-10");

  const upsert = await setRecurrence(app, token, taskId, {
    frequency: "quarterly" satisfies RecurrenceFrequency,
    interval: 1,
  });
  assert.equal(upsert.statusCode, 200);
  assert.equal((parsePayload(upsert.payload).data as { frequency: string }).frequency, "quarterly");

  assert.equal((await listTasksOn(app, token, "2026-03-10")).length, 0, "no occurrence mid-quarter");

  const q2 = await listTasksOn(app, token, "2026-04-10");
  assert.equal(q2.length, 1);
  assert.equal(q2[0].recurrenceSourceTaskId, taskId);

  const q3 = await listTasksOn(app, token, "2026-07-10");
  assert.equal(q3.length, 1);
});

test("yearly recurrence generates an instance on the anniversary", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  const taskId = await createTaskOn(app, token, "2026-06-15");

  const upsert = await setRecurrence(app, token, taskId, {
    frequency: "yearly" satisfies RecurrenceFrequency,
    interval: 1,
  });
  assert.equal(upsert.statusCode, 200);

  assert.equal((await listTasksOn(app, token, "2026-12-15")).length, 0);

  const anniversary = await listTasksOn(app, token, "2027-06-15");
  assert.equal(anniversary.length, 1);
  assert.equal(anniversary[0].recurrenceSourceTaskId, taskId);
});

test("quarterly / yearly recurrence rejects weekday selection", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  const taskId = await createTaskOn(app, token, "2026-02-10");

  for (const frequency of ["quarterly", "yearly"] as const) {
    const response = await setRecurrence(app, token, taskId, {
      frequency,
      interval: 1,
      weekdays: [1, 3],
    });
    assert.equal(response.statusCode, 400, `${frequency} + weekdays should be rejected`);
    assert.equal((parsePayload(response.payload).error as { code: string }).code, "VALIDATION_ERROR");
  }
});

test("recurrence rejects an unknown frequency", async (t) => {
  const app = createAppForTest();
  t.after(async () => { await app.close(); });

  const token = await registerAndGetToken(app);
  const taskId = await createTaskOn(app, token, "2026-02-10");

  const response = await setRecurrence(app, token, taskId, { frequency: "biweekly", interval: 1 });
  assert.equal(response.statusCode, 400);
});
