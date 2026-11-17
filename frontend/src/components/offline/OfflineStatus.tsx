"use client";

import { useEffect, useSyncExternalStore } from "react";
import { registerServiceWorker } from "@/lib/offline/register-service-worker";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getIsOnline(): boolean {
  return navigator.onLine;
}

function getServerIsOnline(): boolean {
  return true;
}

function isFrenchUi(): boolean {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("fr");
}

export function OfflineStatus() {
  const isOnline = useSyncExternalStore(subscribe, getIsOnline, getServerIsOnline);

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[1000] bg-warning px-4 py-1.5 text-center text-xs font-semibold text-white shadow"
      style={{ paddingTop: "max(0.375rem, env(safe-area-inset-top))" }}
    >
      {isFrenchUi()
        ? "Hors ligne — lecture seule. Les donnees affichees peuvent dater."
        : "Offline — read-only. Displayed data may be out of date."}
    </div>
  );
}
