const SERVICE_WORKER_URL = "/sw.js";

/**
 * Registers the offline service worker. Production only: in development the
 * cache would serve stale bundles and fight with hot reload.
 */
export async function registerServiceWorker(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
  } catch (error) {
    console.warn("[Jotly] Service worker registration failed", error);
  }
}
