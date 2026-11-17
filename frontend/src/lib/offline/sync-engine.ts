/**
 * Pushes the outbox to the server in order, then refreshes the local copy.
 * See planning/OFFLINE.md for the rules.
 */
import { ApiError, isOfflineError } from "../api/http";
import { entityOf, type JotlyOfflineDb, type OutboxEntry } from "./db";
import { pullAll, sendEntry, tableFor } from "./entity-sync";
import { countOutbox, peekOutbox, setInFlightSeq } from "./outbox";
import { getOfflineSession, isBrowserOnline } from "./session";
import { recordIssue } from "./sync-issues";
import { notifySyncApplied, updateSyncState } from "./sync-status";

export { dismissSyncIssues, loadSyncIssues } from "./sync-issues";

const WINDOW_DAYS_BEFORE = 7;
const WINDOW_DAYS_AFTER = 30;

type OpOutcome = "done" | "stop";

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getSyncWindow(now = new Date()): { from: string; to: string } {
  const from = new Date(now);
  from.setDate(from.getDate() - WINDOW_DAYS_BEFORE);
  const to = new Date(now);
  to.setDate(to.getDate() + WINDOW_DAYS_AFTER);
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

function isRetryable(error: unknown): boolean {
  if (isOfflineError(error)) return true;
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 429 || error.status === 401 || error.status === 408;
  }
  return true;
}

async function processEntry(db: JotlyOfflineDb, entry: OutboxEntry, token: string): Promise<OpOutcome> {
  setInFlightSeq(entry.seq ?? null);
  try {
    await sendEntry(db, entry, token);
  } catch (error) {
    if (isRetryable(error)) {
      await db.outbox.update(entry.seq as number, { attempts: entry.attempts + 1 });
      return "stop";
    }
    // Rejected by the server (validation, not found...): set it aside so the rest can sync.
    const entity = entityOf(entry.kind);
    const table = entity === "timeEntry" ? null : tableFor(db, entity);
    const local = table ? await table.get(entry.entityId) : undefined;
    const isGone = entry.kind.endsWith(".create") || (error instanceof ApiError && error.status === 404);
    if (table && isGone) {
      await table.delete(entry.entityId);
    }
    const label = local?.title ? `"${local.title}": ` : "";
    await recordIssue(db, {
      kind: "rejected",
      entityId: entry.entityId,
      opKind: entry.kind,
      message: `${label}${error instanceof Error ? error.message : "change rejected"}`,
    });
  } finally {
    setInFlightSeq(null);
  }
  await db.outbox.delete(entry.seq as number);
  return "done";
}

/** Download the date window and replace the local copy (pending local edits are preserved). */
export async function pullWindow(db: JotlyOfflineDb, token: string, now = new Date()): Promise<void> {
  await pullAll(db, token, getSyncWindow(now));
}

let running: { promise: Promise<void>; session: ReturnType<typeof getOfflineSession> } | null = null;

/**
 * Push pending changes then pull fresh data. Concurrent calls for the same account
 * share the same run; a run started for another account is awaited first.
 */
export async function syncNow(options: { pull?: boolean } = {}): Promise<void> {
  const session = getOfflineSession();
  if (running && running.session !== session) {
    await running.promise.catch(() => undefined);
  }
  if (!running) {
    const promise = runSync(options.pull ?? true).finally(() => {
      running = null;
    });
    running = { promise, session };
  }
  return running.promise;
}

async function runSync(pull: boolean): Promise<void> {
  const session = getOfflineSession();
  if (!session || !isBrowserOnline()) {
    return;
  }
  const { db, token } = session;
  updateSyncState({ isSyncing: true, pendingCount: await countOutbox(db) });
  let pushed = 0;
  let blocked = false;
  try {
    for (let entry = await peekOutbox(db); entry; entry = await peekOutbox(db)) {
      if ((await processEntry(db, entry, token)) === "stop") {
        blocked = true;
        break;
      }
      pushed += 1;
      updateSyncState({ pendingCount: await countOutbox(db) });
    }
    if (!blocked && pull) {
      await pullWindow(db, token);
    }
    if (!blocked) {
      updateSyncState({ lastSyncedAt: Date.now() });
    }
  } catch {
    // Pull failed (offline again): keep local data, retry on the next trigger.
  } finally {
    if (getOfflineSession() === session) {
      updateSyncState({ isSyncing: false, pendingCount: await countOutbox(db) });
    }
  }
  // Screens only need to reload when local changes were reconciled with the server.
  if (pushed > 0) {
    notifySyncApplied();
  }
}
