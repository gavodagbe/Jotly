/**
 * Observable sync state, shared by the sync engine and the offline banner.
 */
import type { SyncIssue } from "./db";

export type SyncState = {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  issues: SyncIssue[];
};

const INITIAL_STATE: SyncState = { pendingCount: 0, isSyncing: false, lastSyncedAt: null, issues: [] };

let state: SyncState = INITIAL_STATE;
const listeners = new Set<() => void>();

export function getSyncState(): SyncState {
  return state;
}

export function getInitialSyncState(): SyncState {
  return INITIAL_STATE;
}

export function updateSyncState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function resetSyncState(): void {
  state = INITIAL_STATE;
  listeners.forEach((listener) => listener());
}

export function subscribeSyncState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fired after a sync changed local data, so screens can reload. */
export const SYNC_APPLIED_EVENT = "jotly:offline-sync-applied";

export function notifySyncApplied(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYNC_APPLIED_EVENT));
  }
}
