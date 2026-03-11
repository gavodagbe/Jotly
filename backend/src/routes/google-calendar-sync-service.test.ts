import { CalendarEvent, GoogleCalendarConnection } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { CalendarEventStore, CalendarEventUpsertInput } from "../google-calendar/calendar-event-store";
import {
  createGoogleCalendarSyncService,
  getFullSyncWindow,
  GoogleCalendarApi,
} from "../google-calendar/google-calendar-sync-service";
import {
  GoogleCalendarConnectionStore,
  GoogleCalendarConnectionUpsertInput,
} from "../google-calendar/google-calendar-store";
import { GoogleCalendarOAuthService } from "../google-calendar/google-calendar-oauth-service";
import { GoogleOAuth2ClientFactory } from "../google-auth/google-oauth2-client-factory";

class InMemoryGoogleCalendarConnectionStore implements GoogleCalendarConnectionStore {
  private readonly connections = new Map<string, GoogleCalendarConnection>();
  readonly updatedSyncTokens: Array<{
    connectionId: string;
    syncToken: string;
    syncedAt: Date;
  }> = [];

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

  async upsertConnection(_input: GoogleCalendarConnectionUpsertInput): Promise<GoogleCalendarConnection> {
    throw new Error("Not implemented");
  }

  async deleteById(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  async updateTokens(): Promise<GoogleCalendarConnection | null> {
    return null;
  }

  async updateSyncToken(
    connectionId: string,
    syncToken: string,
    syncedAt: Date
  ): Promise<GoogleCalendarConnection | null> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return null;
    }

    const updated: GoogleCalendarConnection = {
      ...connection,
      lastSyncToken: syncToken,
      lastSyncedAt: syncedAt,
      updatedAt: syncedAt,
    };
    this.connections.set(connectionId, updated);
    this.updatedSyncTokens.push({ connectionId, syncToken, syncedAt });
    return updated;
  }

  async updateColor(): Promise<GoogleCalendarConnection | null> {
    return null;
  }

  async updateCalendarId(): Promise<GoogleCalendarConnection | null> {
    return null;
  }
}

class SpyCalendarEventStore implements CalendarEventStore {
  readonly upserts: CalendarEventUpsertInput[] = [];
  readonly cancellations: Array<{
    googleEventId: string;
    userId: string;
    connectionId: string;
  }> = [];
  readonly deletedMissingSnapshots: Array<{
    connectionId: string;
    userId: string;
    activeGoogleEventIds: string[];
  }> = [];

  async listByDate(): Promise<CalendarEvent[]> {
    return [];
  }

  async listByDateRange(): Promise<CalendarEvent[]> {
    return [];
  }

  async getById(): Promise<CalendarEvent | null> {
    return null;
  }

  async getByGoogleEventId(): Promise<CalendarEvent | null> {
    return null;
  }

