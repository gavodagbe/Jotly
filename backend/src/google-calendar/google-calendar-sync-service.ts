import { google, calendar_v3 } from "googleapis";
import { GaxiosError } from "gaxios";
import { GoogleCalendarConnection } from "@prisma/client";
import type { OAuth2Client } from "google-auth-library";
import { CalendarEventStore, CalendarEventUpsertInput } from "./calendar-event-store";
import { GoogleCalendarConnectionStore } from "./google-calendar-store";
import { GoogleCalendarOAuthService } from "./google-calendar-oauth-service";
import { GoogleOAuth2ClientFactory } from "../google-auth/google-oauth2-client-factory";

const MAX_RESULTS_PER_PAGE = 250;
const FULL_SYNC_DAYS_BACK = 30;
const FULL_SYNC_DAYS_AHEAD = 90;

export type GoogleCalendarApi = {
  events: {
    list(
      params: calendar_v3.Params$Resource$Events$List
    ): Promise<{ data: calendar_v3.Schema$Events }>;
  };
};

export type GoogleCalendarSyncServiceOptions = {
  oauthService: GoogleCalendarOAuthService;
  oauth2ClientFactory: GoogleOAuth2ClientFactory;
  connectionStore: GoogleCalendarConnectionStore;
  eventStore: CalendarEventStore;
  calendarApiFactory?: (auth: OAuth2Client) => GoogleCalendarApi;
};

export type GoogleCalendarSyncService = {
  syncEventsForUser(userId: string): Promise<{ syncedCount: number; lastSyncedAt: Date }>;
};

type GoogleApiErrorPayload = {
  error?: {
    code?: unknown;
    message?: unknown;
    errors?: Array<{
      reason?: unknown;
      message?: unknown;
    }> | null;
  } | null;
};

function parseGoogleDateTime(dt: calendar_v3.Schema$EventDateTime | undefined | null): {
  time: Date;
  isAllDay: boolean;
  dateOnly: Date | null;
} {
  if (!dt) {
    return { time: new Date(), isAllDay: false, dateOnly: null };
  }
  if (dt.date) {
    // All-day event: date is in YYYY-MM-DD format
    const [year, month, day] = dt.date.split("-").map(Number);
    const dateOnly = new Date(Date.UTC(year, month - 1, day));
    return { time: dateOnly, isAllDay: true, dateOnly };
  }
  return { time: new Date(dt.dateTime!), isAllDay: false, dateOnly: null };
}

function isSyncTokenExpiredError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const gaxiosError = error instanceof GaxiosError ? error : null;
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown } | null;
  };

  return (
    gaxiosError?.status === 410 ||
    gaxiosError?.response?.status === 410 ||
    gaxiosError?.code === 410 ||
    gaxiosError?.code === "410" ||
    candidate.status === 410 ||
    candidate.response?.status === 410 ||
    candidate.code === 410 ||
    candidate.code === "410" ||
    getGoogleApiStatus(error) === 410 ||
    hasGoogleApiReason(error, "fullSyncRequired", "updatedMinTooLongAgo", "deleted") ||
    (getGoogleApiMessage(error)?.toLowerCase().includes("full sync is required") ?? false) ||
    (getGoogleApiMessage(error)?.toLowerCase().includes("sync token is no longer valid") ?? false)
  );
}

function getGoogleApiErrorPayload(error: unknown): GoogleApiErrorPayload | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const gaxiosError = error instanceof GaxiosError ? error : null;
  const candidate = error as {
    response?: { data?: unknown } | null;
    data?: unknown;
  };

  const payloadCandidates = [
    gaxiosError?.response?.data,
    candidate.response?.data,
    candidate.data,
  ];

  for (const payload of payloadCandidates) {
    if (typeof payload === "object" && payload !== null) {
      return payload as GoogleApiErrorPayload;
    }
  }

  return null;
}

function getGoogleApiStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const gaxiosError = error instanceof GaxiosError ? error : null;
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown } | null;
  };

  const statusCandidates = [
    gaxiosError?.status,
    gaxiosError?.response?.status,
    candidate.status,
    candidate.response?.status,
    candidate.code,
    getGoogleApiErrorPayload(error)?.error?.code,
  ];

  for (const value of statusCandidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function getGoogleApiReasons(error: unknown): string[] {
  const reasons = getGoogleApiErrorPayload(error)?.error?.errors ?? [];
  return reasons
    .map((entry) => (typeof entry?.reason === "string" ? entry.reason.trim() : ""))
    .filter((reason) => reason !== "");
}

function hasGoogleApiReason(error: unknown, ...expectedReasons: string[]): boolean {
  if (expectedReasons.length === 0) {
    return false;
  }

  const normalizedExpected = new Set(expectedReasons.map((reason) => reason.toLowerCase()));
  return getGoogleApiReasons(error).some((reason) => normalizedExpected.has(reason.toLowerCase()));
}

function getGoogleApiMessage(error: unknown): string | null {
  const payloadMessage = getGoogleApiErrorPayload(error)?.error?.message;
  if (typeof payloadMessage === "string" && payloadMessage.trim() !== "") {
    return payloadMessage;
  }

  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return null;
}

function normalizeGoogleCalendarSyncError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message === "GOOGLE_CALENDAR_RECONNECT_REQUIRED") {
      return error;
    }
    if (error.message === "GOOGLE_CALENDAR_INVALID_SELECTION") {
      return error;
    }
    if (error.message === "GOOGLE_CALENDAR_ACCESS_CHANGED") {
      return error;
    }
  }

  const status = getGoogleApiStatus(error);
  const message = getGoogleApiMessage(error)?.toLowerCase() ?? "";
  if (
    status === 401 ||
    hasGoogleApiReason(error, "authError", "invalidCredentials", "insufficientPermissions") ||
    message.includes("invalid credentials")
  ) {
    return new Error("GOOGLE_CALENDAR_RECONNECT_REQUIRED");
  }
  if (
    status === 404 ||
    hasGoogleApiReason(error, "notFound") ||
    message === "not found"
  ) {
    return new Error("GOOGLE_CALENDAR_INVALID_SELECTION");
  }
  if (
    status === 403 &&
    (hasGoogleApiReason(error, "forbidden") ||
      message.includes("permission") ||
      message.includes("forbidden") ||
      message.includes("access"))
  ) {
    return new Error("GOOGLE_CALENDAR_ACCESS_CHANGED");
  }

  return error instanceof Error ? error : new Error(String(error));
}

function addUtcDays(date: Date, offsetDays: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + offsetDays);
  return nextDate;
}

function getStartOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getFullSyncWindow(referenceDate = new Date()): { timeMin: Date; timeMax: Date } {
  const startOfToday = getStartOfUtcDay(referenceDate);
  return {
    timeMin: addUtcDays(startOfToday, -FULL_SYNC_DAYS_BACK),
    timeMax: addUtcDays(startOfToday, FULL_SYNC_DAYS_AHEAD + 1),
  };
}

