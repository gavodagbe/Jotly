import { createPublicKey, JsonWebKey, KeyObject, verify } from "node:crypto";
import { McpConfig } from "../mcp-config";
import { MetadataFetcher } from "./client-registry";

/**
 * private_key_jwt client authentication (RFC 7523), used by ChatGPT: at the token
 * endpoint the client sends a short-lived JWT signed with its private key; we check
 * it against the public keys it publishes at its jwks_uri.
 */
export const CLIENT_ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
export const SUPPORTED_ASSERTION_ALGS = ["RS256", "ES256"] as const;

const JWKS_CACHE_MS = 60 * 60 * 1000;
const JWKS_MIN_REFETCH_MS = 60 * 1000;
const CLOCK_SKEW_S = 60;
const MAX_LIFETIME_S = 60 * 60;

type Jwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

function decodePart<T>(part: string | undefined): T | null {
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** Unverified `iss` of an assertion: only used to know which client to look up before verifying. */
export function assertionIssuer(assertion: string): string | null {
  const payload = decodePart<{ iss?: unknown }>(assertion.split(".")[1]);
  return typeof payload?.iss === "string" ? payload.iss : null;
}

export function createClientAssertionVerifier(options: {
  config: McpConfig;
  fetchJwks: MetadataFetcher;
  now?: () => Date;
}) {
  const { config, fetchJwks } = options;
  const now = options.now ?? (() => new Date());
  const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();
  const seenJti = new Map<string, number>();

  async function loadKeys(jwksUri: string, forceRefresh: boolean): Promise<Jwk[]> {
    const url = new URL(jwksUri);
    if (url.protocol !== "https:" || !config.cimdAllowedHosts.has(url.hostname.toLowerCase())) {
      throw new Error(`jwks_uri host not allowed: ${url.hostname}`);
    }
    const cached = jwksCache.get(jwksUri);
    const age = cached ? now().getTime() - cached.fetchedAt : Infinity;
    if (cached && age < JWKS_CACHE_MS && !(forceRefresh && age > JWKS_MIN_REFETCH_MS)) {
      return cached.keys;
    }
    const document = (await fetchJwks(jwksUri)) as { keys?: unknown };
    const keys = Array.isArray(document?.keys) ? (document.keys as Jwk[]) : [];
    jwksCache.set(jwksUri, { keys, fetchedAt: now().getTime() });
    return keys;
  }

  function rememberJti(key: string, exp: number): boolean {
    const nowS = now().getTime() / 1000;
    for (const [jti, expiry] of seenJti) {
      if (expiry < nowS) seenJti.delete(jti);
    }
    if (seenJti.has(key)) return false;
    seenJti.set(key, exp);
    return true;
  }

  /** Returns null when the assertion is valid, otherwise the reason it was refused. */
  async function verifyAssertion(input: {
    clientId: string;
    jwksUri: string;
    assertion: string;
    tokenEndpoint: string;
  }): Promise<string | null> {
    const [headerPart, payloadPart, signaturePart] = input.assertion.split(".");
    const header = decodePart<{ alg?: string; kid?: string }>(headerPart);
    const payload = decodePart<Record<string, unknown>>(payloadPart);
    if (!header || !payload || !signaturePart) return "malformed assertion";

    const alg = header.alg as (typeof SUPPORTED_ASSERTION_ALGS)[number];
    if (!SUPPORTED_ASSERTION_ALGS.includes(alg)) return `unsupported alg: ${header.alg}`;

    let key: KeyObject | null = null;
    for (const forceRefresh of [false, true]) {
      const keys = await loadKeys(input.jwksUri, forceRefresh);
      const candidates = keys.filter(
        (jwk) => (!header.kid || jwk.kid === header.kid) && (!jwk.use || jwk.use === "sig")
      );
      if (candidates.length === 1 || (candidates.length > 0 && !header.kid)) {
        key = createPublicKey({ key: candidates[0], format: "jwk" });
        break;
      }
    }
    if (!key) return `no signing key for kid ${header.kid ?? "(none)"}`;

    const signed = Buffer.from(`${headerPart}.${payloadPart}`);
    const signature = Buffer.from(signaturePart, "base64url");
    const valid =
      alg === "RS256"
        ? verify("sha256", signed, key, signature)
        : verify("sha256", signed, { key, dsaEncoding: "ieee-p1363" }, signature);
    if (!valid) return "bad signature";

    if (payload.iss !== input.clientId || payload.sub !== input.clientId) return "iss/sub must be the client_id";
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(input.tokenEndpoint) && !audiences.includes(config.baseUrl)) return "wrong audience";

    const nowS = now().getTime() / 1000;
    const exp = typeof payload.exp === "number" ? payload.exp : NaN;
    if (!(exp > nowS - CLOCK_SKEW_S)) return "expired";
    if (exp > nowS + MAX_LIFETIME_S) return "lifetime too long";
    if (typeof payload.nbf === "number" && payload.nbf > nowS + CLOCK_SKEW_S) return "not yet valid";
    if (typeof payload.jti !== "string" || !payload.jti) return "missing jti";
    if (!rememberJti(`${input.clientId}|${payload.jti}`, exp + CLOCK_SKEW_S)) return "assertion replayed";

    return null;
  }

  return { verifyAssertion };
}

export type ClientAssertionVerifier = ReturnType<typeof createClientAssertionVerifier>;
