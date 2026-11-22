import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeToRedirect,
  BASE_URL,
  buildHarness,
  CLAUDE_CLIENT_ID,
  CLAUDE_REDIRECT,
  form,
  JOTLY_USER_ID,
  obtainTokens,
  OWNER_EMAIL,
} from "./mcp-test-helpers";
import { pkceChallengeS256, randomToken } from "./oauth/oauth-crypto";

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

test("full flow with a URL client_id (CIMD) issues a token that acts as the Jotly user", async () => {
  const h = await buildHarness();
  const tokens = await obtainTokens(h);

  assert.equal(tokens.expires_in, 3600);
  assert.ok(h.store.clients.has(CLAUDE_CLIENT_ID), "client stored under a key containing '/'");
  assert.deepEqual(h.fetchedUrls, [CLAUDE_CLIENT_ID]);

  const probe = await h.app.inject({ method: "GET", url: "/probe", headers: bearer(tokens.access_token) });
  assert.equal(probe.statusCode, 200);
  assert.deepEqual(probe.json(), {
    email: OWNER_EMAIL,
    clientId: CLAUDE_CLIENT_ID,
    scope: "jotly",
    userId: JOTLY_USER_ID,
    timeZone: "Europe/Paris",
  });

  // Only hashes are stored, never the tokens themselves.
  const stored = JSON.stringify([...h.store.tokens.values()]);
  assert.ok(!stored.includes(tokens.access_token));
  assert.ok(!stored.includes(tokens.refresh_token));
  await h.app.close();
});

test("consent redirect carries code, client state and iss", async () => {
  const h = await buildHarness();
  const redirect = await authorizeToRedirect(h);
  assert.equal(`${redirect.origin}${redirect.pathname}`, CLAUDE_REDIRECT);
  assert.ok(redirect.searchParams.get("code"));
  assert.equal(redirect.searchParams.get("state"), "client-state-1");
  assert.equal(redirect.searchParams.get("iss"), BASE_URL);
  await h.app.close();
});

test("denying consent returns access_denied and no code", async () => {
  const h = await buildHarness();
  const redirect = await authorizeToRedirect(h, { decision: "deny" });
  assert.equal(redirect.searchParams.get("error"), "access_denied");
  assert.equal(redirect.searchParams.get("code"), null);
  await h.app.close();
});

test("a Google account outside the allow-list gets 403 and no consent page", async () => {
  for (const identity of [
    { email: "stranger@gmail.com", emailVerified: true },
    { email: OWNER_EMAIL, emailVerified: false },
  ]) {
    const h = await buildHarness();
    h.google.identity = identity;
    await assert.rejects(authorizeToRedirect(h), /callback returned 403/);
    assert.equal(h.store.requests.size, 0);
    await h.app.close();
  }
});

test("token exchange rejects a wrong PKCE verifier and a reused code", async () => {
  const h = await buildHarness();
  const verifier = randomToken(48);
  const redirect = await authorizeToRedirect(h, { verifier });
  const code = redirect.searchParams.get("code") as string;
  const exchange = (codeVerifier: string) =>
    h.app.inject({
      method: "POST",
      url: "/oauth/token",
      ...form({
        grant_type: "authorization_code",
        code,
        redirect_uri: CLAUDE_REDIRECT,
        client_id: CLAUDE_CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });

  const wrong = await exchange(randomToken(48));
  assert.equal(wrong.statusCode, 400);
  assert.equal(wrong.json().error, "invalid_grant");
  // The failed attempt consumed the code: it cannot be retried, even with the right verifier.
  const reused = await exchange(verifier);
  assert.equal(reused.json().error, "invalid_grant");
  await h.app.close();
});

test("refresh rotates tokens and a replayed refresh token revokes the whole family", async () => {
  const h = await buildHarness();
  const first = await obtainTokens(h);
  const refresh = (token: string) =>
    h.app.inject({
      method: "POST",
      url: "/oauth/token",
      ...form({ grant_type: "refresh_token", refresh_token: token, client_id: CLAUDE_CLIENT_ID }),
    });

  const second = await refresh(first.refresh_token);
  assert.equal(second.statusCode, 200);
  const rotated = second.json();
  assert.notEqual(rotated.refresh_token, first.refresh_token);

  const ok = await h.app.inject({ method: "GET", url: "/probe", headers: bearer(rotated.access_token) });
  assert.equal(ok.statusCode, 200);

  const replay = await refresh(first.refresh_token);
  assert.equal(replay.json().error, "invalid_grant");
  const afterReplay = await h.app.inject({ method: "GET", url: "/probe", headers: bearer(rotated.access_token) });
  assert.equal(afterReplay.statusCode, 401);
  await h.app.close();
});

test("removing the address from the allow-list cuts access immediately", async () => {
  const h = await buildHarness();
  const tokens = await obtainTokens(h);
  h.config.allowedEmails.delete(OWNER_EMAIL);
  const response = await h.app.inject({ method: "GET", url: "/probe", headers: bearer(tokens.access_token) });
  assert.equal(response.statusCode, 401);
  await h.app.close();
});

test("a refresh token cannot be used as an access token", async () => {
  const h = await buildHarness();
  const tokens = await obtainTokens(h);
  const response = await h.app.inject({ method: "GET", url: "/probe", headers: bearer(tokens.refresh_token) });
  assert.equal(response.statusCode, 401);
  await h.app.close();
});

test("confidential DCR client must authenticate at the token endpoint", async () => {
  const h = await buildHarness();
  const registered = (
    await h.app.inject({
      method: "POST",
      url: "/oauth/register",
      payload: { redirect_uris: [CLAUDE_REDIRECT], token_endpoint_auth_method: "client_secret_basic" },
    })
  ).json();
  const verifier = randomToken(48);
  const redirect = await authorizeToRedirect(h, { clientId: registered.client_id, verifier });
  const body = {
    grant_type: "authorization_code",
    code: redirect.searchParams.get("code") as string,
    redirect_uri: CLAUDE_REDIRECT,
    code_verifier: verifier,
  };

  const noSecret = await h.app.inject({
    method: "POST",
    url: "/oauth/token",
    ...form({ ...body, client_id: registered.client_id }),
  });
  assert.equal(noSecret.statusCode, 401);
  assert.equal(noSecret.json().error, "invalid_client");

  // The code was not consumed by the unauthenticated attempt.
  const basic = Buffer.from(`${registered.client_id}:${registered.client_secret}`).toString("base64");
  const withSecret = await h.app.inject({
    method: "POST",
    url: "/oauth/token",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${basic}` },
    payload: new URLSearchParams(body).toString(),
  });
  assert.equal(withSecret.statusCode, 200);
  assert.ok(withSecret.json().access_token);
  await h.app.close();
});

test("consent page cannot be replayed through the Google callback", async () => {
  const h = await buildHarness();
  const verifier = randomToken(48);
  const query = new URLSearchParams({
    response_type: "code",
    client_id: CLAUDE_CLIENT_ID,
    redirect_uri: CLAUDE_REDIRECT,
    code_challenge: pkceChallengeS256(verifier),
    code_challenge_method: "S256",
  });
  const authorize = await h.app.inject({ method: "GET", url: `/oauth/authorize?${query}` });
  const state = new URL(authorize.headers.location as string).searchParams.get("state") as string;
  const callbackUrl = `/oauth/google/callback?state=${encodeURIComponent(state)}&code=c`;

  assert.equal((await h.app.inject({ method: "GET", url: callbackUrl })).statusCode, 200);
  assert.equal((await h.app.inject({ method: "GET", url: callbackUrl })).statusCode, 400);
  await h.app.close();
});
