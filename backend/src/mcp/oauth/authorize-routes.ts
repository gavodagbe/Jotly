import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { MCP_SCOPE, McpConfig } from "../mcp-config";
import { clientIp, TokenBucketLimiter } from "../rate-limit";
import { ClientRegistry, OAuthClientError } from "./client-registry";
import { OAUTH_PAGE_HEADERS, renderConsentPage, renderErrorPage } from "./consent-page";
import { GoogleIdentityProvider } from "./google-identity";
import { OAUTH_PATHS } from "./metadata-routes";
import { pkceChallengeS256, randomToken, safeEqual, sha256Hex } from "./oauth-crypto";
import { McpOAuthStore } from "./oauth-store";

const AUTH_REQUEST_TTL_MS = 10 * 60 * 1000;
const AUTH_CODE_TTL_MS = 60 * 1000;

type Query = Record<string, string | undefined>;

export type AuthorizeRouteOptions = {
  config: McpConfig;
  store: McpOAuthStore;
  clients: ClientRegistry;
  google: GoogleIdentityProvider;
  ipLimiter: TokenBucketLimiter;
  now?: () => Date;
};

function sendPage(reply: FastifyReply, status: number, html: string) {
  return reply.code(status).headers(OAUTH_PAGE_HEADERS).send(html);
}

function redirectToClient(
  reply: FastifyReply,
  config: McpConfig,
  redirectUri: string,
  params: Record<string, string | null | undefined>
) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries({ ...params, iss: config.baseUrl })) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return reply.header("cache-control", "no-store").redirect(url.toString(), 302);
}

/** Accepts the resource URL with or without a trailing slash. */
function isExpectedResource(config: McpConfig, resource: string): boolean {
  return resource.replace(/\/+$/, "") === config.resourceUrl;
}

