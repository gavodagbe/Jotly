/**
 * Building blocks shared by the per-entity sync handlers (tasks, reminders, notes).
 */
import type { Table } from "dexie";
import { ApiError } from "../api/http";
import type { JotlyOfflineDb, OutboxEntry } from "./db";
import { hasOtherPendingOps } from "./outbox";
import { recordIssue } from "./sync-issues";

type Versioned = { id: string; updatedAt?: string; createdAt?: string };

/** Store the server copy, unless later local edits are still waiting (keep them, refresh the version only). */
export async function storeServerRecord<T extends Versioned>(
  db: JotlyOfflineDb,
  table: Table<T, string>,
  entry: OutboxEntry,
  serverRecord: T
): Promise<void> {
  if (await hasOtherPendingOps(db, entry.entityId, entry.seq ?? -1)) {
    const local = await table.get(entry.entityId);
    await table.put(
      local ? { ...local, updatedAt: serverRecord.updatedAt, createdAt: serverRecord.createdAt } : serverRecord
    );
    return;
  }
  await table.put(serverRecord);
}

/**
 * Send an update with its base version. On a 409 conflict the most recent change wins:
 * the local edit time is compared with the server copy's updatedAt.
 */
export async function sendUpdateResolvingConflict<T extends { updatedAt?: string }>(options: {
  db: JotlyOfflineDb;
  entry: OutboxEntry & { baseUpdatedAt?: string };
  send: (baseUpdatedAt?: string) => Promise<T>;
  /** Save a server copy locally (default for id-based tables: storeServerRecord). */
  store: (record: T) => Promise<void>;
  label: (record: T) => string;
}): Promise<void> {
  const { db, entry, send, store, label } = options;
  try {
    await store(await send(entry.baseUpdatedAt));
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 409 || !error.data) {
      throw error;
    }
    const serverRecord = error.data as T;
    const serverEditedAt = serverRecord.updatedAt ? Date.parse(serverRecord.updatedAt) : 0;
    if (entry.editedAt > serverEditedAt) {
      const saved = await send(undefined);
      await store(saved);
      await recordIssue(db, {
        kind: "conflict",
        entityId: entry.entityId,
        opKind: entry.kind,
        message: `"${label(saved)}": changed elsewhere too — your offline change was more recent and was kept.`,
      });
    } else {
      await store(serverRecord);
      await recordIssue(db, {
        kind: "conflict",
        entityId: entry.entityId,
        opKind: entry.kind,
        message: `"${label(serverRecord)}": changed elsewhere more recently — the other version was kept.`,
      });
    }
  }
}

/** A delete replayed after the record is already gone is a success. */
export async function ignoreNotFound(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
}
