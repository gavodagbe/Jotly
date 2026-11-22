import { createHmac, randomBytes } from "node:crypto";
import { safeEqual } from "../oauth/oauth-crypto";

/**
 * Bulk operations run in two steps: a preview returns a token signed over the exact
 * content it showed; the write only proceeds if the same content is still current.
 * Per-process secret: a restart simply invalidates pending previews.
 */
export const CONFIRMATION_TTL_MS = 10 * 60 * 1000;
const secret = randomBytes(32);

function sign(scope: string, content: string, expiresAt: number): string {
  return createHmac("sha256", secret).update(`${scope}|${expiresAt}|${content}`).digest("base64url");
}

export function createConfirmationToken(scope: string, content: string, now: Date) {
  const expiresAt = now.getTime() + CONFIRMATION_TTL_MS;
  return {
    token: `${expiresAt.toString(36)}.${sign(scope, content, expiresAt)}`,
    expiresAt: new Date(expiresAt),
  };
}

export function isValidConfirmationToken(token: string, scope: string, content: string, now: Date): boolean {
  const [expiry, signature] = token.split(".");
  const expiresAt = parseInt(expiry ?? "", 36);
  if (!signature || !Number.isFinite(expiresAt) || expiresAt < now.getTime()) return false;
  return safeEqual(signature, sign(scope, content, expiresAt));
}
