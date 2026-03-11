import { FastifyPluginAsync } from "fastify";
import { AuthService } from "../auth/auth-service";
import { AuthSession, AuthStore } from "../auth/auth-store";
import { GoogleCalendarOAuthService } from "../google-calendar/google-calendar-oauth-service";
import { GoogleCalendarConnectionStore } from "../google-calendar/google-calendar-store";
import { CalendarEventStore } from "../google-calendar/calendar-event-store";
import { TaskStore } from "../tasks/task-store";
import {
  getBearerToken,
  sendError,
} from "./route-helpers";
import { z } from "zod";

type GoogleCalendarOAuthRoutesOptions = {
  authService: AuthService;
  authStore?: AuthStore;
  taskStore?: TaskStore;
  googleCalendarOAuthService: GoogleCalendarOAuthService;
  googleCalendarConnectionStore?: GoogleCalendarConnectionStore;
  calendarEventStore?: CalendarEventStore;
  frontendOrigin?: string;
};

type AuthenticatedGoogleCalendarRequest = {
  authUserId?: string;
  authSessionId?: string;
};

const callbackQuerySchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().min(1, "State parameter is required"),
});

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
}

function getAuthenticatedSessionId(request: { authSessionId?: string }): string | null {
  if (!request.authSessionId || request.authSessionId.trim() === "") {
    return null;
  }
  return request.authSessionId;
}

function normalizeFrontendOrigin(frontendOrigin: string): string {
  return frontendOrigin.endsWith("/") ? frontendOrigin.slice(0, -1) : frontendOrigin;
}

function isAuthorizationSessionActive(
  session: AuthSession | null | undefined,
  userId: string
): boolean {
  if (!session) {
    return false;
  }

  if (session.userId !== userId || session.revokedAt) {
    return false;
  }

  return session.expiresAt.getTime() > Date.now();
}

async function connectionHasLinkedTasks(
  userId: string,
  connectionId: string,
  taskStore?: TaskStore,
  calendarEventStore?: CalendarEventStore
): Promise<boolean> {
  if (!taskStore || !calendarEventStore) {
    return false;
  }

  const tasks = await taskStore.listByUser(userId);
  const linkedCalendarEventIds = [
    ...new Set(
      tasks
        .map((task) => task.calendarEventId)
        .filter((calendarEventId): calendarEventId is string => typeof calendarEventId === "string")
    ),
  ];

  for (const calendarEventId of linkedCalendarEventIds) {
    const calendarEvent = await calendarEventStore.getById(calendarEventId, userId);
    if (calendarEvent?.connectionId === connectionId) {
      return true;
    }
  }

  return false;
}

const CALLBACK_PATH = "/api/google-calendar/callback";