export function createGoogleCalendarSyncService(
  options: GoogleCalendarSyncServiceOptions
): GoogleCalendarSyncService {
  const {
    oauthService,
    oauth2ClientFactory,
    connectionStore,
    eventStore,
    calendarApiFactory = (auth) => google.calendar({ version: "v3", auth }),
  } = options;

  async function syncConnection(connection: GoogleCalendarConnection): Promise<number> {
    const accessToken = await oauthService.getValidAccessToken(connection.id);
    if (!accessToken) {
      return 0;
    }

    const client = oauth2ClientFactory.createClientWithTokens({
      access_token: accessToken,
    });
    const calendar = calendarApiFactory(client);

    const calendarId = connection.calendarId;
    let syncToken = connection.lastSyncToken;
    let useFullSync = !syncToken;

    // Retry loop: if incremental sync fails with 410 Gone, fall back to full sync
    for (let attempt = 0; attempt < 2; attempt++) {
      let pageToken: string | undefined;
      let nextSyncToken: string | undefined;
      let attemptSyncedCount = 0;
      const fullSyncGoogleEventIds = useFullSync ? new Set<string>() : null;

      try {
        do {
          const params: calendar_v3.Params$Resource$Events$List = {
            calendarId,
            maxResults: MAX_RESULTS_PER_PAGE,
            singleEvents: true,
          };

          if (useFullSync) {
            const { timeMin, timeMax } = getFullSyncWindow();
            params.timeMin = timeMin.toISOString();
            params.timeMax = timeMax.toISOString();
          } else {
            params.syncToken = syncToken!;
          }

          if (pageToken) {
            params.pageToken = pageToken;
          }

          const response = await calendar.events.list(params);
          const data = response.data;

          if (data.items) {
            for (const event of data.items) {
              if (!event.id) continue;
              fullSyncGoogleEventIds?.add(event.id);

              if (event.status === "cancelled") {
                await eventStore.markCancelled(event.id, connection.userId, connection.id);
                attemptSyncedCount++;
                continue;
              }

              const start = parseGoogleDateTime(event.start);
              const end = parseGoogleDateTime(event.end);

              const upsertInput: CalendarEventUpsertInput = {
                userId: connection.userId,
                connectionId: connection.id,
                googleEventId: event.id,
                title: event.summary ?? "(No title)",
                description: event.description ?? null,
                location: event.location ?? null,
                startTime: start.time,
                endTime: end.time,
                isAllDay: start.isAllDay,
                startDate: start.dateOnly,
                endDate: end.dateOnly,
                status: event.status ?? "confirmed",
                htmlLink: event.htmlLink ?? null,
                attendees: event.attendees
                  ? JSON.stringify(event.attendees)
                  : null,
                organizer: event.organizer
                  ? JSON.stringify(event.organizer)
                  : null,
                recurringEventId: event.recurringEventId ?? null,
              };

              await eventStore.upsertFromGoogle(upsertInput);
              attemptSyncedCount++;
            }
          }

          pageToken = data.nextPageToken ?? undefined;
          if (data.nextSyncToken) {
            nextSyncToken = data.nextSyncToken;
          }
        } while (pageToken);

        if (useFullSync && eventStore.deleteMissingForConnection) {
          await eventStore.deleteMissingForConnection(
            connection.id,
            connection.userId,
            [...(fullSyncGoogleEventIds ?? [])]
          );
        }

        // If we got here without a 410, sync is complete
        const now = new Date();
        if (nextSyncToken) {
          await connectionStore.updateSyncToken(connection.id, nextSyncToken, now);
        }
        return attemptSyncedCount;
      } catch (error) {
        if (attempt === 0 && !useFullSync && isSyncTokenExpiredError(error)) {
          useFullSync = true;
          syncToken = null;
          continue;
        }
        throw normalizeGoogleCalendarSyncError(error);
      }
    }

    return 0;
  }

  return {
    async syncEventsForUser(userId) {
      const connections = await connectionStore.listByUserId(userId);
      if (connections.length === 0) {
        throw new Error("GOOGLE_CALENDAR_NOT_CONNECTED");
      }

      let totalSyncedCount = 0;
      let successfulConnectionCount = 0;
      let reconnectRequiredCount = 0;
      let firstNonReconnectError: unknown = null;
      for (const connection of connections) {
        try {
          const count = await syncConnection(connection);
          totalSyncedCount += count;
          successfulConnectionCount++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message === "GOOGLE_CALENDAR_RECONNECT_REQUIRED") {
            reconnectRequiredCount++;
            continue;
          }
          if (!firstNonReconnectError) {
            firstNonReconnectError = error;
          }
        }
      }

      if (successfulConnectionCount === 0) {
        if (reconnectRequiredCount === connections.length) {
          throw new Error("GOOGLE_CALENDAR_RECONNECT_REQUIRED");
        }
        throw firstNonReconnectError ?? new Error("GOOGLE_CALENDAR_SYNC_FAILED");
      }

      const now = new Date();
      return { syncedCount: totalSyncedCount, lastSyncedAt: now };
    },
  };
}
