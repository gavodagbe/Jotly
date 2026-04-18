import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import { ProfileStore } from "../profile/profile-store";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";

type ProfileRouteOptions = {
  authService: AuthService;
  profileStore: ProfileStore;
};

const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().max(120, "displayName is too long").nullable().optional(),
    preferredLocale: z.enum(["en", "fr"]).optional(),
    preferredTimeZone: z.string().trim().max(120, "preferredTimeZone is too long").nullable().optional(),
    requireDailyAffirmation: z.boolean().optional(),
    requireDailyBilan: z.boolean().optional(),
    requireWeeklySynthesis: z.boolean().optional(),
    requireMonthlySynthesis: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.displayName !== undefined ||
      value.preferredLocale !== undefined ||
      value.preferredTimeZone !== undefined ||
      value.requireDailyAffirmation !== undefined ||
      value.requireDailyBilan !== undefined ||
      value.requireWeeklySynthesis !== undefined ||
      value.requireMonthlySynthesis !== undefined,
    {
      message: "At least one profile field is required",
      path: [],
    }
  );

function isProfileNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeDisplayName(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function normalizePreferredTimeZone(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function serializeProfile(profile: {
  id: string;
  email: string;
  displayName: string | null;
  preferredLocale: string;
  preferredTimeZone: string | null;
  requireDailyAffirmation: boolean;
  requireDailyBilan: boolean;
  requireWeeklySynthesis: boolean;
  requireMonthlySynthesis: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    preferredLocale: profile.preferredLocale,
    preferredTimeZone: profile.preferredTimeZone,
    requireDailyAffirmation: profile.requireDailyAffirmation,
    requireDailyBilan: profile.requireDailyBilan,
    requireWeeklySynthesis: profile.requireWeeklySynthesis,
    requireMonthlySynthesis: profile.requireMonthlySynthesis,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

const profileRoutes: FastifyPluginAsync<ProfileRouteOptions> = async (app, options) => {
  const { authService, profileStore } = options;

  app.addHook("preHandler", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const authContext = await authService.authenticateBearerToken(token);

    if (!authContext) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    (request as { authUserId?: string }).authUserId = authContext.user.id;
  });

  app.get("/api/profile", async (request, reply) => {
    const authUserId = (request as { authUserId?: string }).authUserId;

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    try {
      const profile = await profileStore.getByUserId(authUserId);

      if (!profile) {
        return sendError(reply, 404, "NOT_FOUND", "Profile not found");
      }

      return reply.send({ data: serializeProfile(profile) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) {
        request.log.warn(error, "Profile storage dependency is missing");
        return sendStorageNotInitializedError(reply, "Profile");
      }

      request.log.error(error, "Failed to load profile");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load profile");
    }
  });

  app.patch("/api/profile", async (request, reply) => {
    const authUserId = (request as { authUserId?: string }).authUserId;

    if (!authUserId) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    const bodyResult = profileUpdateSchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    const preferredTimeZone = normalizePreferredTimeZone(bodyResult.data.preferredTimeZone);

    if (typeof preferredTimeZone === "string" && !isValidIanaTimeZone(preferredTimeZone)) {
      return sendError(reply, 400, "VALIDATION_ERROR", "preferredTimeZone must be a valid IANA timezone");
    }

    try {
      const updatedProfile = await profileStore.updateByUserId(authUserId, {
        displayName: normalizeDisplayName(bodyResult.data.displayName),
        preferredLocale: bodyResult.data.preferredLocale,
        preferredTimeZone,
        requireDailyAffirmation: bodyResult.data.requireDailyAffirmation,
        requireDailyBilan: bodyResult.data.requireDailyBilan,
        requireWeeklySynthesis: bodyResult.data.requireWeeklySynthesis,
        requireMonthlySynthesis: bodyResult.data.requireMonthlySynthesis,
      });

      if (!updatedProfile) {
        return sendError(reply, 404, "NOT_FOUND", "Profile not found");
      }

      return reply.send({ data: serializeProfile(updatedProfile) });
    } catch (error) {
      if (isProfileNotFoundError(error)) {
        return sendError(reply, 404, "NOT_FOUND", "Profile not found");
      }

      if (isStorageNotInitializedPrismaError(error)) {
        request.log.warn(error, "Profile storage dependency is missing");
        return sendStorageNotInitializedError(reply, "Profile");
      }

      request.log.error(error, "Failed to update profile");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to update profile");
    }
  });
};

export default profileRoutes;
