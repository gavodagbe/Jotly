import { Task, TaskPriority, TaskStatus } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";
import { formatDateOnly, TaskCreateInput, TaskStore, TaskUpdateInput } from "../tasks/task-store";

class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, Task>();
  private idCounter = 1;

  async listByDate(targetDate: Date): Promise<Task[]> {
    const selectedDate = formatDateOnly(targetDate);
    const matches = [...this.tasks.values()].filter(
      (task) => formatDateOnly(task.targetDate) === selectedDate
    );
    return matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async create(input: TaskCreateInput): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: `task-${this.idCounter++}`,
      title: input.title,
      description: input.description,
      status: input.status,
      targetDate: input.targetDate,
      priority: input.priority,
      project: input.project,
      plannedTime: input.plannedTime,
      createdAt: now,
      updatedAt: now,
      completedAt: input.completedAt,
      cancelledAt: input.cancelledAt
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async update(id: string, input: TaskUpdateInput): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing) {
      return null;
    }

    const updated: Task = {
      ...existing,
      ...input,
      updatedAt: new Date()
    };

    this.tasks.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing) {
      return null;
    }

    this.tasks.delete(id);
    return existing;
  }
}

function parsePayload(payload: string) {
  return JSON.parse(payload) as Record<string, unknown>;
}

function createAppForTest() {
  return buildApp({
    logLevel: "silent",
    taskStore: new InMemoryTaskStore()
  });
}

test("POST /api/tasks creates a task with defaults", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    payload: {
      title: "Write tests",
      targetDate: "2026-03-06"
    }
  });

  assert.equal(response.statusCode, 201);
  const body = parsePayload(response.payload);
  const data = body.data as Record<string, unknown>;

  assert.equal(data.title, "Write tests");
  assert.equal(data.status, "todo");
  assert.equal(data.priority, "medium");
  assert.equal(data.targetDate, "2026-03-06");
  assert.equal(data.completedAt, null);
  assert.equal(data.cancelledAt, null);
});

test("GET /api/tasks filters tasks by selected date", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    payload: {
      title: "Task for selected date",
      targetDate: "2026-03-06"
    }
  });

  await app.inject({
    method: "POST",
    url: "/api/tasks",
    payload: {
      title: "Task for another date",
      targetDate: "2026-03-07"
    }
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/tasks?date=2026-03-06"
  });

  assert.equal(response.statusCode, 200);
  const body = parsePayload(response.payload);
  const data = body.data as Array<Record<string, unknown>>;

  assert.equal(data.length, 1);
  assert.equal(data[0].title, "Task for selected date");
});

test("PATCH /api/tasks manages status timestamps consistently", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const created = await app.inject({
    method: "POST",
    url: "/api/tasks",
    payload: {
      title: "Transition me",
      targetDate: "2026-03-06",
      status: "todo" satisfies TaskStatus,
      priority: "high" satisfies TaskPriority
    }
  });

  const createdBody = parsePayload(created.payload);
  const taskId = (createdBody.data as Record<string, unknown>).id as string;

  const doneResponse = await app.inject({
    method: "PATCH",
    url: `/api/tasks/${taskId}`,
    payload: {
      status: "done"
    }
  });

  assert.equal(doneResponse.statusCode, 200);
  const donePayload = parsePayload(doneResponse.payload);
  const doneData = donePayload.data as Record<string, unknown>;
  assert.equal(doneData.status, "done");
  assert.notEqual(doneData.completedAt, null);
  assert.equal(doneData.cancelledAt, null);

  const cancelledResponse = await app.inject({
    method: "PATCH",
    url: `/api/tasks/${taskId}`,
    payload: {
      status: "cancelled"
    }
  });

  assert.equal(cancelledResponse.statusCode, 200);
  const cancelledPayload = parsePayload(cancelledResponse.payload);
  const cancelledData = cancelledPayload.data as Record<string, unknown>;
  assert.equal(cancelledData.status, "cancelled");
  assert.equal(cancelledData.completedAt, null);
  assert.notEqual(cancelledData.cancelledAt, null);

  const todoResponse = await app.inject({
    method: "PATCH",
    url: `/api/tasks/${taskId}`,
    payload: {
      status: "todo"
    }
  });

  assert.equal(todoResponse.statusCode, 200);
  const todoPayload = parsePayload(todoResponse.payload);
  const todoData = todoPayload.data as Record<string, unknown>;
  assert.equal(todoData.status, "todo");
  assert.equal(todoData.completedAt, null);
  assert.equal(todoData.cancelledAt, null);
});

test("DELETE /api/tasks removes a task", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const created = await app.inject({
    method: "POST",
    url: "/api/tasks",
    payload: {
      title: "Delete me",
      targetDate: "2026-03-06"
    }
  });

  const createdBody = parsePayload(created.payload);
  const taskId = (createdBody.data as Record<string, unknown>).id as string;

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/tasks/${taskId}`
  });

  assert.equal(deleteResponse.statusCode, 200);

  const getAfterDelete = await app.inject({
    method: "GET",
    url: `/api/tasks/${taskId}`
  });

  assert.equal(getAfterDelete.statusCode, 404);
  const getPayload = parsePayload(getAfterDelete.payload);
  assert.deepEqual(getPayload.error, {
    code: "NOT_FOUND",
    message: "Task not found"
  });
});

test("validation errors return structured JSON shape", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    payload: {
      title: "",
      targetDate: "invalid-date"
    }
  });

  assert.equal(response.statusCode, 400);
  const body = parsePayload(response.payload);
  const error = body.error as Record<string, unknown>;

  assert.equal(error.code, "VALIDATION_ERROR");
  assert.equal(typeof error.message, "string");
});

test("malformed JSON returns a structured validation error", async (t) => {
  const app = createAppForTest();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: {
      "content-type": "application/json"
    },
    payload: "{"
  });

  assert.equal(response.statusCode, 400);
  const body = parsePayload(response.payload);
  const error = body.error as Record<string, unknown>;

  assert.equal(error.code, "VALIDATION_ERROR");
  assert.equal(typeof error.message, "string");
});
