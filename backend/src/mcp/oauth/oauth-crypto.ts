import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function pkceChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** RFC 7636: verifier is 43-128 chars of [A-Z a-z 0-9 - . _ ~]. */
export function isValidPkceVerifier(verifier: string): boolean {
  return /^[A-Za-z0-9\-._~]{43,128}$/.test(verifier);
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!isValidPkceVerifier(verifier)) {
    return false;
  }
  return safeEqual(pkceChallengeS256(verifier), challenge);
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Decodes a JWT payload WITHOUT verifying it — diagnostics only, never for access decisions. */
export function unverifiedJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
    const picked: Record<string, unknown> = {};
    for (const key of ["iss", "aud", "exp", "iat", "client_id"]) {
      picked[key] = payload[key];
    }
    return picked;
  } catch {
    return null;
  }
}
