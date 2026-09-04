import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryCommentStore } from "../comments/comment-store.in-memory";
import { InMemoryTaskStore } from "../recurrence/recurrence-test-doubles";
import { TaskCreateInput } from "./task-store";
import { autoCancelUntouchedTasks } from "./auto-cancel-untouched-service";

const USER_ID = "user-1";
const TODAY = new Date("2026-09-04T00:00:00.000Z");

function taskInput(overrides: Partial<TaskCreateInput>): TaskCreateInput {
  return {
    userId: USER_ID,
    title: "Task",
    description: null,
    status: "todo",
    targetDate: new Date("2026-09-01T00:00:00.000Z"),
    dueDate: null,
    priority: "medium",
    project: null,
    plannedTime: null,
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

test("cancels a past, untouched, flagged standalone task and records a comment", async () => {
  const taskStore = new InMemoryTaskStore();
  const commentStore = new InMemoryCommentStore();
  const task = await taskStore.create(taskInput({ autoCancelIfUntouched: true }));

  const result = await autoCancelUntouchedTasks({
    taskStore,
    commentStore,
    userId: USER_ID,
    today: TODAY,
    locale: "en",
  });

  assert.equal(result.cancelledCount, 1);
  const stored = await taskStore.getById(task.id, USER_ID);
  assert.equal(stored?.status, "cancelled");
  assert.ok(stored?.cancelledAt instanceof Date);
  const comments = await commentStore.listByTaskId(task.id);
  assert.equal(comments.length, 1);
  assert.match(comments[0].body, /2026-09-01/);
});

test("leaves an unflagged past task untouched", async () => {
  const taskStore = new InMemoryTaskStore();
  const task = await taskStore.create(taskInput({ autoCancelIfUntouched: false }));

  const result = await autoCancelUntouchedTasks({ taskStore, userId: USER_ID, today: TODAY });

  assert.equal(result.cancelledCount, 0);
  assert.equal((await taskStore.getById(task.id, USER_ID))?.status, "todo");
});

test("spares an in_progress task even when flagged", async () => {
  const taskStore = new InMemoryTaskStore();
  const task = await taskStore.create(
    taskInput({ status: "in_progress", autoCancelIfUntouched: true })
  );

  const result = await autoCancelUntouchedTasks({ taskStore, userId: USER_ID, today: TODAY });

  assert.equal(result.cancelledCount, 0);
  assert.equal((await taskStore.getById(task.id, USER_ID))?.status, "in_progress");
});

test("spares a task dated today", async () => {
  const taskStore = new InMemoryTaskStore();
  const task = await taskStore.create(
    taskInput({ targetDate: TODAY, autoCancelIfUntouched: true })
  );

  const result = await autoCancelUntouchedTasks({ taskStore, userId: USER_ID, today: TODAY });

  assert.equal(result.cancelledCount, 0);
  assert.equal((await taskStore.getById(task.id, USER_ID))?.status, "todo");
});

test("cancels a past recurrence instance by reading the flag from its source task", async () => {
  const taskStore = new InMemoryTaskStore();
  const commentStore = new InMemoryCommentStore();
  // Source dated today so only the "resolve through source" path can cancel the instance.
  const source = await taskStore.create(
    taskInput({ targetDate: TODAY, autoCancelIfUntouched: true })
  );
  const instance = await taskStore.create(
    taskInput({
      targetDate: new Date("2026-09-02T00:00:00.000Z"),
      autoCancelIfUntouched: false,
      recurrenceSourceTaskId: source.id,
    })
  );

  const result = await autoCancelUntouchedTasks({
    taskStore,
    commentStore,
    userId: USER_ID,
    today: TODAY,
  });

  assert.equal(result.cancelledCount, 1);
  assert.equal((await taskStore.getById(instance.id, USER_ID))?.status, "cancelled");
  assert.equal((await taskStore.getById(source.id, USER_ID))?.status, "todo");
});

test("spares a past recurrence instance when its source task lacks the flag", async () => {
  const taskStore = new InMemoryTaskStore();
  const source = await taskStore.create(
    taskInput({
      targetDate: new Date("2026-08-01T00:00:00.000Z"),
      autoCancelIfUntouched: false,
      status: "done",
      completedAt: new Date("2026-08-01T10:00:00.000Z"),
    })
  );
  const instance = await taskStore.create(
    taskInput({
      targetDate: new Date("2026-09-02T00:00:00.000Z"),
      recurrenceSourceTaskId: source.id,
    })
  );

  const result = await autoCancelUntouchedTasks({ taskStore, userId: USER_ID, today: TODAY });

  assert.equal(result.cancelledCount, 0);
  assert.equal((await taskStore.getById(instance.id, USER_ID))?.status, "todo");
});

test("succeeds without a comment store", async () => {
  const taskStore = new InMemoryTaskStore();
  const task = await taskStore.create(taskInput({ autoCancelIfUntouched: true }));

  const result = await autoCancelUntouchedTasks({ taskStore, userId: USER_ID, today: TODAY });

  assert.equal(result.cancelledCount, 1);
  assert.equal((await taskStore.getById(task.id, USER_ID))?.status, "cancelled");
});

test("uses the French comment copy when locale is fr", async () => {
  const taskStore = new InMemoryTaskStore();
  const commentStore = new InMemoryCommentStore();
  const task = await taskStore.create(taskInput({ autoCancelIfUntouched: true }));

  await autoCancelUntouchedTasks({
    taskStore,
    commentStore,
    userId: USER_ID,
    today: TODAY,
    locale: "fr",
  });

  const comments = await commentStore.listByTaskId(task.id);
  assert.match(comments[0].body, /annulée automatiquement/);
});
