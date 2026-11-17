/**
 * Starts/stops the offline layer for the signed-in account and wires the sync
 * triggers: network back, app visible again, and a periodic retry.
 */
import { countOutbox } from "./outbox";
import { clearOfflineSessionState, getOfflineSession, setOfflineSession } from "./session";
import { loadSyncIssues, syncNow } from "./sync-engine";
import { resetSyncState, updateSyncState } from "./sync-status";

const RETRY_INTERVAL_MS = 60_000;

let detachTriggers: (() => void) | null = null;

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function attachTriggers(): () => void {
  const onOnline = () => void syncNow();
  const onVisible = () => {
    if (document.visibilityState === "visible") void syncNow();
  };
  const timer = window.setInterval(() => {
    const session = getOfflineSession();
    if (!session) return;
    void countOutbox(session.db).then((pending) => {
      if (pending > 0) void syncNow({ pull: false });
    });
  }, RETRY_INTERVAL_MS);

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
  };
}

/** Call once the user is authenticated (and again when the token changes). */
export async function startOfflineSession(userId: string, token: string): Promise<void> {
  if (typeof window === "undefined" || !isIndexedDbAvailable()) {
    return;
  }
  const previous = getOfflineSession();
  const session = setOfflineSession(userId, token);
  if (previous?.userId === userId && detachTriggers) {
    return;
  }
  detachTriggers?.();
  detachTriggers = attachTriggers();
  try {
    updateSyncState({
      pendingCount: await countOutbox(session.db),
      issues: await loadSyncIssues(session.db),
    });
  } catch {
    // IndexedDB unavailable (private mode...): the repository keeps working online.
    stopOfflineSession();
    return;
  }
  void syncNow();
}

/**
 * Call on logout. The local database is kept so changes not yet sent are not
 * lost; they are pushed the next time this account signs in.
 */
export function stopOfflineSession(): void {
  detachTriggers?.();
  detachTriggers = null;
  clearOfflineSessionState();
  resetSyncState();
}
