import { FastifyInstance } from "fastify";
import { AuthStore } from "../auth/auth-store";
import { McpConfig } from "./mcp-config";
import { registerAuthorizeRoutes } from "./oauth/authorize-routes";
import { createBearerGuard } from "./oauth/bearer-guard";
import { createClientRegistry, MetadataFetcher } from "./oauth/client-registry";
import { GoogleIdentityProvider } from "./oauth/google-identity";
import { registerMetadataRoutes } from "./oauth/metadata-routes";
import { McpOAuthStore } from "./oauth/oauth-store";
import { registerTokenRoutes } from "./oauth/token-routes";
import { TokenBucketLimiter } from "./rate-limit";

export type McpPluginOptions = {
  config: McpConfig;
  oauthStore: McpOAuthStore;
  authStore: Pick<AuthStore, "findUserByEmail">;
  google: GoogleIdentityProvider;
  fetchMetadata?: MetadataFetcher;
  now?: () => Date;
};

/** OAuth endpoints are cheap to abuse: 20 requests burst, then one every 3 s per IP. */
const OAUTH_IP_RATE_PER_SECOND = 1 / 3;
const OAUTH_IP_BURST = 20;

/**
 * Registers the MCP authorization server (discovery, registration, authorize,
 * consent, token) in an encapsulated context and returns the bearer guard
 * protecting /mcp.
 */
export function registerMcp(app: FastifyInstance, options: McpPluginOptions) {
  const { config, oauthStore, now } = options;
  const guard = createBearerGuard({ config, store: oauthStore, authStore: options.authStore, now });
  const clients = createClientRegistry({ config, store: oauthStore, fetchMetadata: options.fetchMetadata, now });
  const ipLimiter = new TokenBucketLimiter(OAUTH_IP_RATE_PER_SECOND, OAUTH_IP_BURST);

  app.register(async (scope) => {
    // OAuth token and consent requests are form-encoded; the main app only parses JSON.
    scope.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string", bodyLimit: 16 * 1024 },
      (_request, body, done) => {
        done(null, Object.fromEntries(new URLSearchParams(body as string)));
      }
    );

    registerMetadataRoutes(scope, config);
    registerAuthorizeRoutes(scope, { config, store: oauthStore, clients, google: options.google, ipLimiter, now });
    registerTokenRoutes(scope, { config, store: oauthStore, clients, ipLimiter, now });
  });

  app.addHook("onClose", async () => {
    await oauthStore.close?.();
  });

  return { guard };
}
