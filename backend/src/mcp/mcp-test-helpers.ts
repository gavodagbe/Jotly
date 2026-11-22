import Fastify, { FastifyInstance } from "fastify";
import { McpConfig } from "./mcp-config";
import { registerMcp } from "./mcp-plugin";
import { GoogleIdentity, GoogleIdentityProvider } from "./oauth/google-identity";
import { pkceChallengeS256, randomToken } from "./oauth/oauth-crypto";
import { InMemoryMcpOAuthStore } from "./oauth/oauth-store.in-memory";

export const BASE_URL = "https://jotly.test";
export const CLAUDE_CLIENT_ID = "https://claude.ai/oauth/mcp-oauth-client-metadata";
export const CLAUDE_REDIRECT = "https://claude.ai/api/mcp/auth_callback";
export const OWNER_EMAIL = "owner@gmail.com";
export const JOTLY_USER_ID = "user-owner";

export function testConfig(overrides: Partial<McpConfig> = {}): McpConfig {
  return {
    baseUrl: BASE_URL,
    resourceUrl: `${BASE_URL}/mcp`,
    allowedEmails: new Set([OWNER_EMAIL, "owner.second@gmail.com"]),
    jotlyUserEmail: "owner@jotly.test",
    allowedRedirectUris: [CLAUDE_REDIRECT, "https://chatgpt.com/connector_platform_oauth_redirect"],
    cimdAllowedHosts: new Set(["claude.ai", "chatgpt.com"]),
    googleClientId: "google-client",
    googleClientSecret: "google-secret",
    rateLimitPerSecond: 3,
    rateLimitBurst: 30,
    dailyWriteLimit: 100,
    ...overrides,
  };
}

/** Fake Google: the "code" Google returns is the identity to impersonate. */
export class FakeGoogle implements GoogleIdentityProvider {
  identity: GoogleIdentity = { email: OWNER_EMAIL, emailVerified: true };
  lastChallenge = "";

  buildAuthUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
    this.lastChallenge = codeChallenge;
    return `https://accounts.google.test/auth?state=${encodeURIComponent(state)}`;
  }

  async exchangeCode({ codeVerifier }: { code: string; codeVerifier: string }): Promise<GoogleIdentity> {
    if (pkceChallengeS256(codeVerifier) !== this.lastChallenge) {
      throw new Error("bad google pkce");
    }
    return this.identity;
  }
}

export type TestHarness = {
  app: FastifyInstance;
  store: InMemoryMcpOAuthStore;
  google: FakeGoogle;
  config: McpConfig;
  fetchedUrls: string[];
};

export async function buildHarness(configOverrides: Partial<McpConfig> = {}): Promise<TestHarness> {
  const app = Fastify({ logger: false });
  const store = new InMemoryMcpOAuthStore();
  const google = new FakeGoogle();
  const config = testConfig(configOverrides);
  const fetchedUrls: string[] = [];

  const { guard } = registerMcp(app, {
    config,
    oauthStore: store,
    authStore: {
      async findUserByEmail(email: string) {
        return email === config.jotlyUserEmail ? ({ id: JOTLY_USER_ID } as never) : null;
      },
    },
    google,
    fetchMetadata: async (url) => {
      fetchedUrls.push(url);
      return { client_id: url, client_name: "Claude", redirect_uris: [CLAUDE_REDIRECT] };
    },
  });

  // Stand-in for /mcp until the MCP transport is mounted.
  app.get("/probe", async (request, reply) => {
    const result = await guard.verify(request.headers.authorization);
    if (!result.ok) return guard.refuse(request, reply, result.reason);
    return result.context;
  });

  await app.ready();
  return { app, store, google, config, fetchedUrls };
}

export function hiddenInput(html: string, name: string): string {
  const match = html.match(new RegExp(`name="${name}" value="([^"]*)"`));
  if (!match) throw new Error(`hidden input ${name} not found`);
  return match[1];
}

export function form(values: Record<string, string>) {
  return {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams(values).toString(),
  };
}

/** Runs authorize → Google → consent and returns the client-facing redirect URL. */
export async function authorizeToRedirect(
  h: TestHarness,
  options: { clientId?: string; verifier?: string; decision?: "allow" | "deny" } = {}
): Promise<URL> {
  const verifier = options.verifier ?? randomToken(48);
  const query = new URLSearchParams({
    response_type: "code",
    client_id: options.clientId ?? CLAUDE_CLIENT_ID,
    redirect_uri: CLAUDE_REDIRECT,
    code_challenge: pkceChallengeS256(verifier),
    code_challenge_method: "S256",
    state: "client-state-1",
    resource: `${BASE_URL}/mcp`,
  });
  const authorize = await h.app.inject({ method: "GET", url: `/oauth/authorize?${query}` });
  if (authorize.statusCode !== 302) throw new Error(`authorize returned ${authorize.statusCode}: ${authorize.body}`);
  const googleState = new URL(authorize.headers.location as string).searchParams.get("state") as string;

  const callback = await h.app.inject({
    method: "GET",
    url: `/oauth/google/callback?state=${encodeURIComponent(googleState)}&code=google-code`,
  });
  if (callback.statusCode !== 200) throw new Error(`callback returned ${callback.statusCode}`);

  const consent = await h.app.inject({
    method: "POST",
    url: "/oauth/consent",
    ...form({
      state: hiddenInput(callback.body, "state"),
      csrf: hiddenInput(callback.body, "csrf"),
      decision: options.decision ?? "allow",
    }),
  });
  return new URL(consent.headers.location as string);
}

export async function obtainTokens(h: TestHarness, verifier = randomToken(48)) {
  const redirect = await authorizeToRedirect(h, { verifier });
  const response = await h.app.inject({
    method: "POST",
    url: "/oauth/token",
    ...form({
      grant_type: "authorization_code",
      code: redirect.searchParams.get("code") as string,
      redirect_uri: CLAUDE_REDIRECT,
      client_id: CLAUDE_CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  return response.json() as { access_token: string; refresh_token: string; expires_in: number };
}