export function registerAuthorizeRoutes(app: FastifyInstance, options: AuthorizeRouteOptions): void {
  const { config, store, clients, google, ipLimiter } = options;
  const now = options.now ?? (() => new Date());
  const isAllowedEmail = (email: string) => config.allowedEmails.has(email.toLowerCase());

  const rateLimited = (request: FastifyRequest, reply: FastifyReply) => {
    if (ipLimiter.take(`oauth:${clientIp(request)}`)) {
      return false;
    }
    void sendPage(reply, 429, renderErrorPage("Trop de tentatives", "Réessayer dans une minute."));
    return true;
  };

  // Step 1: the MCP client sends the user here. Validate, then hand over to Google.
  app.get(OAUTH_PATHS.authorize, async (request, reply) => {
    if (rateLimited(request, reply)) return reply;
    const query = request.query as Query;
    const clientId = query.client_id ?? "";
    const redirectUri = query.redirect_uri ?? "";

    let clientLabel: string;
    try {
      const client = await clients.resolve(clientId);
      clients.assertRedirectUri(client, redirectUri);
      clientLabel = client.clientName ?? clientId;
    } catch (error) {
      // Never redirect to an unverified redirect_uri.
      const message = error instanceof OAuthClientError ? error.message : "Client invalide";
      request.log.warn({ event: "mcp_oauth_authorize_refused", clientId, reason: message }, "MCP authorize refused");
      return sendPage(reply, 400, renderErrorPage("Connexion impossible", message));
    }

    const fail = (error: string, description: string) =>
      redirectToClient(reply, config, redirectUri, {
        error,
        error_description: description,
        state: query.state,
      });

    if (query.response_type !== "code") {
      return fail("unsupported_response_type", "response_type must be code");
    }
    if (!query.code_challenge || query.code_challenge_method !== "S256") {
      return fail("invalid_request", "PKCE with code_challenge_method=S256 is required");
    }
    if (query.resource && !isExpectedResource(config, query.resource)) {
      return fail("invalid_target", "Unknown resource");
    }

    const state = randomToken();
    const googleCodeVerifier = randomToken(48);
    await store.createAuthRequest({
      stateHash: sha256Hex(state),
      clientId,
      redirectUri,
      codeChallenge: query.code_challenge,
      clientState: query.state ?? null,
      scope: MCP_SCOPE,
      resource: query.resource ?? null,
      googleCodeVerifier,
      email: null,
      consentCsrfHash: null,
      expiresAt: new Date(now().getTime() + AUTH_REQUEST_TTL_MS),
    });
    request.log.info({ event: "mcp_oauth_authorize", client: clientLabel }, "MCP authorize started");

    return reply
      .header("cache-control", "no-store")
      .redirect(google.buildAuthUrl({ state, codeChallenge: pkceChallengeS256(googleCodeVerifier) }), 302);
  });

  // Step 2: Google returns here. Check the identity against the allow-list, then ask for consent.
  app.get(OAUTH_PATHS.googleCallback, async (request, reply) => {
    if (rateLimited(request, reply)) return reply;
    const query = request.query as Query;
    const authRequest = query.state ? await store.getAuthRequestByStateHash(sha256Hex(query.state)) : null;

    if (!authRequest || authRequest.expiresAt < now() || authRequest.email) {
      return sendPage(reply, 400, renderErrorPage("Lien expiré", "Relancer la connexion depuis l'application."));
    }
    if (query.error || !query.code) {
      await store.deleteAuthRequest(authRequest.id);
      return redirectToClient(reply, config, authRequest.redirectUri, {
        error: "access_denied",
        error_description: "Google sign-in was cancelled",
        state: authRequest.clientState,
      });
    }

    let identity;
    try {
      identity = await google.exchangeCode({ code: query.code, codeVerifier: authRequest.googleCodeVerifier });
    } catch (error) {
      request.log.warn({ event: "mcp_oauth_google_failed", err: error }, "Google code exchange failed");
      await store.deleteAuthRequest(authRequest.id);
      return sendPage(reply, 400, renderErrorPage("Connexion Google échouée", "Réessayer."));
    }

    if (!identity.emailVerified || !isAllowedEmail(identity.email)) {
      await store.deleteAuthRequest(authRequest.id);
      request.log.warn({ event: "mcp_oauth_email_refused", email: identity.email }, "MCP email not allowed");
      return sendPage(
        reply,
        403,
        renderErrorPage("Accès refusé", "Ce compte Google n'est pas autorisé à se connecter à Jotly.")
      );
    }

    const csrf = randomToken();
    await store.updateAuthRequest(authRequest.id, { email: identity.email, consentCsrfHash: sha256Hex(csrf) });
    const client = await store.getClient(authRequest.clientId);

    return sendPage(
      reply,
      200,
      renderConsentPage({
        clientLabel: client?.clientName ?? authRequest.clientId,
        email: identity.email,
        requestState: query.state as string,
        csrfToken: csrf,
        action: OAUTH_PATHS.consent,
      })
    );
  });

  // Step 3: the user decides. On "allow", issue a single-use authorization code.
  app.post(OAUTH_PATHS.consent, async (request, reply) => {
    if (rateLimited(request, reply)) return reply;
    const body = (request.body ?? {}) as Query;
    const authRequest = body.state ? await store.getAuthRequestByStateHash(sha256Hex(body.state)) : null;

    if (
      !authRequest ||
      !authRequest.email ||
      !authRequest.consentCsrfHash ||
      !body.csrf ||
      !safeEqual(sha256Hex(body.csrf), authRequest.consentCsrfHash)
    ) {
      return sendPage(reply, 400, renderErrorPage("Demande invalide", "Relancer la connexion depuis l'application."));
    }
    await store.deleteAuthRequest(authRequest.id);

    if (authRequest.expiresAt < now()) {
      return sendPage(reply, 400, renderErrorPage("Lien expiré", "Relancer la connexion depuis l'application."));
    }
    if (body.decision !== "allow" || !isAllowedEmail(authRequest.email)) {
      return redirectToClient(reply, config, authRequest.redirectUri, {
        error: "access_denied",
        error_description: "The user denied access",
        state: authRequest.clientState,
      });
    }

    const code = randomToken();
    await store.createAuthCode({
      codeHash: sha256Hex(code),
      clientId: authRequest.clientId,
      redirectUri: authRequest.redirectUri,
      codeChallenge: authRequest.codeChallenge,
      scope: authRequest.scope,
      resource: authRequest.resource,
      email: authRequest.email,
      expiresAt: new Date(now().getTime() + AUTH_CODE_TTL_MS),
    });
    request.log.info(
      { event: "mcp_oauth_consent", clientId: authRequest.clientId, email: authRequest.email },
      "MCP access granted"
    );

    return redirectToClient(reply, config, authRequest.redirectUri, { code, state: authRequest.clientState });
  });
}
