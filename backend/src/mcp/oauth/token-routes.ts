import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { McpConfig } from "../mcp-config";
import { clientIp, TokenBucketLimiter } from "../rate-limit";
import { assertionIssuer, CLIENT_ASSERTION_TYPE, ClientAssertionVerifier } from "./client-assertion";
import { ClientRegistry, OAuthClientError } from "./client-registry";
import { OAUTH_PATHS } from "./metadata-routes";
import { randomToken, sha256Hex, verifyPkceS256 } from "./oauth-crypto";
import { McpOAuthStore, McpOAuthClientRecord } from "./oauth-store";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

type Body = Record<string, string | undefined>;

export type TokenRouteOptions = {
  config: McpConfig;
  store: McpOAuthStore;
  clients: ClientRegistry;
  assertions: ClientAssertionVerifier;
  ipLimiter: TokenBucketLimiter;
  now?: () => Date;
};

class TokenError extends Error {
  constructor(
    readonly error: string,
    readonly description: string,
    readonly status = 400
  ) {
    super(description);
  }
}

/** Client credentials from HTTP Basic (client_secret_basic) or the body (client_secret_post / none). */
function readClientCredentials(request: FastifyRequest, body: Body): { clientId: string; secret: string | null } {
  if (!body.client_id && body.client_assertion) {
    // private_key_jwt without client_id: the (still unverified) issuer names the client to verify against.
    return { clientId: assertionIssuer(body.client_assertion) ?? "", secret: null };
  }
  const header = request.headers.authorization;
  if (header?.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator > 0) {
      return {
        clientId: decodeURIComponent(decoded.slice(0, separator)),
        secret: decodeURIComponent(decoded.slice(separator + 1)),
      };
    }
  }
  return { clientId: body.client_id ?? "", secret: body.client_secret ?? null };
}