const googleCalendarOAuthRoutes: FastifyPluginAsync<GoogleCalendarOAuthRoutesOptions> = async (
  app,
  options
) => {
  const {
    authService,
    authStore,
    taskStore,
    googleCalendarOAuthService,
    googleCalendarConnectionStore,
    calendarEventStore,
  } = options;
  const frontendOrigin = normalizeFrontendOrigin(options.frontendOrigin ?? "http://localhost:3000");

  // Auth hook for all routes EXCEPT the callback (which is a browser redirect from Google)
  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith(CALLBACK_PATH)) {
      return;
    }

    const token = getBearerToken(request.headers.authorization);
    if (!token) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
    const authContext = await authService.authenticateBearerToken(token);
    if (!authContext) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
    (request as AuthenticatedGoogleCalendarRequest).authUserId = authContext.user.id;
    (request as AuthenticatedGoogleCalendarRequest).authSessionId = authContext.session.id;
  });

  // GET /api/google-calendar/auth-url — returns OAuth consent URL
  app.get("/api/google-calendar/auth-url", async (request, reply) => {
    const authContext = request as AuthenticatedGoogleCalendarRequest;
    const authUserId = getAuthenticatedUserId(authContext);
    const authSessionId = getAuthenticatedSessionId(authContext);
    if (!authUserId || !authSessionId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const state = googleCalendarOAuthService.createAuthorizationState(authUserId, authSessionId);
    const url = googleCalendarOAuthService.getAuthorizationUrl(state);
    return reply.send({ data: { url } });
  });

  // GET /api/google-calendar/callback?code=...&state=...
  // This is called by Google's redirect — no Bearer token, uses a short-lived signed state
  app.get(CALLBACK_PATH, async (request, reply) => {
    const queryResult = callbackQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.redirect(`${frontendOrigin}/?google-calendar=error`);
    }

    const { code, state } = queryResult.data;
    const authorizationState = googleCalendarOAuthService.validateAuthorizationState(state);
    if (!authorizationState) {
      return reply.redirect(`${frontendOrigin}/?google-calendar=error`);
    }

    const issuingSession = await authStore?.findSessionById?.(authorizationState.sessionId);
    if (!isAuthorizationSessionActive(issuingSession, authorizationState.userId)) {
      return reply.redirect(`${frontendOrigin}/?google-calendar=error`);
    }

    try {
      await googleCalendarOAuthService.exchangeCode(code, authorizationState.userId);
      return reply.redirect(`${frontendOrigin}/?google-calendar=connected`);
    } catch (error) {
      request.log.error(error, "Google Calendar OAuth callback failed");
      return reply.redirect(`${frontendOrigin}/?google-calendar=error`);
    }
  });

  // DELETE /api/google-calendar/connection/:connectionId — disconnect a specific Google Calendar connection
  app.delete("/api/google-calendar/connection/:connectionId", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as AuthenticatedGoogleCalendarRequest);
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const { connectionId } = request.params as { connectionId: string };

    try {
      const disconnected = await googleCalendarOAuthService.disconnect(connectionId, authUserId);
      if (!disconnected) {
        return sendError(reply, 404, "NOT_FOUND", "Google Calendar connection not found");
      }
      return reply.send({ data: { disconnected: true } });
    } catch (error) {
      request.log.error(error, "Failed to disconnect Google Calendar");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to disconnect Google Calendar");
    }
  });

  // GET /api/google-calendar/status — connection status (returns array of connections)
  app.get("/api/google-calendar/status", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as AuthenticatedGoogleCalendarRequest);
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    try {
      const status = await googleCalendarOAuthService.getConnectionStatus(authUserId);
      return reply.send({
        data: {
          connections: status.connections.map((c) => ({
            id: c.id,
            email: c.email,
            color: c.color,
            calendarId: c.calendarId,
            lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
          })),
        },
      });
    } catch (error) {
      request.log.error(error, "Failed to get Google Calendar status");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to get connection status");
    }
  });
  // PATCH /api/google-calendar/connection/:connectionId/color — update connection color
  app.patch("/api/google-calendar/connection/:connectionId/color", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as AuthenticatedGoogleCalendarRequest);
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
    if (!googleCalendarConnectionStore) {
      return sendError(reply, 500, "INTERNAL_ERROR", "Connection store unavailable");
    }

    const { connectionId } = request.params as { connectionId: string };
    const body = request.body as { color?: string };
    const colorRegex = /^#[0-9a-fA-F]{6}$/;
    if (!body.color || !colorRegex.test(body.color)) {
      return sendError(reply, 400, "VALIDATION_ERROR", "A valid hex color is required (e.g. #6366f1)");
    }

    try {
      const connection = await googleCalendarConnectionStore.getById(connectionId);
      if (!connection || connection.userId !== authUserId) {
        return sendError(reply, 404, "NOT_FOUND", "Connection not found");
      }
      const updated = await googleCalendarConnectionStore.updateColor(connectionId, body.color);
      if (!updated) {
        return sendError(reply, 500, "INTERNAL_ERROR", "Failed to update color");
      }
      return reply.send({ data: { id: updated.id, color: updated.color } });
    } catch (error) {
      request.log.error(error, "Failed to update connection color");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to update connection color");
    }
  });

  // GET /api/google-calendar/connection/:connectionId/calendars — list available calendars
  app.get("/api/google-calendar/connection/:connectionId/calendars", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as AuthenticatedGoogleCalendarRequest);
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
    if (!googleCalendarConnectionStore) {
      return sendError(reply, 500, "INTERNAL_ERROR", "Connection store unavailable");
    }

    const { connectionId } = request.params as { connectionId: string };

    try {
      const connection = await googleCalendarConnectionStore.getById(connectionId);
      if (!connection || connection.userId !== authUserId) {
        return sendError(reply, 404, "NOT_FOUND", "Connection not found");
      }
      const calendars = await googleCalendarOAuthService.listCalendars(connectionId);
      return reply.send({ data: calendars });
    } catch (error) {
      request.log.error(error, "Failed to list calendars");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to list calendars");
    }
  });

  // PATCH /api/google-calendar/connection/:connectionId/calendar — change selected calendar
  app.patch("/api/google-calendar/connection/:connectionId/calendar", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as AuthenticatedGoogleCalendarRequest);
    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
    if (!googleCalendarConnectionStore || !calendarEventStore) {
      return sendError(reply, 500, "INTERNAL_ERROR", "Required stores unavailable");
    }

    const { connectionId } = request.params as { connectionId: string };
    const body = request.body as { calendarId?: string };
    if (!body.calendarId || typeof body.calendarId !== "string" || body.calendarId.trim() === "") {
      return sendError(reply, 400, "VALIDATION_ERROR", "calendarId is required");
    }

    try {
      const connection = await googleCalendarConnectionStore.getById(connectionId);
      if (!connection || connection.userId !== authUserId) {
        return sendError(reply, 404, "NOT_FOUND", "Connection not found");
      }

      const nextCalendarId = body.calendarId.trim();
      if (nextCalendarId === connection.calendarId) {
        return reply.send({ data: { id: connection.id, calendarId: connection.calendarId } });
      }

      const hasLinkedTasks = await connectionHasLinkedTasks(
        authUserId,
        connectionId,
        taskStore,
        calendarEventStore
      );
      if (hasLinkedTasks) {
        return sendError(
          reply,
          409,
          "VALIDATION_ERROR",
          "Unlink tasks from this Google Calendar connection before changing calendars"
        );
      }

      // Delete old events for this connection
      await calendarEventStore.deleteByConnectionId(connectionId);

      // Update calendar ID (also resets sync token)
      const updated = await googleCalendarConnectionStore.updateCalendarId(connectionId, nextCalendarId);
      if (!updated) {
        return sendError(reply, 500, "INTERNAL_ERROR", "Failed to update calendar");
      }
      return reply.send({ data: { id: updated.id, calendarId: updated.calendarId } });
    } catch (error) {
      request.log.error(error, "Failed to update calendar selection");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to update calendar selection");
    }
  });
};

export default googleCalendarOAuthRoutes;