  async upsertFromGoogle(input: CalendarEventUpsertInput): Promise<CalendarEvent> {
    this.upserts.push(input);
    const now = new Date("2026-03-11T09:00:00.000Z");
    return {
      id: `event-${this.upserts.length}`,
      userId: input.userId,
      connectionId: input.connectionId,
      googleEventId: input.googleEventId,
      title: input.title,
      description: input.description,
      location: input.location,
      startTime: input.startTime,
      endTime: input.endTime,
      isAllDay: input.isAllDay,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
      htmlLink: input.htmlLink,
      attendees: input.attendees,
      organizer: input.organizer,
      recurringEventId: input.recurringEventId,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  async markCancelled(
    googleEventId: string,
    userId: string,
    connectionId: string
  ): Promise<CalendarEvent | null> {
    this.cancellations.push({ googleEventId, userId, connectionId });
    return null;
  }

  async deleteMissingForConnection(
    connectionId: string,
    userId: string,
    activeGoogleEventIds: string[]
  ): Promise<void> {
    this.deletedMissingSnapshots.push({ connectionId, userId, activeGoogleEventIds });
  }

  async deleteByConnectionId(): Promise<void> {}
}

function createConnection(overrides: Partial<GoogleCalendarConnection> = {}): GoogleCalendarConnection {
  const now = new Date("2026-03-11T09:00:00.000Z");
  return {
    id: "connection-1",
    userId: "user-1",
    googleAccountEmail: "user@example.com",
    accessToken: "encrypted-access-token",
    refreshToken: "encrypted-refresh-token",
    tokenExpiresAt: new Date("2026-03-11T10:00:00.000Z"),
    calendarId: "primary",
    color: "#6366f1",
    lastSyncToken: "existing-sync-token",
    lastSyncedAt: new Date("2026-03-10T08:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createOAuthServiceStub(
  implementation?: GoogleCalendarOAuthService["getValidAccessToken"]
): GoogleCalendarOAuthService {
  return {
    createAuthorizationState() {
      return "mock-state";
    },
    validateAuthorizationState() {
      return { userId: "user-1", sessionId: "session-1" };
    },
    getAuthorizationUrl() {
      return "https://accounts.google.com/o/oauth2/v2/auth";
    },
    async exchangeCode() {
      return { email: "user@example.com", connectionId: "connection-1" };
    },
    async getValidAccessToken(connectionId: string) {
      if (implementation) {
        return implementation(connectionId);
      }
      return "access-token";
    },
    async disconnect() {
      return true;
    },
    async getConnectionStatus() {
      return { connections: [] };
    },
    async listCalendars() {
      return [];
    },
  };
}

function createOAuth2ClientFactoryStub(): GoogleOAuth2ClientFactory {
  return {
    createClient() {
      return {} as never;
    },
    createClientWithTokens() {
      return {} as never;
    },
  };
}

test("getFullSyncWindow expands fallback syncs to full UTC-day boundaries", () => {
  const window = getFullSyncWindow(new Date("2026-03-11T15:30:45.000Z"));

  assert.equal(window.timeMin.toISOString(), "2026-02-09T00:00:00.000Z");
  assert.equal(window.timeMax.toISOString(), "2026-06-10T00:00:00.000Z");
});

test("Google Calendar sync retries with a full sync when the incremental sync token is expired", async () => {
  const connectionStore = new InMemoryGoogleCalendarConnectionStore([createConnection()]);
  const eventStore = new SpyCalendarEventStore();
  const listCalls: Array<Record<string, unknown>> = [];

  const syncService = createGoogleCalendarSyncService({
    oauthService: createOAuthServiceStub(),
    oauth2ClientFactory: createOAuth2ClientFactoryStub(),
    connectionStore,
    eventStore,
    calendarApiFactory: () =>
      ({
        events: {
          list: async (params) => {
            listCalls.push({ ...params });
            if (listCalls.length === 1) {
              throw { response: { status: 410 } };
            }

            return {
              data: {
                items: [
                  {
                    id: "google-event-1",
                    summary: "Planning",
                    start: { dateTime: "2026-03-11T09:00:00.000Z" },
                    end: { dateTime: "2026-03-11T10:00:00.000Z" },
                    status: "confirmed",
                  },
                ],
                nextSyncToken: "fresh-sync-token",
              },
            };
          },
        },
      }) satisfies GoogleCalendarApi,
  });

  const result = await syncService.syncEventsForUser("user-1");

  assert.equal(result.syncedCount, 1);
  assert.equal(listCalls.length, 2);
  assert.equal(listCalls[0].syncToken, "existing-sync-token");
  assert.equal(typeof listCalls[1].timeMin, "string");
  assert.equal(typeof listCalls[1].timeMax, "string");
  assert.equal(listCalls[1].syncToken, undefined);
  assert.equal(eventStore.upserts.length, 1);
  assert.equal(eventStore.upserts[0].connectionId, "connection-1");
  assert.deepEqual(eventStore.deletedMissingSnapshots, [
    {
      connectionId: "connection-1",
      userId: "user-1",
      activeGoogleEventIds: ["google-event-1"],
    },
  ]);
  assert.deepEqual(
    connectionStore.updatedSyncTokens.map((entry) => entry.syncToken),
    ["fresh-sync-token"]
  );
});

test("Google Calendar sync bubbles up reconnect-required when no connection can sync", async () => {
  const syncService = createGoogleCalendarSyncService({
    oauthService: createOAuthServiceStub(async () => {
      throw new Error("GOOGLE_CALENDAR_RECONNECT_REQUIRED");
    }),
    oauth2ClientFactory: createOAuth2ClientFactoryStub(),
    connectionStore: new InMemoryGoogleCalendarConnectionStore([createConnection()]),
    eventStore: new SpyCalendarEventStore(),
    calendarApiFactory: () =>
      ({
        events: {
          list: async () => ({ data: {} }),
        },
      }) satisfies GoogleCalendarApi,
  });

  await assert.rejects(
    () => syncService.syncEventsForUser("user-1"),
    (error: unknown) =>
      error instanceof Error && error.message === "GOOGLE_CALENDAR_RECONNECT_REQUIRED"
  );
});

test("Google Calendar sync bubbles up generic failures when every connection fails", async () => {
  const syncService = createGoogleCalendarSyncService({
    oauthService: createOAuthServiceStub(),
    oauth2ClientFactory: createOAuth2ClientFactoryStub(),
    connectionStore: new InMemoryGoogleCalendarConnectionStore([createConnection()]),
    eventStore: new SpyCalendarEventStore(),
    calendarApiFactory: () =>
      ({
        events: {
          list: async () => {
            throw new Error("calendar exploded");
          },
        },
      }) satisfies GoogleCalendarApi,
  });

  await assert.rejects(
    () => syncService.syncEventsForUser("user-1"),
    (error: unknown) => error instanceof Error && error.message === "calendar exploded"
  );
});
