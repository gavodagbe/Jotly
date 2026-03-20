import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService, isAuthError } from "../auth/auth-service";

type AuthRouteOptions = {
  authService: AuthService;
};

const registerSchema = z.object({
  email: z.string().trim().email("Email must be valid"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().trim().optional().nullable()
});

const loginSchema = z.object({
  email: z.string().trim().email("Email must be valid"),
  password: z.string().min(1, "Password is required")
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email must be valid")
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

type ApiErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "CONFLICT" | "INTERNAL_ERROR";

function sendError(
  reply: {
    code: (statusCode: number) => {
      send: (payload: unknown) => unknown;
    };
  },
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: string[]
) {
  const payload: {
    error: { code: ApiErrorCode; message: string; details?: string[] };
  } = {
    error: {
      code,
      message
    }
  };

  if (details && details.length > 0) {
    payload.error.details = details;
  }

  return reply.code(statusCode).send(payload);
}

function zodIssuesToStrings(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function getBearerToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const [scheme, token] = value.trim().split(/\s+/, 2);

  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

async function authenticateRequest(
  request: { headers: { authorization?: string } },
  authService: AuthService
) {
  const token = getBearerToken(request.headers.authorization);

  if (!token) {
    return null;
  }

  const authContext = await authService.authenticateBearerToken(token);

  if (!authContext) {
    return null;
  }

  return {
    token,
    user: authContext.user
  };
}

const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (app, options) => {
  const { authService } = options;

  app.post("/api/auth/register", async (request, reply) => {
    const bodyResult = registerSchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request body",
        details
      );
    }

    try {
      const result = await authService.register({
        email: bodyResult.data.email,
        password: bodyResult.data.password,
        displayName: bodyResult.data.displayName ?? null
      });

      return reply.code(201).send({
        data: result
      });
    } catch (error) {
      if (isAuthError(error) && error.code === "EMAIL_IN_USE") {
        return sendError(reply, 409, "CONFLICT", "Email already in use");
      }

      request.log.error(error, "Failed to register user");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to register user");
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    const bodyResult = loginSchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request body",
        details
      );
    }

    try {
      const result = await authService.login({
        email: bodyResult.data.email,
        password: bodyResult.data.password
      });

      return reply.send({
        data: result
      });
    } catch (error) {
      if (isAuthError(error) && error.code === "INVALID_CREDENTIALS") {
        return sendError(reply, 401, "UNAUTHORIZED", "Invalid credentials");
      }

      request.log.error(error, "Failed to login");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to login");
    }
  });

  app.post("/api/auth/forgot-password", async (request, reply) => {
    const bodyResult = forgotPasswordSchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request body",
        details
      );
    }

    try {
      const result = await authService.requestPasswordReset({
        email: bodyResult.data.email
      });

      return reply.send({
        data: {
          success: true,
          resetToken: result.resetToken,
          expiresAt: result.expiresAt
        }
      });
    } catch (error) {
      request.log.error(error, "Failed to issue password reset token");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to process password reset request");
    }
  });

  app.post("/api/auth/reset-password", async (request, reply) => {
    const bodyResult = resetPasswordSchema.safeParse(request.body);

    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        details[0] ?? "Invalid request body",
        details
      );
    }

    try {
      const result = await authService.resetPassword({
        token: bodyResult.data.token,
        password: bodyResult.data.password
      });

      return reply.send({
        data: result
      });
    } catch (error) {
      if (isAuthError(error) && error.code === "INVALID_RESET_TOKEN") {
        return sendError(reply, 401, "INVALID_RESET_TOKEN", "Invalid or expired reset token");
      }

      request.log.error(error, "Failed to reset password");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to reset password");
    }
  });

  app.get("/api/auth/me", async (request, reply) => {
    const auth = await authenticateRequest(request, authService);

    if (!auth) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    return reply.send({
      data: {
        user: auth.user
      }
    });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const auth = await authenticateRequest(request, authService);

    if (!auth) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }

    try {
      await authService.revokeBearerToken(auth.token);
      return reply.send({
        data: {
          success: true
        }
      });
    } catch (error) {
      request.log.error(error, "Failed to logout");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to logout");
    }
  });
};

export default authRoutes;
