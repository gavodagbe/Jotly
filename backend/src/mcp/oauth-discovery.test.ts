import assert from "node:assert/strict";
import test from "node:test";
import { loadMcpConfig } from "./mcp-config";
import { BASE_URL, buildHarness, CLAUDE_REDIRECT } from "./mcp-test-helpers";
import { pkceChallengeS256, randomToken } from "./oauth/oauth-crypto";

test("protected resource metadata points to Jotly as authorization server", async () => {
  const h = await buildHarness();
  for (const url of ["/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-protected-resource"]) {
    const response = await h.app.inject({ method: "GET", url });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.resource, `${BASE_URL}/mcp`);
    assert.deepEqual(body.authorization_servers, [BASE_URL]);
    assert.deepEqual(body.scopes_supported, ["jotly"]);
  }
  await h.app.close();
});

test("authorization server metadata advertises PKCE S256, DCR and CIMD", async () => {
  const h = await buildHarness();
  const response = await h.app.inject({ method: "GET", url: "/.well-known/oauth-authorization-server" });
  const body = response.json();
  assert.equal(body.issuer, BASE_URL);
  assert.equal(body.authorization_endpoint, `${BASE_URL}/oauth/authorize`);
  assert.equal(body.token_endpoint, `${BASE_URL}/oauth/token`);
  assert.equal(body.registration_endpoint, `${BASE_URL}/oauth/register`);
  assert.deepEqual(body.code_challenge_methods_supported, ["S256"]);
  assert.equal(body.client_id_metadata_document_supported, true);
  await h.app.close();
});

test("missing token gets 401 with WWW-Authenticate resource_metadata and no error", async () => {
  const h = await buildHarness();
  const response = await h.app.inject({ method: "GET", url: "/probe" });
  assert.equal(response.statusCode, 401);
  const header = response.headers["www-authenticate"] as string;
  assert.match(header, /^Bearer /);
  assert.match(header, new RegExp(`resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource/mcp"`));
  assert.doesNotMatch(header, /error=/);
  await h.app.close();
});

test("unknown token gets 401 invalid_token", async () => {
  const h = await buildHarness();
  const response = await h.app.inject({
    method: "GET",
    url: "/probe",
    headers: { authorization: "Bearer not-a-real-token" },
  });
  assert.equal(response.statusCode, 401);
  assert.match(response.headers["www-authenticate"] as string, /error="invalid_token"/);
  await h.app.close();
});

test("dynamic registration accepts allowed redirect URIs and rejects others", async () => {
  const h = await buildHarness();
  const ok = await h.app.inject({
    method: "POST",
    url: "/oauth/register",
    payload: { redirect_uris: [CLAUDE_REDIRECT], client_name: "Claude" },
  });
  assert.equal(ok.statusCode, 201);
  const registered = ok.json();
  assert.match(registered.client_id, /^mcp_/);
  assert.equal(registered.client_secret, undefined);
  assert.equal(registered.token_endpoint_auth_method, "none");

  const confidential = await h.app.inject({
    method: "POST",
    url: "/oauth/register",
    payload: { redirect_uris: [CLAUDE_REDIRECT], token_endpoint_auth_method: "client_secret_post" },
  });
  assert.equal(typeof confidential.json().client_secret, "string");

  const rejected = await h.app.inject({
    method: "POST",
    url: "/oauth/register",
    payload: { redirect_uris: ["https://evil.example/callback"] },
  });
  assert.equal(rejected.statusCode, 400);
  assert.equal(rejected.json().error, "invalid_redirect_uri");
  await h.app.close();
});

test("authorize refuses metadata documents from hosts outside the allow-list without redirecting", async () => {
  const h = await buildHarness();
  const query = new URLSearchParams({
    response_type: "code",
    client_id: "https://evil.example/client.json",
    redirect_uri: CLAUDE_REDIRECT,
    code_challenge: pkceChallengeS256(randomToken(48)),
    code_challenge_method: "S256",
  });
  const response = await h.app.inject({ method: "GET", url: `/oauth/authorize?${query}` });
  assert.equal(response.statusCode, 400);
  assert.equal(response.headers.location, undefined);
  assert.deepEqual(h.fetchedUrls, []);
  await h.app.close();
});

test("authorize refuses an unregistered redirect_uri without redirecting", async () => {
  const h = await buildHarness();
  const query = new URLSearchParams({
    response_type: "code",
    client_id: "https://claude.ai/oauth/mcp-oauth-client-metadata",
    redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
    code_challenge: pkceChallengeS256(randomToken(48)),
    code_challenge_method: "S256",
  });
  const response = await h.app.inject({ method: "GET", url: `/oauth/authorize?${query}` });
  assert.equal(response.statusCode, 400);
  assert.equal(response.headers.location, undefined);
  await h.app.close();
});

test("authorize without PKCE S256 redirects back with invalid_request", async () => {
  const h = await buildHarness();
  const query = new URLSearchParams({
    response_type: "code",
    client_id: "https://claude.ai/oauth/mcp-oauth-client-metadata",
    redirect_uri: CLAUDE_REDIRECT,
    state: "s1",
  });
  const response = await h.app.inject({ method: "GET", url: `/oauth/authorize?${query}` });
  assert.equal(response.statusCode, 302);
  const location = new URL(response.headers.location as string);
  assert.equal(location.searchParams.get("error"), "invalid_request");
  assert.equal(location.searchParams.get("state"), "s1");
  assert.equal(location.searchParams.get("iss"), BASE_URL);
  await h.app.close();
});

test("loadMcpConfig is off by default and refuses to start half-configured", () => {
  assert.equal(loadMcpConfig({}), null);
  assert.equal(loadMcpConfig({ MCP_ENABLED: "false" }), null);
  assert.throws(() => loadMcpConfig({ MCP_ENABLED: "true" }), /MCP_ALLOWED_EMAILS is empty/);

  const config = loadMcpConfig({
    MCP_ENABLED: "true",
    MCP_BASE_URL: "https://jotly.example.com/",
    MCP_ALLOWED_EMAILS: " A@Gmail.com , b@gmail.com",
    MCP_JOTLY_USER_EMAIL: "me@jotly.example.com",
    MCP_ALLOWED_REDIRECT_URIS: CLAUDE_REDIRECT,
    GOOGLE_CLIENT_ID: "id",
    GOOGLE_CLIENT_SECRET: "secret",
  });
  assert.ok(config);
  assert.equal(config.resourceUrl, "https://jotly.example.com/mcp");
  assert.deepEqual([...config.allowedEmails], ["a@gmail.com", "b@gmail.com"]);
  assert.deepEqual([...config.cimdAllowedHosts], ["claude.ai", "chatgpt.com"]);
});
