/*
 * Pure routing rules for the Jotly service worker.
 * Loaded by sw.js through importScripts() and by Node unit tests through require().
 */
(function (root, factory) {
  const rules = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = rules;
  } else {
    root.JotlySwRoutes = rules;
  }
})(typeof self !== "undefined" ? self : this, function () {
  const API_PREFIX = "/backend-api/";

  // Endpoints that only make sense online: never served from the offline cache.
  const ONLINE_ONLY_API_PREFIXES = [
    "/backend-api/assistant",
    "/backend-api/search",
    "/backend-api/google-calendar",
  ];

  const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

  function isOnlineOnlyApi(pathname) {
    if (pathname.includes("/attachments")) {
      return true;
    }
    return ONLINE_ONLY_API_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`)
    );
  }

  /**
   * Decide how the service worker handles a request.
   * @param {{ method: string, url: string, mode?: string, origin: string }} input
   * @returns {"navigation" | "static" | "font" | "api-read" | "api-write" | "api-online-only" | "bypass"}
   */
  function classifyRequest(input) {
    const url = new URL(input.url);
    const method = (input.method || "GET").toUpperCase();

    if (FONT_HOSTS.includes(url.hostname)) {
      return method === "GET" ? "font" : "bypass";
    }

    if (url.origin !== input.origin) {
      return "bypass";
    }

    if (url.pathname.startsWith(API_PREFIX)) {
      if (isOnlineOnlyApi(url.pathname)) {
        return "api-online-only";
      }
      return method === "GET" ? "api-read" : "api-write";
    }

    if (method !== "GET") {
      return "bypass";
    }

    if (input.mode === "navigate") {
      // The admin backoffice stays online-only.
      return url.pathname.startsWith("/admin") ? "bypass" : "navigation";
    }

    if (url.pathname.startsWith("/_next/static/")) {
      return "static";
    }

    return "bypass";
  }

  function isLogoutRequest(input) {
    const url = new URL(input.url);
    return (input.method || "GET").toUpperCase() === "POST" && url.pathname === "/backend-api/auth/logout";
  }

  return { classifyRequest, isLogoutRequest };
});
