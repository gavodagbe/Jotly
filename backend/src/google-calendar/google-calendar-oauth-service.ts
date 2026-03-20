import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { google } from "googleapis";
import { GoogleOAuth2ClientFactory } from "../google-auth/google-oauth2-client-factory";
import { GoogleCalendarConnectionStore } from "./google-calendar-store";

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type GoogleCalendarOAuthServiceOptions = {
  oauth2ClientFactory: GoogleOAuth2ClientFactory;
  encryptionKey: string; // 64-char hex string (32 bytes)
  connectionStore: GoogleCalendarConnectionStore;
};

export type GoogleCalendarConnectionInfo = {
  id: string;
  email: string;
  color: string;
  calendarId: string;
  lastSyncedAt: Date | null;
};

export type GoogleCalendarOAuthService = {
  createAuthorizationState(userId: string, sessionId: string): string;
  validateAuthorizationState(
    state: string
  ): {
    userId: string;
    sessionId: string;
  } | null;
  getAuthorizationUrl(state?: string): string;
  exchangeCode(code: string, userId: string): Promise<{ email: string; connectionId: string }>;
  getValidAccessToken(connectionId: string): Promise<string | null>;
  disconnect(connectionId: string, userId: string): Promise<boolean>;
  getConnectionStatus(userId: string): Promise<{
    connections: GoogleCalendarConnectionInfo[];
  }>;
  listCalendars(connectionId: string): Promise<Array<{ id: string; summary: string; primary: boolean; backgroundColor: string | null }>>;
};

type AuthorizationStatePayload = {
  userId: string;
  sessionId: string;
  expiresAt: number;
  nonce: string;
};

function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decrypt(ciphertext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(":");
  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error("Invalid encrypted token format");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function signAuthorizationStatePayload(payload: string, keyHex: string): string {
  return createHmac("sha256", Buffer.from(keyHex, "hex"))
    .update(`google-calendar-oauth-state:${payload}`)
    .digest("base64url");
}

function parseAuthorizationStatePayload(payload: string): AuthorizationStatePayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AuthorizationStatePayload>;

    if (
      typeof parsed.userId !== "string" ||
      parsed.userId.trim() === "" ||
      typeof parsed.sessionId !== "string" ||
      parsed.sessionId.trim() === "" ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt) ||
      typeof parsed.nonce !== "string" ||
      parsed.nonce.trim() === ""
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      sessionId: parsed.sessionId,
      expiresAt: parsed.expiresAt,
      nonce: parsed.nonce,
    };
  } catch {
    return null;
  }
}

const CONNECTION_COLOR_PALETTE = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

