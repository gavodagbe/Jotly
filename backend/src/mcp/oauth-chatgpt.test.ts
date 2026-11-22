import { generateKeyPairSync, KeyObject, sign } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { authorizeToRedirect, BASE_URL, buildHarness, form, TestHarness } from "./mcp-test-helpers";
import { randomToken } from "./oauth/oauth-crypto";

// Mirrors https://chatgpt.com/oauth/client.json as published on 22/11/2026.
const CHATGPT_ID = "https://chatgpt.com/oauth/client.json";
const CHATGPT_REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect";
const JWKS_URI = "https://chatgpt.com/oauth/jwks.json";
const TOKEN_ENDPOINT = `${BASE_URL}/oauth/token`;
const KID = "cimd-test";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const { privateKey: otherKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

function chatgptDocuments(overrides: Record<string, unknown> = {}) {
  return {
    [CHATGPT_ID]: {
      client_id: CHATGPT_ID,
      client_name: "ChatGPT",
      redirect_uris: [CHATGPT_REDIRECT],
      token_endpoint_auth_method: "private_key_jwt",
      token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
      token_endpoint_auth_signing_alg: "RS256",
      jwks_uri: JWKS_URI,
      ...overrides,
    },
    [JWKS_URI]: { keys: [{ ...publicKey.export({ format: "jwk" }), kid: KID, use: "sig", alg: "RS256" }] },
  };
}

function signAssertion(claims: Record<string, unknown> = {}, key: KeyObject = privateKey, kid = KID) {
  const nowS = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "RS256", typ: "JWT", kid });
  const payload = encode({
    iss: CHATGPT_ID,
    sub: CHATGPT_ID,
    aud: TOKEN_ENDPOINT,
    iat: nowS,
    exp: nowS + 300,
    jti: randomToken(12),
    ...claims,
  });
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), key).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

async function codeFor(h: TestHarness, verifier: string) {
  const redirect = await authorizeToRedirect(h, { clientId: CHATGPT_ID, redirectUri: CHATGPT_REDIRECT, verifier });
  return redirect.searchParams.get("code") as string;
}

function exchange(h: TestHarness, code: string, verifier: string, assertion: string | null, extra: Record<string, string> = {}) {
  return h.app.inject({
    method: "POST",
    url: "/oauth/token",
    ...form({
      grant_type: "authorization_code",
      code,
      redirect_uri: CHATGPT_REDIRECT,
      code_verifier: verifier,
      ...(assertion
        ? { client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer", client_assertion: assertion }
        : {}),
      ...extra,
    }),
  });
}

test("discovery advertises private_key_jwt with RS256", async () => {
  const h = await buildHarness();
  const body = (await h.app.inject({ method: "GET", url: "/.well-known/oauth-authorization-server" })).json();
  assert.ok(body.token_endpoint_auth_methods_supported.includes("private_key_jwt"));
  assert.ok(body.token_endpoint_auth_signing_alg_values_supported.includes("RS256"));
  await h.app.close();
});

test("ChatGPT (private_key_jwt) completes the flow with a valid signed assertion", async () => {
  const h = await buildHarness({}, { documents: chatgptDocuments() });
  const verifier = randomToken(48);
  const code = await codeFor(h, verifier);
  assert.equal(h.store.clients.get(CHATGPT_ID)?.jwksUri, JWKS_URI);

  // ChatGPT may omit client_id: the assertion's issuer names the client.
  const response = await exchange(h, code, verifier, signAssertion());
  assert.equal(response.statusCode, 200, response.body);
  const tokens = response.json();
  assert.ok(tokens.access_token);

  const refreshed = await h.app.inject({
    method: "POST",
    url: "/oauth/token",
    ...form({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: CHATGPT_ID,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: signAssertion(),
    }),
  });
  assert.equal(refreshed.statusCode, 200, refreshed.body);
  await h.app.close();
});

test("the token endpoint refuses bad, missing, misdirected, expired or replayed assertions", async () => {
  const cases: [string, string | null, RegExp][] = [
    ["missing", null, /assertion is required/],
    ["wrong key", signAssertion({}, otherKey), /bad signature/],
    ["unknown kid", signAssertion({}, privateKey, "other-kid"), /no signing key/],
    ["wrong audience", signAssertion({ aud: "https://evil.example/token" }), /wrong audience/],
    ["expired", signAssertion({ exp: Math.floor(Date.now() / 1000) - 600 }), /expired/],
    ["other issuer", signAssertion({ iss: "https://claude.ai/x", sub: "https://claude.ai/x" }), /iss\/sub/],
  ];
  // A fresh server per case: each flow costs several OAuth requests against the per-IP limit.
  for (const [label, assertion, reason] of cases) {
    const h = await buildHarness({}, { documents: chatgptDocuments() });
    const verifier = randomToken(48);
    const response = await exchange(h, await codeFor(h, verifier), verifier, assertion, { client_id: CHATGPT_ID });
    assert.equal(response.statusCode, 401, label);
    assert.equal(response.json().error, "invalid_client", label);
    assert.match(response.json().error_description, reason, label);
    await h.app.close();
  }

  const h = await buildHarness({}, { documents: chatgptDocuments() });
  const replayed = signAssertion();
  const first = randomToken(48);
  assert.equal((await exchange(h, await codeFor(h, first), first, replayed)).statusCode, 200);
  const second = randomToken(48);
  const again = await exchange(h, await codeFor(h, second), second, replayed);
  assert.equal(again.statusCode, 401);
  assert.match(again.json().error_description, /replayed/);
  await h.app.close();
});

test("a private_key_jwt client whose keys live on a host outside the allow-list is refused at authorize", async () => {
  const h = await buildHarness({}, { documents: chatgptDocuments({ jwks_uri: "https://evil.example/jwks.json" }) });
  await assert.rejects(
    authorizeToRedirect(h, { clientId: CHATGPT_ID, redirectUri: CHATGPT_REDIRECT }),
    /authorize returned 400/
  );
  await h.app.close();
});
