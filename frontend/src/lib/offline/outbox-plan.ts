/**
 * Pure merge rules for the outbox: decide how a new local change combines with
 * changes already waiting to be sent. Kept free of IndexedDB so it is easy to test.
 *
 * Rules (the entry currently being sent, `inFlightSeq`, is never modified):
 * - update after a pending create  → merged into the create payload
 * - update after a pending update  → fields merged, the oldest base version is kept
 * - delete after a pending create  → the task never reaches the server: create,
 *                                    its updates and time entries are all dropped
 * - delete otherwise               → pending updates/time entries dropped, delete appended
 * - time entry for the same (task, date) → replaces the previous pending one
 */
import type { OutboxEntry } from "./db";

export type OutboxPlan = {
  remove: number[];
  replace: OutboxEntry[];
  add: OutboxEntry | null;
};

function isEditable(entry: OutboxEntry, inFlightSeq: number | null): entry is OutboxEntry & { seq: number } {
  return entry.seq !== undefined && entry.seq !== inFlightSeq;
}

export function planEnqueue(existing: OutboxEntry[], next: OutboxEntry, inFlightSeq: number | null): OutboxPlan {
  const sameEntity = existing.filter((entry) => entry.entityId === next.entityId);
  const editable = sameEntity.filter((entry) => isEditable(entry, inFlightSeq));
  const pendingCreate = editable.find((entry) => entry.kind === "task.create");

  switch (next.kind) {
    case "task.create":
      return { remove: [], replace: [], add: next };

    case "task.update": {
      if (pendingCreate && pendingCreate.kind === "task.create") {
        return {
          remove: [],
          replace: [{ ...pendingCreate, payload: { ...pendingCreate.payload, ...next.payload }, editedAt: next.editedAt }],
          add: null,
        };
      }
      const last = sameEntity[sameEntity.length - 1];
      if (last && last.kind === "task.update" && isEditable(last, inFlightSeq)) {
        return {
          remove: [],
          replace: [
            {
              ...last,
              payload: { ...last.payload, ...next.payload },
              baseUpdatedAt: last.baseUpdatedAt ?? next.baseUpdatedAt,
              editedAt: next.editedAt,
            },
          ],
          add: null,
        };
      }
      return { remove: [], replace: [], add: next };
    }

    case "task.delete": {
      const dropSeqs = editable
        .filter((entry) => entry.kind === "task.update" || entry.kind === "timeEntry.put" || entry.kind === "task.create")
        .map((entry) => entry.seq);
      if (pendingCreate) {
        return { remove: dropSeqs, replace: [], add: null };
      }
      return { remove: dropSeqs, replace: [], add: next };
    }

    case "timeEntry.put": {
      const previous = editable.filter(
        (entry) => entry.kind === "timeEntry.put" && entry.payload.date === next.payload.date
      );
      return { remove: previous.map((entry) => entry.seq), replace: [], add: next };
    }
  }
}
