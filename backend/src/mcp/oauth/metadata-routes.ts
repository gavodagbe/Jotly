import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { MCP_SCOPE, McpConfig } from "../mcp-config";
import { SUPPORTED_ASSERTION_ALGS } from "./client-assertion";

export const OAUTH_PATHS = {
  authorize: "/oauth/authorize",
  googleCallback: "/oauth/google/callback",
  consent: "/oauth/consent",
  token: "/oauth/token",
  register: "/oauth/register",
} as const;

export function protectedResourceMetadataUrl(config: McpConfig): string {
  return `${config.baseUrl}/.well-known/oauth-protected-resource/mcp`;
}

export function registerMetadataRoutes(app: FastifyInstance, config: McpConfig): void {
  const protectedResource = {
    resource: config.resourceUrl,
    authorization_servers: [config.baseUrl],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Jotly",
  };

  const authorizationServer = {
    issuer: config.baseUrl,
    authorization_endpoint: `${config.baseUrl}${OAUTH_PATHS.authorize}`,
    token_endpoint: `${config.baseUrl}${OAUTH_PATHS.token}`,
    registration_endpoint: `${config.baseUrl}${OAUTH_PATHS.register}`,
    scopes_supported: [MCP_SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic", "private_key_jwt"],
    token_endpoint_auth_signing_alg_values_supported: [...SUPPORTED_ASSERTION_ALGS],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };

  const send = (payload: object) => async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header("cache-control", "public, max-age=300");
    return reply.send(payload);
  };

  // RFC 9728: path-suffixed form for the /mcp resource, plus the bare form some clients try first.
  app.get("/.well-known/oauth-protected-resource/mcp", send(protectedResource));
  app.get("/.well-known/oauth-protected-resource", send(protectedResource));
  // RFC 8414, with the OpenID alias some clients probe.
  app.get("/.well-known/oauth-authorization-server", send(authorizationServer));
  app.get("/.well-known/oauth-authorization-server/mcp", send(authorizationServer));
  app.get("/.well-known/openid-configuration", send(authorizationServer));
}
