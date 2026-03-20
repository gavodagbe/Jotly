import assert from "node:assert/strict";
import test from "node:test";
import { GoogleCalendarConnection } from "@prisma/client";
import {
  createGoogleCalendarOAuthService,
  encrypt,
} from "./google-calendar-oauth-service";
import { GoogleCalendarConnectionStore } from "./google-calendar-store";
import { GoogleOAuth2ClientFactory } from "../google-auth/google-oauth2-client-factory";

const ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

class InMemoryGoogleCalendarConnectionStore implements GoogleCalendarConnectionStore {
  private readonly connections = new Map<string, GoogleCalendarConnection>();

  constructor(connections: GoogleCalendarConnection[]) {
    for (const connection of connections) {
      this.connections.set(connection.id, connection);
    }
  }

  async listByUserId(userId: string): Promise<GoogleCalendarConnection[]> {
    return [...this.connections.values()].filter((connection) => connection.userId === userId);
  }

  async getById(connectionId: string): Promise<GoogleCalendarConnection | null> {
    return this.connections.get(connectionId) ?? null;
  }

  async getByUserAndEmail(userId: string, email: string): Promise<GoogleCalendarConnection | null> {
    return (
      [...this.connections.values()].find(
        (connection) =>
          connection.userId === userId && connection.googleAccountEmail === email
      ) ?? null
    );
  }

  async upsertConnection(): Promise<GoogleCalendarConnection> {
    throw new Error("Not implemented");
  }

  async deleteById(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  async updateTokens(
    connectionId: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: Date
  ): Promise<GoogleCalendarConnection | null> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return null;
    }

    const updated: GoogleCalendarConnection = {
      ...connection,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      updatedAt: new Date(),
    };
    this.connections.set(connectionId, updated);
    return updated;
  }

  async updateSyncToken(): Promise<GoogleCalendarConnection | null> {
    return null;
  }

  async updateColor(): Promise<GoogleCalendarConnection | null> {
    return null;
  }

  async updateCalendarId(): Promise<GoogleCalendarConnection | null> {
    return null;
  }
}

function createConnection(
  overrides: Partial<GoogleCalendarConnection> = {}
): GoogleCalendarConnection {
  const now = new Date("2026-03-20T09:00:00.000Z");

  return {
    id: "connection-1",
    userId: "user-1",
    googleAccountEmail: "user@example.com",
    accessToken: encrypt("stored-access-token", ENCRYPTION_KEY),
    refreshToken: encrypt("stored-refresh-token", ENCRYPTION_KEY),
    tokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
    calendarId: "primary",
    color: "#6366f1",
    lastSyncToken: null,
    lastSyncedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createOAuth2ClientFactoryStub(options?: {
  refreshAccessTokenImplementation?: () => Promise<{ credentials: Record<string, unknown> }>;
}): GoogleOAuth2ClientFactory {
  return {
    createClient() {
      return {} as never;
    },
    createClientWithTokens() {
      return {
        refreshAccessToken:
          options?.refreshAccessTokenImplementation ??
          (async () => ({
            credentials: {
              access_token: "fresh-access-token",
              expiry_date: Date.now() + 3600 * 1000,
            },
          })),
      } as never;
    },
  };
}

test(
  "getValidAccessToken falls back to the stored access token when refresh fails but the token is still valid",
  async () => {
    const service = createGoogleCalendarOAuthService({
      oauth2ClientFactory: createOAuth2ClientFactoryStub({
        refreshAccessTokenImplementation: async () => {
          throw new Error("invalid_grant");
        },
      }),
      encryptionKey: ENCRYPTION_KEY,
      connectionStore: new InMemoryGoogleCalendarConnectionStore([createConnection()]),
    });

    const accessToken = await service.getValidAccessToken("connection-1");

    assert.equal(accessToken, "stored-access-token");
  }
);

test(
  "getValidAccessToken still requires reconnect when the stored access token is already expired",
  async () => {
    const service = createGoogleCalendarOAuthService({
      oauth2ClientFactory: createOAuth2ClientFactoryStub({
        refreshAccessTokenImplementation: async () => {
          throw new Error("invalid_grant");
        },
      }),
      encryptionKey: ENCRYPTION_KEY,
      connectionStore: new InMemoryGoogleCalendarConnectionStore([
        createConnection({
          tokenExpiresAt: new Date(Date.now() - 60 * 1000),
        }),
      ]),
    });

    await assert.rejects(
      () => service.getValidAccessToken("connection-1"),
      (error: unknown) =>
        error instanceof Error && error.message === "GOOGLE_CALENDAR_RECONNECT_REQUIRED"
    );
  }
);
