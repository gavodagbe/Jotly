/**
 * Pure merge rules for the outbox: decide how a new local change combines with
 * changes already waiting to be sent. Kept free of IndexedDB so it is easy to test.
 * The same rules apply to tasks, reminders and notes.
 *
 * Rules (the entry currently being sent, `inFlightSeq`, is never modified):
 * - update after a pending create  → merged into the create payload
 * - update after a pending update  → fields merged, the oldest base version is kept
 * - delete after a pending create  → the record never reaches the server: create and
 *                                    everything queued after it are dropped
 * - delete otherwise               → pending changes dropped, delete appended
 * - other actions (reminder complete / cancel) → appended as is
 * - journal save for the same entry → fields merged into the pending save
 * - time entry / routine tick for the same (owner, date) → replaces the previous pending one
 */
import { actionOf, entityOf, type OutboxEntry } from "./db";

export type OutboxPlan = {
  remove: number[];
  replace: OutboxEntry[];
  add: OutboxEntry | null;
};

type WithPayload = { payload: Record<string, unknown>; baseUpdatedAt?: string; editedAt: number };

function isEditable(entry: OutboxEntry, inFlightSeq: number | null): entry is OutboxEntry & { seq: number } {
  return entry.seq !== undefined && entry.seq !== inFlightSeq;
}

function datedKey(entry: OutboxEntry): string | null {
  if (entry.kind === "timeEntry.put") return entry.payload.date;
  if (entry.kind === "routineCompletion.put") return entry.payload.targetDate;
  return null;
}

function mergeInto(target: OutboxEntry, next: OutboxEntry): OutboxEntry {
  // Only called for create/update entries of the same entity, which all carry a payload.
  const base = target as unknown as WithPayload;
  const incoming = next as unknown as WithPayload;
  const merged: WithPayload = { ...base, payload: { ...base.payload, ...incoming.payload }, editedAt: next.editedAt };
  if (actionOf(target.kind) === "update" || target.kind === "journal.put") {
    merged.baseUpdatedAt = base.baseUpdatedAt ?? incoming.baseUpdatedAt;
  }
  return merged as unknown as OutboxEntry;
}

export function planEnqueue(existing: OutboxEntry[], next: OutboxEntry, inFlightSeq: number | null): OutboxPlan {
  const sameEntity = existing.filter((entry) => entry.entityId === next.entityId);
  const editable = sameEntity.filter((entry) => isEditable(entry, inFlightSeq));
  const entity = entityOf(next.kind);
  const action = actionOf(next.kind);

  if (next.kind === "timeEntry.put" || next.kind === "routineCompletion.put") {
    const previous = editable.filter((entry) => entry.kind === next.kind && datedKey(entry) === datedKey(next));
    return { remove: previous.map((entry) => entry.seq), replace: [], add: next };
  }

  if (next.kind === "journal.put") {
    const last = sameEntity[sameEntity.length - 1];
    if (last && last.kind === "journal.put" && isEditable(last, inFlightSeq)) {
      return { remove: [], replace: [mergeInto(last, next)], add: null };
    }
    return { remove: [], replace: [], add: next };
  }

  const pendingCreate = editable.find((entry) => entry.kind === `${entity}.create`);

  switch (action) {
    case "update": {
      if (pendingCreate) {
        return { remove: [], replace: [mergeInto(pendingCreate, next)], add: null };
      }
      const last = sameEntity[sameEntity.length - 1];
      if (last && last.kind === next.kind && isEditable(last, inFlightSeq)) {
        return { remove: [], replace: [mergeInto(last, next)], add: null };
      }
      return { remove: [], replace: [], add: next };
    }

    case "delete": {
      const dropSeqs = editable.map((entry) => entry.seq);
      return { remove: dropSeqs, replace: [], add: pendingCreate ? null : next };
    }

    default:
      return { remove: [], replace: [], add: next };
  }
}
