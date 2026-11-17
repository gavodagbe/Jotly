import assert from "node:assert/strict";
import test from "node:test";
import type { OutboxEntry } from "./db";
import { planEnqueue } from "./outbox-plan";

const at = (editedAt: number) => ({ editedAt, attempts: 0 });

const create = (seq: number, title = "A"): OutboxEntry => ({
  seq,
  kind: "task.create",
  entityId: "t1",
  payload: {
    title,
    description: null,
    status: "todo",
    targetDate: "2026-11-17",
    dueDate: "2026-11-17",
    priority: "medium",
    project: null,
    assignees: null,
    plannedTime: null,
    autoCancelIfUntouched: false,
  },
  ...at(1),
});

const update = (seq: number | undefined, payload: object, base?: string, editedAt = 2): OutboxEntry => ({
  seq,
  kind: "task.update",
  entityId: "t1",
  payload,
  baseUpdatedAt: base,
  ...at(editedAt),
});

test("an update after a pending create is merged into the create", () => {
  const plan = planEnqueue([create(1)], update(undefined, { status: "done" }), null);
  assert.equal(plan.add, null);
  assert.equal(plan.replace.length, 1);
  assert.equal(plan.replace[0].kind, "task.create");
  assert.deepEqual(
    plan.replace[0].kind === "task.create" && { title: plan.replace[0].payload.title, status: plan.replace[0].payload.status },
    { title: "A", status: "done" }
  );
});

test("successive updates are merged and keep the oldest base version", () => {
  const plan = planEnqueue(
    [update(4, { title: "B" }, "2026-11-17T08:00:00.000Z", 2)],
    update(undefined, { status: "done" }, "2026-11-17T09:00:00.000Z", 5),
    null
  );
  assert.equal(plan.add, null);
  const merged = plan.replace[0];
  assert.equal(merged.kind, "task.update");
  if (merged.kind === "task.update") {
    assert.deepEqual(merged.payload, { title: "B", status: "done" });
    assert.equal(merged.baseUpdatedAt, "2026-11-17T08:00:00.000Z");
    assert.equal(merged.editedAt, 5);
  }
});

test("the entry being sent is never modified", () => {
  const inFlight = update(4, { title: "B" }, "2026-11-17T08:00:00.000Z");
  const plan = planEnqueue([inFlight], update(undefined, { status: "done" }), 4);
  assert.equal(plan.replace.length, 0);
  assert.ok(plan.add);
});

test("an update is not merged into an in-flight create", () => {
  const plan = planEnqueue([create(1)], update(undefined, { status: "done" }), 1);
  assert.equal(plan.replace.length, 0);
  assert.ok(plan.add);
});

test("deleting a task created offline cancels everything for it", () => {
  const timeEntry: OutboxEntry = {
    seq: 3,
    kind: "timeEntry.put",
    entityId: "t1",
    payload: { date: "2026-11-17", fraction: 0.5 },
    ...at(3),
  };
  const plan = planEnqueue([create(1), update(2, { title: "B" }), timeEntry], { kind: "task.delete", entityId: "t1", ...at(4) }, null);
  assert.deepEqual(plan.remove.sort(), [1, 2, 3]);
  assert.equal(plan.add, null);
});

test("deleting a synced task drops its pending updates and queues the delete", () => {
  const plan = planEnqueue([update(7, { title: "B" })], { kind: "task.delete", entityId: "t1", ...at(4) }, null);
  assert.deepEqual(plan.remove, [7]);
  assert.equal(plan.add?.kind, "task.delete");
});

test("a new time entry for the same day replaces the pending one", () => {
  const previous: OutboxEntry = { seq: 9, kind: "timeEntry.put", entityId: "t1", payload: { date: "2026-11-17", fraction: 0.25 }, ...at(1) };
  const otherDay: OutboxEntry = { seq: 10, kind: "timeEntry.put", entityId: "t1", payload: { date: "2026-11-18", fraction: 0.5 }, ...at(1) };
  const plan = planEnqueue(
    [previous, otherDay],
    { kind: "timeEntry.put", entityId: "t1", payload: { date: "2026-11-17", fraction: 1 }, ...at(2) },
    null
  );
  assert.deepEqual(plan.remove, [9]);
  assert.equal(plan.add?.kind, "timeEntry.put");
});