export function createGoogleCalendarOAuthService(
  options: GoogleCalendarOAuthServiceOptions
): GoogleCalendarOAuthService {
  const { oauth2ClientFactory, encryptionKey, connectionStore } = options;

  function canStillUseStoredAccessToken(connection: { tokenExpiresAt: Date }): boolean {
    return connection.tokenExpiresAt.getTime() > Date.now();
  }

  async function getAccessTokenWithRefreshFallback(
    connection: Awaited<ReturnType<GoogleCalendarConnectionStore["getById"]>>
  ): Promise<string | null> {
    if (!connection) {
      return null;
    }

    const isExpiringSoon =
      connection.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS;

    if (!isExpiringSoon) {
      return decrypt(connection.accessToken, encryptionKey);
    }

    try {
      return await refreshAccessToken(connection.id);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "GOOGLE_CALENDAR_RECONNECT_REQUIRED" &&
        canStillUseStoredAccessToken(connection)
      ) {
        return decrypt(connection.accessToken, encryptionKey);
      }

      throw error;
    }
  }

  async function refreshAccessToken(connectionId: string): Promise<string | null> {
    const connection = await connectionStore.getById(connectionId);
    if (!connection) return null;

    const refreshToken = decrypt(connection.refreshToken, encryptionKey);

    const client = oauth2ClientFactory.createClientWithTokens({
      refresh_token: refreshToken,
    });

    let tokenResponse: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null };
    try {
      const { credentials } = await client.refreshAccessToken();
      tokenResponse = credentials;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("invalid_grant")) {
        throw new Error("GOOGLE_CALENDAR_RECONNECT_REQUIRED");
      }
      throw error;
    }

    if (!tokenResponse.access_token) {
      throw new Error("No access token received from refresh");
    }

    const newAccessToken = encrypt(tokenResponse.access_token, encryptionKey);
    const newRefreshToken = tokenResponse.refresh_token
      ? encrypt(tokenResponse.refresh_token, encryptionKey)
      : connection.refreshToken;
    const expiresAt = new Date(tokenResponse.expiry_date ?? Date.now() + 3600 * 1000);

    await connectionStore.updateTokens(connectionId, newAccessToken, newRefreshToken, expiresAt);
    return tokenResponse.access_token;
  }

  return {
    createAuthorizationState(userId, sessionId) {
      const encodedPayload = Buffer.from(
        JSON.stringify({
          userId,
          sessionId,
          expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
          nonce: randomBytes(16).toString("base64url"),
        } satisfies AuthorizationStatePayload)
      ).toString("base64url");
      const signature = signAuthorizationStatePayload(encodedPayload, encryptionKey);
      return `${encodedPayload}.${signature}`;
    },

    validateAuthorizationState(state) {
      const [encodedPayload, signature, ...rest] = state.split(".");

      if (!encodedPayload || !signature || rest.length > 0) {
        return null;
      }

      const expectedSignature = signAuthorizationStatePayload(encodedPayload, encryptionKey);
      const signatureBuffer = Buffer.from(signature, "utf8");
      const expectedBuffer = Buffer.from(expectedSignature, "utf8");

      if (
        signatureBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(signatureBuffer, expectedBuffer)
      ) {
        return null;
      }

      const payload = parseAuthorizationStatePayload(encodedPayload);
      if (!payload || payload.expiresAt <= Date.now()) {
        return null;
      }

      return {
        userId: payload.userId,
        sessionId: payload.sessionId,
      };
    },

    getAuthorizationUrl(state) {
      const client = oauth2ClientFactory.createClient();
      return client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: CALENDAR_SCOPES,
        state: state ?? undefined,
      });
    },

    async exchangeCode(code, userId) {
      const client = oauth2ClientFactory.createClient();
      const { tokens } = await client.getToken(code);

      if (!tokens.refresh_token) {
        throw new Error("No refresh token received. User may need to re-consent.");
      }

      if (!tokens.access_token) {
        throw new Error("No access token received from code exchange.");
      }

      // Fetch user email using oauth2 v2 userinfo with a fresh client that has tokens set
      const authedClient = oauth2ClientFactory.createClientWithTokens({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      });
      const oauth2 = google.oauth2({ version: "v2", auth: authedClient });
      const { data: userInfo } = await oauth2.userinfo.get();

      if (!userInfo.email) {
        throw new Error("Unable to retrieve email from Google account.");
      }

      const encryptedAccessToken = encrypt(tokens.access_token, encryptionKey);
      const encryptedRefreshToken = encrypt(tokens.refresh_token, encryptionKey);
      const expiresAt = new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000);

      // Auto-assign a color based on how many connections the user already has
      const existingConnections = await connectionStore.listByUserId(userId);
      const colorIndex = existingConnections.length % CONNECTION_COLOR_PALETTE.length;
      const autoColor = CONNECTION_COLOR_PALETTE[colorIndex];

      const connection = await connectionStore.upsertConnection({
        userId,
        googleAccountEmail: userInfo.email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        color: autoColor,
      });

      return { email: userInfo.email, connectionId: connection.id };
    },

    async getValidAccessToken(connectionId) {
      const connection = await connectionStore.getById(connectionId);
      return getAccessTokenWithRefreshFallback(connection);
    },

    async disconnect(connectionId, userId) {
      const connection = await connectionStore.getById(connectionId);
      if (!connection || connection.userId !== userId) {
        return false;
      }

      // Best-effort revoke the token at Google
      try {
        const accessToken = decrypt(connection.accessToken, encryptionKey);
        const client = oauth2ClientFactory.createClientWithTokens({
          access_token: accessToken,
        });
        await client.revokeToken(accessToken);
      } catch {
        // Revocation failure is non-critical
      }

      await connectionStore.deleteById(connectionId);
      return true;
    },

    async getConnectionStatus(userId) {
      const connections = await connectionStore.listByUserId(userId);
      return {
        connections: connections.map((c) => ({
          id: c.id,
          email: c.googleAccountEmail,
          color: c.color,
          calendarId: c.calendarId,
          lastSyncedAt: c.lastSyncedAt,
        })),
      };
    },

    async listCalendars(connectionId) {
      const connection = await connectionStore.getById(connectionId);
      if (!connection) return [];

      const accessToken = await getAccessTokenWithRefreshFallback(connection);
      if (!accessToken) return [];

      const client = oauth2ClientFactory.createClientWithTokens({
        access_token: accessToken,
      });
      const calendar = google.calendar({ version: "v3", auth: client });
      const response = await calendar.calendarList.list();
      const items = response.data.items ?? [];
      return items.map((item) => ({
        id: item.id ?? "primary",
        summary: item.summary ?? item.id ?? "Unknown",
        primary: item.primary ?? false,
        backgroundColor: item.backgroundColor ?? null,
      }));
    },
  };
}

// Export encryption functions for testing
export { encrypt, decrypt };
