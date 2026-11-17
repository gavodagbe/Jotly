// Run with: npm run test:offline
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { classifyRequest, isLogoutRequest } = require("../../../public/sw-routes.js");

const origin = "https://jotly.godwinavodagbe.com";
const classify = (method, path, mode) => classifyRequest({ method, url: new URL(path, origin).toString(), mode, origin });

test("page navigations are served by the app shell", () => {
  assert.equal(classify("GET", "/", "navigate"), "navigation");
  assert.equal(classify("GET", "/?date=2026-11-17", "navigate"), "navigation");
});

test("admin backoffice stays online-only", () => {
  assert.equal(classify("GET", "/admin", "navigate"), "bypass");
  assert.equal(classify("GET", "/admin/projects", "navigate"), "bypass");
});

test("hashed Next.js assets are cached", () => {
  assert.equal(classify("GET", "/_next/static/chunks/main-abc123.js", "no-cors"), "static");
});

test("Google Fonts are cached", () => {
  assert.equal(
    classifyRequest({ method: "GET", url: "https://fonts.gstatic.com/s/font.woff2", mode: "cors", origin }),
    "font"
  );
});

test("API reads are cacheable", () => {
  assert.equal(classify("GET", "/backend-api/tasks?date=2026-11-17", "cors"), "api-read");
  assert.equal(classify("GET", "/backend-api/auth/me", "cors"), "api-read");
  assert.equal(classify("GET", "/backend-api/reminders/pending", "cors"), "api-read");
  assert.equal(classify("GET", "/backend-api/notes?date=2026-11-17", "cors"), "api-read");
});

test("API writes are never cached", () => {
  assert.equal(classify("POST", "/backend-api/tasks", "cors"), "api-write");
  assert.equal(classify("PATCH", "/backend-api/tasks/abc", "cors"), "api-write");
  assert.equal(classify("DELETE", "/backend-api/tasks/abc", "cors"), "api-write");
});

test("online-only API endpoints are excluded from the cache", () => {
  assert.equal(classify("GET", "/backend-api/assistant/history", "cors"), "api-online-only");
  assert.equal(classify("GET", "/backend-api/search?q=foo", "cors"), "api-online-only");
  assert.equal(classify("GET", "/backend-api/google-calendar/events", "cors"), "api-online-only");
  assert.equal(classify("GET", "/backend-api/tasks/abc/attachments", "cors"), "api-online-only");
  assert.equal(classify("GET", "/backend-api/notes/abc/attachments/def", "cors"), "api-online-only");
});

test("similar but unrelated paths are not excluded", () => {
  assert.equal(classify("GET", "/backend-api/searchable-things", "cors"), "api-read");
});

test("other origins and non-GET non-API requests bypass the worker", () => {
  assert.equal(
    classifyRequest({ method: "GET", url: "https://example.com/x.js", mode: "no-cors", origin }),
    "bypass"
  );
  assert.equal(classify("POST", "/some-form", "navigate"), "bypass");
  assert.equal(classify("GET", "/favicon.ico", "no-cors"), "bypass");
});

test("logout detection", () => {
  assert.equal(isLogoutRequest({ method: "POST", url: `${origin}/backend-api/auth/logout` }), true);
  assert.equal(isLogoutRequest({ method: "GET", url: `${origin}/backend-api/auth/logout` }), false);
  assert.equal(isLogoutRequest({ method: "POST", url: `${origin}/backend-api/auth/login` }), false);
});