export function registerTokenRoutes(app: FastifyInstance, options: TokenRouteOptions): void {
  const { config, store, clients, assertions, ipLimiter } = options;
  const now = options.now ?? (() => new Date());

  async function issueTokens(input: {
    clientId: string;
    email: string;
    scope: string;
    resource: string | null;
    familyId: string;
  }) {
    const issuedAt = now().getTime();
    const accessToken = randomToken();
    const refreshToken = randomToken();
    await store.createToken({
      ...input,
      tokenHash: sha256Hex(accessToken),
      kind: "access",
      expiresAt: new Date(issuedAt + ACCESS_TOKEN_TTL_SECONDS * 1000),
    });
    await store.createToken({
      ...input,
      tokenHash: sha256Hex(refreshToken),
      kind: "refresh",
      expiresAt: new Date(issuedAt + REFRESH_TOKEN_TTL_SECONDS * 1000),
    });
    store.deleteExpired(now()).catch(() => {});

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: input.scope,
    };
  }

  async function authenticateClient(request: FastifyRequest, body: Body): Promise<McpOAuthClientRecord> {
    const credentials = readClientCredentials(request, body);
    let client: McpOAuthClientRecord;
    try {
      client = await clients.resolve(credentials.clientId);
    } catch (error) {
      throw new TokenError("invalid_client", error instanceof OAuthClientError ? error.message : "Unknown client", 401);
    }
    if (client.tokenEndpointAuthMethod === "private_key_jwt") {
      if (body.client_assertion_type !== CLIENT_ASSERTION_TYPE || !body.client_assertion || !client.jwksUri) {
        throw new TokenError("invalid_client", "private_key_jwt client assertion is required", 401);
      }
      let reason: string | null;
      try {
        reason = await assertions.verifyAssertion({
          clientId: client.clientId,
          jwksUri: client.jwksUri,
          assertion: body.client_assertion,
          tokenEndpoint: `${config.baseUrl}${OAUTH_PATHS.token}`,
        });
      } catch (error) {
        reason = `unable to verify (${error instanceof Error ? error.message : "error"})`;
      }
      if (reason) {
        throw new TokenError("invalid_client", `Client assertion refused: ${reason}`, 401);
      }
      return client;
    }
    if (!clients.authenticate(client, credentials.secret)) {
      throw new TokenError("invalid_client", "Client authentication failed", 401);
    }
    return client;
  }

  async function exchangeAuthorizationCode(client: McpOAuthClientRecord, body: Body) {
    const code = body.code ? await store.consumeAuthCode(sha256Hex(body.code), now()) : null;
    if (!code || code.expiresAt < now()) {
      throw new TokenError("invalid_grant", "Authorization code is invalid, expired or already used");
    }
    if (code.clientId !== client.clientId || code.redirectUri !== body.redirect_uri) {
      throw new TokenError("invalid_grant", "Authorization code was issued to another client or redirect_uri");
    }
    if (!body.code_verifier || !verifyPkceS256(body.code_verifier, code.codeChallenge)) {
      throw new TokenError("invalid_grant", "PKCE verification failed");
    }
    if (body.resource && body.resource.replace(/\/+$/, "") !== config.resourceUrl) {
      throw new TokenError("invalid_target", "Unknown resource");
    }
    if (!config.allowedEmails.has(code.email)) {
      throw new TokenError("invalid_grant", "Account is no longer allowed");
    }
    return issueTokens({
      clientId: client.clientId,
      email: code.email,
      scope: code.scope,
      resource: code.resource,
      familyId: randomToken(16),
    });
  }

  async function exchangeRefreshToken(client: McpOAuthClientRecord, body: Body) {
    const token = body.refresh_token ? await store.getTokenByHash(sha256Hex(body.refresh_token)) : null;
    if (!token || token.kind !== "refresh" || token.clientId !== client.clientId) {
      throw new TokenError("invalid_grant", "Refresh token is invalid");
    }
    if (token.revokedAt) {
      // A rotated refresh token was replayed: assume theft and revoke the whole family.
      await store.revokeFamily(token.familyId, now());
      throw new TokenError("invalid_grant", "Refresh token was already used");
    }
    if (token.expiresAt < now()) {
      throw new TokenError("invalid_grant", "Refresh token expired");
    }
    if (!config.allowedEmails.has(token.email)) {
      await store.revokeFamily(token.familyId, now());
      throw new TokenError("invalid_grant", "Account is no longer allowed");
    }
    await store.revokeToken(token.id, now());
    return issueTokens({
      clientId: token.clientId,
      email: token.email,
      scope: token.scope,
      resource: token.resource,
      familyId: token.familyId,
    });
  }

  app.post(OAUTH_PATHS.token, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header("cache-control", "no-store").header("pragma", "no-cache");
    if (!ipLimiter.take(`oauth:${clientIp(request)}`)) {
      return reply.code(429).send({ error: "slow_down", error_description: "Too many requests" });
    }
    const body = (request.body ?? {}) as Body;

    try {
      const client = await authenticateClient(request, body);
      if (body.grant_type === "authorization_code") {
        return reply.send(await exchangeAuthorizationCode(client, body));
      }
      if (body.grant_type === "refresh_token") {
        return reply.send(await exchangeRefreshToken(client, body));
      }
      throw new TokenError("unsupported_grant_type", "grant_type must be authorization_code or refresh_token");
    } catch (error) {
      if (error instanceof TokenError) {
        request.log.warn(
          { event: "mcp_oauth_token_refused", error: error.error, reason: error.description, grant: body.grant_type },
          "MCP token refused"
        );
        if (error.status === 401) {
          reply.header("www-authenticate", 'Basic realm="jotly"');
        }
        return reply.code(error.status).send({ error: error.error, error_description: error.description });
      }
      throw error;
    }
  });

  app.post(OAUTH_PATHS.register, async (request, reply) => {
    reply.header("cache-control", "no-store");
    if (!ipLimiter.take(`oauth:${clientIp(request)}`)) {
      return reply.code(429).send({ error: "slow_down", error_description: "Too many requests" });
    }
    try {
      const registered = await clients.register(request.body);
      request.log.info({ event: "mcp_oauth_register", clientId: registered.client_id }, "MCP client registered");
      return reply.code(201).send(registered);
    } catch (error) {
      if (error instanceof OAuthClientError) {
        return reply.code(400).send({ error: error.code, error_description: error.message });
      }
      throw error;
    }
  });
}
