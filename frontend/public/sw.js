/*
 * Jotly service worker — phase 1 of the offline mode (see planning/OFFLINE.md).
 * - App shell and static assets available offline.
 * - API reads: network-first, cached copy used when offline (per user).
 * - API writes: never cached; a clear "offline" error is returned when the network is down.
 */
importScripts("/sw-routes.js");

const CACHE_VERSION = "v1";
const SHELL_CACHE = `jotly-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `jotly-static-${CACHE_VERSION}`;
const API_CACHE = `jotly-api-${CACHE_VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, STATIC_CACHE, API_CACHE];
const SHELL_URL = "/";
const SHELL_PRECACHE = [SHELL_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

const { classifyRequest, isLogoutRequest } = self.JotlySwRoutes;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_PRECACHE))
      .then(() => caches.match(SHELL_URL))
      .then((shell) => (shell ? precacheShellAssets(shell.clone()) : undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("jotly-") && !KNOWN_CACHES.includes(key)).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const kind = classifyRequest({
    method: request.method,
    url: request.url,
    mode: request.mode,
    origin: self.location.origin,
  });

  switch (kind) {
    case "navigation":
      event.respondWith(handleNavigation(request));
      return;
    case "static":
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    case "font":
      event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
      return;
    case "api-read":
      event.respondWith(handleApiRead(request));
      return;
    case "api-write":
    case "api-online-only":
      event.respondWith(handleApiNetworkOnly(request));
      return;
    default:
      return;
  }
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok && new URL(request.url).pathname === SHELL_URL) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(SHELL_URL, response.clone());
      // A new deployment ships new hashed bundles: fetch them now, while online.
      precacheShellAssets(response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    const cached = (await caches.match(request)) || (await caches.match(SHELL_URL));
    return cached || offlineResponse();
  }
}

// The page loaded before the worker took control, so its bundles were not seen
// by the fetch handler: read them from the shell HTML and cache them explicitly.
async function precacheShellAssets(shellResponse) {
  const html = await shellResponse.text();
  const assetUrls = Array.from(new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []));
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    assetUrls.map(async (assetUrl) => {
      if (await cache.match(assetUrl)) {
        return;
      }
      try {
        const response = await fetch(assetUrl);
        if (response.ok) {
          await cache.put(assetUrl, response);
        }
      } catch {
        // Best effort: a missing chunk is fetched again on next online visit.
      }
    })
  );
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached || (await network) || offlineResponse();
}

async function handleApiRead(request) {
  const cacheKey = await getUserScopedCacheKey(request);
  try {
    const response = await fetch(request);
    if (response.status === 401) {
      await caches.delete(API_CACHE);
    } else if (response.ok && cacheKey) {
      const cache = await caches.open(API_CACHE);
      await cache.put(cacheKey, response.clone());
    }
    return response;
  } catch {
    const cached = cacheKey ? await caches.match(cacheKey, { cacheName: API_CACHE }) : undefined;
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("X-Jotly-Offline-Cache", "1");
      return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
    }
    return offlineApiResponse("This data is not available offline yet. Open it once while online.");
  }
}

async function handleApiNetworkOnly(request) {
  const logout = isLogoutRequest({ method: request.method, url: request.url });
  if (logout) {
    await caches.delete(API_CACHE);
  }
  try {
    const response = await fetch(request);
    if (response.status === 401) {
      await caches.delete(API_CACHE);
    }
    return response;
  } catch {
    if (logout) {
      // Local session is cleared anyway; pretend the logout succeeded.
      return new Response(null, { status: 204 });
    }
    return offlineApiResponse("You are offline. This action needs an internet connection.");
  }
}

// Cache API entries are keyed per user (hash of the bearer token) so that
// a different account on the same device never sees someone else's data.
async function getUserScopedCacheKey(request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return null;
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(authorization));
  const userKey = Array.from(new Uint8Array(digest).slice(0, 12))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const url = new URL(request.url);
  url.searchParams.set("__jotly_user", userKey);
  return url.toString();
}

function offlineApiResponse(message) {
  return new Response(JSON.stringify({ error: { code: "OFFLINE", message } }), {
    status: 503,
    headers: { "Content-Type": "application/json", "X-Jotly-Offline": "1" },
  });
}

function offlineResponse() {
  return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
}
