import { FastifyReply, FastifyRequest } from "fastify";
import { AuthStore } from "../../auth/auth-store";
import { safeTimeZone } from "../mcp-dates";
import { McpConfig } from "../mcp-config";
import { protectedResourceMetadataUrl } from "./metadata-routes";
import { sha256Hex, unverifiedJwtClaims } from "./oauth-crypto";
import { McpOAuthStore } from "./oauth-store";

export type McpAuthContext = {
  email: string;
  clientId: string;
  scope: string;
  /** Jotly user every MCP call acts as (MCP_JOTLY_USER_EMAIL). */
  userId: string;
  /** That user's time zone (profile), Europe/Paris by default. */
  timeZone: string;
};

type RefusalReason =
  | "missing_token"
  | "unknown_token"
  | "not_access_token"
  | "revoked"
  | "expired"
  | "email_not_allowed"
  | "jotly_user_missing";

export type BearerResult = { ok: true; context: McpAuthContext } | { ok: false; reason: RefusalReason };

function readBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.trim().split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export function createBearerGuard(options: {
  config: McpConfig;
  store: McpOAuthStore;
  authStore: Pick<AuthStore, "findUserByEmail">;
  now?: () => Date;
}) {
  const { config, store, authStore } = options;
  const now = options.now ?? (() => new Date());
  let cachedUser: { id: string; timeZone: string; loadedAt: number } | null = null;

  /** The Jotly account all calls act as; re-read every 5 minutes to follow time-zone changes. */
  async function resolveJotlyUser(): Promise<{ id: string; timeZone: string } | null> {
    if (!cachedUser || now().getTime() - cachedUser.loadedAt > 5 * 60 * 1000) {
      const user = await authStore.findUserByEmail(config.jotlyUserEmail);
      cachedUser = user
        ? { id: user.id, timeZone: safeTimeZone(user.preferredTimeZone), loadedAt: now().getTime() }
        : null;
    }
    return cachedUser;
  }

  async function verify(authorization: string | undefined): Promise<BearerResult> {
    const raw = readBearer(authorization);
    if (!raw) return { ok: false, reason: "missing_token" };

    const token = await store.getTokenByHash(sha256Hex(raw));
    if (!token) return { ok: false, reason: "unknown_token" };
    if (token.kind !== "access") return { ok: false, reason: "not_access_token" };
    if (token.revokedAt) return { ok: false, reason: "revoked" };
    if (token.expiresAt <= now()) return { ok: false, reason: "expired" };
    // Re-checked on every call: removing an address from MCP_ALLOWED_EMAILS cuts access at once.
    if (!config.allowedEmails.has(token.email)) return { ok: false, reason: "email_not_allowed" };

    const user = await resolveJotlyUser();
    if (!user) return { ok: false, reason: "jotly_user_missing" };

    return {
      ok: true,
      context: { email: token.email, clientId: token.clientId, scope: token.scope, userId: user.id, timeZone: user.timeZone },
    };
  }

  /** Sends the 401 with the discovery hint, and logs why — never the token itself. */
  function refuse(request: FastifyRequest, reply: FastifyReply, reason: RefusalReason) {
    const raw = readBearer(request.headers.authorization);
    request.log.warn(
      {
        event: "mcp_auth_refused",
        reason,
        tokenPresent: Boolean(request.headers.authorization),
        // Diagnostics: a JWT here means the client sent someone else's token (e.g. Google's).
        claims: raw ? unverifiedJwtClaims(raw) ?? "opaque" : undefined,
        ua: request.headers["user-agent"],
      },
      "MCP request refused"
    );

    if (reason === "jotly_user_missing") {
      request.log.error({ event: "mcp_jotly_user_missing" }, "MCP_JOTLY_USER_EMAIL matches no Jotly account");
      return reply.code(503).send({ error: "server_misconfigured" });
    }

    const parts = [`Bearer realm="jotly"`, `resource_metadata="${protectedResourceMetadataUrl(config)}"`];
    if (reason !== "missing_token") {
      parts.push(`error="invalid_token"`);
    }
    return reply
      .code(401)
      .header("www-authenticate", parts.join(", "))
      .send({ error: reason === "missing_token" ? "unauthorized" : "invalid_token" });
  }

  return { verify, refuse };
}

export type BearerGuard = ReturnType<typeof createBearerGuard>;
