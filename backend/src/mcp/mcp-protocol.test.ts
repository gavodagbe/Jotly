import assert from "node:assert/strict";
import test from "node:test";
import { BASE_URL, buildHarness, callTool, obtainTokens, rpc } from "./mcp-test-helpers";

const WRITE_TOOLS = [
  "ecrire_affirmation",
  "creer_tache",
  "terminer_tache",
  "modifier_tache",
  "creer_rappel",
  "reporter_taches_veille",
  "publier_objectifs",
  "ecrire_bilan",
  "creer_taches",
  "annuler",
];

test("POST /mcp without a token gets 401 with the discovery hint", async () => {
  const h = await buildHarness();
  const response = await rpc(h, null, "tools/list");
  assert.equal(response.statusCode, 401);
  assert.match(
    response.headers["www-authenticate"] as string,
    new RegExp(`resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource/mcp"`)
  );
  await h.app.close();
});

test("initialize returns server instructions that demand proofs", async () => {
  const h = await buildHarness();
  const { access_token } = await obtainTokens(h);
  const response = await rpc(h, access_token, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  assert.equal(response.statusCode, 200);
  const result = response.json().result;
  assert.equal(result.serverInfo.name, "Jotly");
  assert.match(result.instructions, /preuve/);
  assert.match(result.instructions, /jeton_confirmation/);
  await h.app.close();
});

test("every tool declares the oauth2 security scheme, and only read tools are read-only", async () => {
  const h = await buildHarness();
  const { access_token } = await obtainTokens(h);
  const response = await rpc(h, access_token, "tools/list");
  const tools = response.json().result.tools as {
    name: string;
    _meta?: { securitySchemes?: { type: string; scopes: string[] }[] };
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  }[];

  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    "annuler",
    "creer_rappel",
    "creer_tache",
    "creer_taches",
    "ecrire_affirmation",
    "ecrire_bilan",
    "lire_affirmation",
    "lire_journee",
    "lire_objectifs",
    "lire_periode",
    "modifier_tache",
    "publier_objectifs",
    "reporter_taches_veille",
    "terminer_tache",
  ]);
  for (const tool of tools) {
    assert.deepEqual(tool._meta?.securitySchemes, [{ type: "oauth2", scopes: ["jotly"] }], tool.name);
    assert.equal(tool.annotations?.destructiveHint, false, tool.name);
    assert.equal(tool.annotations?.readOnlyHint, !WRITE_TOOLS.includes(tool.name), tool.name);
  }
  assert.ok(!tools.some((tool) => /suppr|delete/i.test(tool.name)), "no deletion tool");
  await h.app.close();
});

test("GET /mcp is 405 once authenticated (stateless server)", async () => {
  const h = await buildHarness();
  const { access_token } = await obtainTokens(h);
  const response = await h.app.inject({
    method: "GET",
    url: "/mcp",
    headers: { authorization: `Bearer ${access_token}` },
  });
  assert.equal(response.statusCode, 405);
  await h.app.close();
});

test("each call is audited with keys and target id, never content", async () => {
  const h = await buildHarness();
  const { access_token } = await obtainTokens(h);
  const { data } = await callTool(h, access_token, "creer_tache", { titre: "Contrat client confidentiel" });

  assert.equal(h.audit.entries.length, 1);
  const [entry] = h.audit.entries;
  assert.equal(entry.tool, "creer_tache");
  assert.equal(entry.status, "ok");
  assert.equal(entry.email, "owner@gmail.com");
  assert.equal(entry.clientId, "https://claude.ai/oauth/mcp-oauth-client-metadata");
  assert.deepEqual(entry.argKeys, ["titre"]);
  assert.equal(entry.targetId, data.preuve.id);
  assert.ok(!JSON.stringify(h.audit.entries).includes("confidentiel"));
  await h.app.close();
});

test("the daily write quota refuses writes beyond the limit but still allows reads", async () => {
  const h = await buildHarness({ dailyWriteLimit: 1 });
  const { access_token } = await obtainTokens(h);

  assert.equal((await callTool(h, access_token, "creer_tache", { titre: "Une" })).isError, false);
  const second = await callTool(h, access_token, "creer_tache", { titre: "Deux" });
  assert.equal(second.isError, true);
  assert.match(second.data.erreur, /Quota/);
  assert.equal((await callTool(h, access_token, "lire_journee")).isError, false);
  assert.equal(h.audit.entries[1].status, "quota_ecritures");
  await h.app.close();
});

test("the per-user call rate limit kicks in after the burst", async () => {
  const h = await buildHarness({ rateLimitBurst: 2, rateLimitPerSecond: 0.001 });
  const { access_token } = await obtainTokens(h);
  await callTool(h, access_token, "lire_journee");
  await callTool(h, access_token, "lire_journee");
  const third = await callTool(h, access_token, "lire_journee");
  assert.equal(third.isError, true);
  assert.equal(h.audit.entries[2].status, "limite_debit");
  await h.app.close();
});

test("invalid tool arguments are rejected before reaching Jotly", async () => {
  const h = await buildHarness();
  const { access_token } = await obtainTokens(h);
  const result = await rpc(h, access_token, "tools/call", { name: "creer_tache", arguments: { titre: "" } });
  const body = result.json();
  assert.ok(body.error || body.result?.isError, "validation error surfaced");
  assert.equal((await h.stores.taskStore.listByUser("user-owner")).length, 0);
  await h.app.close();
});
