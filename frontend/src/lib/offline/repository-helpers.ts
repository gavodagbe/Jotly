/**
 * Write path shared by the task, reminder and note repositories:
 * direct call when online with nothing queued, otherwise local apply + outbox.
 */
import { isOfflineError } from "../api/http";
import type { OutboxOp } from "./db";
import { countOutbox, enqueue } from "./outbox";
import { isBrowserOnline, type OfflineSession } from "./session";
import { syncNow } from "./sync-engine";
import { updateSyncState } from "./sync-status";

export async function canWriteDirectly(session: OfflineSession): Promise<boolean> {
  return isBrowserOnline() && (await countOutbox(session.db)) === 0;
}

export async function queueLocally(session: OfflineSession, op: OutboxOp): Promise<void> {
  await enqueue(session.db, op);
  updateSyncState({ pendingCount: await countOutbox(session.db) });
  void syncNow({ pull: false });
}

/**
 * Run `direct` when the server is reachable and nothing is queued; fall back to
 * `offline` (apply locally + queue) when the network turns out to be down.
 * Server rejections (validation...) are rethrown so the UI shows them as before.
 */
export async function writeThrough<T>(
  session: OfflineSession,
  direct: () => Promise<T>,
  offline: () => Promise<T>
): Promise<T> {
  if (await canWriteDirectly(session)) {
    try {
      return await direct();
    } catch (error) {
      if (!isOfflineError(error)) throw error;
    }
  }
  return offline();
}

/** Run a server read and store it; when offline, keep going with the local copy. */
export async function refreshFromServer(load: () => Promise<void>): Promise<void> {
  try {
    await load();
  } catch (error) {
    if (!isOfflineError(error)) throw error;
  }
}
