"use client";

import { useEffect, useSyncExternalStore } from "react";
import { registerServiceWorker } from "@/lib/offline/register-service-worker";
import { dismissSyncIssues } from "@/lib/offline/sync-engine";
import { getInitialSyncState, getSyncState, subscribeSyncState } from "@/lib/offline/sync-status";

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getIsOnline = () => navigator.onLine;
const getServerIsOnline = () => true;

function isFrenchUi(): boolean {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("fr");
}

function pendingLabel(count: number, fr: boolean): string {
  if (fr) return count === 1 ? "1 modification en attente" : `${count} modifications en attente`;
  return count === 1 ? "1 change waiting" : `${count} changes waiting`;
}

const BAR_CLASS = "fixed inset-x-0 top-0 z-[1000] px-4 py-1.5 text-center text-xs font-semibold shadow";
const SAFE_AREA_STYLE = { paddingTop: "max(0.375rem, env(safe-area-inset-top))" };

export function OfflineStatus() {
  const isOnline = useSyncExternalStore(subscribeOnline, getIsOnline, getServerIsOnline);
  const sync = useSyncExternalStore(subscribeSyncState, getSyncState, getInitialSyncState);
  const fr = isFrenchUi();

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  if (!isOnline) {
    const pending = sync.pendingCount > 0 ? ` — ${pendingLabel(sync.pendingCount, fr)}` : "";
    return (
      <div role="status" aria-live="polite" className={`${BAR_CLASS} bg-warning text-white`} style={SAFE_AREA_STYLE}>
        {fr
          ? `Hors ligne — les tâches restent modifiables, elles seront envoyées au retour du réseau${pending}.`
          : `Offline — tasks stay editable and will be sent when the network is back${pending}.`}
      </div>
    );
  }

  if (sync.pendingCount > 0) {
    return (
      <div role="status" aria-live="polite" className={`${BAR_CLASS} bg-accent text-white`} style={SAFE_AREA_STYLE}>
        {sync.isSyncing
          ? fr
            ? `Synchronisation… ${pendingLabel(sync.pendingCount, fr)}`
            : `Syncing… ${pendingLabel(sync.pendingCount, fr)}`
          : fr
          ? `${pendingLabel(sync.pendingCount, fr)} — nouvel essai automatique`
          : `${pendingLabel(sync.pendingCount, fr)} — retrying automatically`}
      </div>
    );
  }

  if (sync.issues.length > 0) {
    const latest = sync.issues[sync.issues.length - 1];
    const summary = fr
      ? `Synchronisé avec ${sync.issues.length} conflit(s) ou refus`
      : `Synced with ${sync.issues.length} conflict(s) or rejected change(s)`;
    return (
      <div role="status" aria-live="polite" className={`${BAR_CLASS} bg-surface text-foreground`} style={SAFE_AREA_STYLE}>
        <span title={sync.issues.map((issue) => issue.message).join("\n")}>
          {summary}: {latest.message}
        </span>
        <button
          type="button"
          className="ml-3 rounded px-2 py-0.5 text-accent underline"
          onClick={() => void dismissSyncIssues()}
        >
          {fr ? "OK" : "Dismiss"}
        </button>
      </div>
    );
  }

  return null;
}
