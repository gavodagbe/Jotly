import { z } from "zod";
import { isRedirectUriAllowed, McpConfig } from "../mcp-config";
import { randomToken, safeEqual, sha256Hex } from "./oauth-crypto";
import { McpOAuthClientRecord, McpOAuthStore } from "./oauth-store";

export type MetadataFetcher = (url: string) => Promise<unknown>;

export class OAuthClientError extends Error {
  constructor(
    readonly code: "invalid_client" | "invalid_redirect_uri" | "invalid_client_metadata",
    message: string
  ) {
    super(message);
  }
}

const CIMD_CACHE_MS = 60 * 60 * 1000;
const CIMD_MAX_BYTES = 64 * 1024;
const SUPPORTED_AUTH_METHODS = ["none", "client_secret_post", "client_secret_basic"] as const;

const registrationSchema = z.object({
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  client_name: z.string().max(200).optional(),
  token_endpoint_auth_method: z.enum(SUPPORTED_AUTH_METHODS).optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

const metadataDocumentSchema = z.object({
  client_id: z.string().url(),
  client_name: z.string().max(200).optional(),
  redirect_uris: z.array(z.string().url()).min(1).max(20),
  token_endpoint_auth_method: z.string().optional(),
  jwks_uri: z.string().url().optional(),
});

/** Default fetcher for Client ID Metadata Documents: https only, 5 s timeout, 64 KB max, no redirects. */
export const fetchMetadataDocument: MetadataFetcher = async (url) => {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > CIMD_MAX_BYTES) {
    throw new Error("metadata document too large");
  }
  return JSON.parse(text);
};

export function isMetadataDocumentClientId(clientId: string): boolean {
  return clientId.startsWith("https://");
}

export function createClientRegistry(options: {
  config: McpConfig;
  store: McpOAuthStore;
  fetchMetadata?: MetadataFetcher;
  now?: () => Date;
}) {
  const { config, store } = options;
  const fetchMetadata = options.fetchMetadata ?? fetchMetadataDocument;
  const now = options.now ?? (() => new Date());

  async function resolveMetadataDocumentClient(clientId: string): Promise<McpOAuthClientRecord> {
    const url = new URL(clientId);
    if (url.protocol !== "https:" || !config.cimdAllowedHosts.has(url.hostname.toLowerCase())) {
      throw new OAuthClientError("invalid_client", `Client metadata host not allowed: ${url.hostname}`);
    }

    const cached = await store.getClient(clientId);
    if (cached?.isMetadataDocument && now().getTime() - cached.updatedAt.getTime() < CIMD_CACHE_MS) {
      return cached;
    }

    let document: z.infer<typeof metadataDocumentSchema>;
    try {
      document = metadataDocumentSchema.parse(await fetchMetadata(clientId));
    } catch (error) {
      throw new OAuthClientError(
        "invalid_client",
        `Unable to load client metadata document (${error instanceof Error ? error.message : "error"})`
      );
    }
    if (document.client_id !== clientId) {
      throw new OAuthClientError("invalid_client", "Metadata document client_id does not match its URL");
    }
    const method = document.token_endpoint_auth_method ?? "none";
    if (method !== "none" && method !== "private_key_jwt") {
      throw new OAuthClientError("invalid_client", `Unsupported token_endpoint_auth_method: ${method}`);
    }
    let jwksUri: string | null = null;
    if (method === "private_key_jwt") {
      // ChatGPT: signs a JWT at the token endpoint; its keys must live on an allowed host.
      const keysUrl = document.jwks_uri ? new URL(document.jwks_uri) : null;
      if (!keysUrl || keysUrl.protocol !== "https:" || !config.cimdAllowedHosts.has(keysUrl.hostname.toLowerCase())) {
        throw new OAuthClientError("invalid_client", "private_key_jwt requires a jwks_uri on an allowed host");
      }
      jwksUri = keysUrl.toString();
    }

    return store.upsertClient({
      clientId,
      clientSecretHash: null,
      clientName: document.client_name ?? url.hostname,
      redirectUris: document.redirect_uris,
      tokenEndpointAuthMethod: method,
      jwksUri,
      isMetadataDocument: true,
    });
  }

  return {
    async register(body: unknown) {
      const parsed = registrationSchema.safeParse(body);
      if (!parsed.success) {
        throw new OAuthClientError("invalid_client_metadata", parsed.error.issues[0]?.message ?? "Invalid metadata");
      }
      const rejected = parsed.data.redirect_uris.find((uri) => !isRedirectUriAllowed(config, uri));
      if (rejected) {
        throw new OAuthClientError("invalid_redirect_uri", `Redirect URI not allowed: ${rejected}`);
      }

      const method = parsed.data.token_endpoint_auth_method ?? "none";
      const clientSecret = method === "none" ? null : randomToken();
      const client = await store.upsertClient({
        clientId: `mcp_${randomToken(16)}`,
        clientSecretHash: clientSecret ? sha256Hex(clientSecret) : null,
        clientName: parsed.data.client_name ?? null,
        redirectUris: parsed.data.redirect_uris,
        tokenEndpointAuthMethod: method,
        jwksUri: null,
        isMetadataDocument: false,
      });

      return {
        client_id: client.clientId,
        ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: Math.floor(now().getTime() / 1000),
        client_name: client.clientName ?? undefined,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: method,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      };
    },

    /** Resolves a registered or metadata-document client, or throws invalid_client. */
    async resolve(clientId: string): Promise<McpOAuthClientRecord> {
      if (isMetadataDocumentClientId(clientId)) {
        return resolveMetadataDocumentClient(clientId);
      }
      const client = await store.getClient(clientId);
      if (!client || client.isMetadataDocument) {
        throw new OAuthClientError("invalid_client", "Unknown client_id");
      }
      return client;
    },

    /** The redirect URI must be both declared by the client and allowed by Jotly. */
    assertRedirectUri(client: McpOAuthClientRecord, redirectUri: string): void {
      if (!client.redirectUris.includes(redirectUri) || !isRedirectUriAllowed(config, redirectUri)) {
        throw new OAuthClientError("invalid_redirect_uri", "redirect_uri not registered for this client");
      }
    },

    /** Token endpoint authentication for "none" and client-secret methods (private_key_jwt is checked separately). */
    authenticate(client: McpOAuthClientRecord, presentedSecret: string | null): boolean {
      if (client.tokenEndpointAuthMethod === "none") {
        return true;
      }
      if (client.tokenEndpointAuthMethod === "private_key_jwt") {
        return false;
      }
      return (
        presentedSecret !== null &&
        client.clientSecretHash !== null &&
        safeEqual(sha256Hex(presentedSecret), client.clientSecretHash)
      );
    },
  };
}

export type ClientRegistry = ReturnType<typeof createClientRegistry>;
