import type { JotlyOfflineDb, OutboxEntry, OutboxOp } from "./db";
import { planEnqueue } from "./outbox-plan";

let inFlightSeq: number | null = null;

export function setInFlightSeq(seq: number | null): void {
  inFlightSeq = seq;
}

/** Append a local change to the outbox, merging it with pending changes when possible. */
export async function enqueue(db: JotlyOfflineDb, op: OutboxOp, editedAt = Date.now()): Promise<void> {
  const entry: OutboxEntry = { ...op, editedAt, attempts: 0 };
  await db.transaction("rw", db.outbox, async () => {
    const existing = await db.outbox.where("entityId").equals(op.entityId).sortBy("seq");
    const plan = planEnqueue(existing, entry, inFlightSeq);
    if (plan.remove.length > 0) {
      await db.outbox.bulkDelete(plan.remove);
    }
    if (plan.replace.length > 0) {
      await db.outbox.bulkPut(plan.replace);
    }
    if (plan.add) {
      await db.outbox.add(plan.add);
    }
  });
}

export async function peekOutbox(db: JotlyOfflineDb): Promise<OutboxEntry | undefined> {
  return db.outbox.orderBy("seq").first();
}

export async function countOutbox(db: JotlyOfflineDb): Promise<number> {
  return db.outbox.count();
}

export async function hasOtherPendingOps(db: JotlyOfflineDb, entityId: string, exceptSeq: number): Promise<boolean> {
  const entries = await db.outbox.where("entityId").equals(entityId).toArray();
  return entries.some((entry) => entry.seq !== exceptSeq);
}
