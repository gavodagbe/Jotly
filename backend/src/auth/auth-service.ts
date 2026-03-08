import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { AuthSession, AuthStore, AuthUser } from "./auth-store";

const scryptAsync = promisify(scrypt);

const PASSWORD_HASH_KEY_LENGTH = 64;
const SESSION_TOKEN_BYTES = 32;

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string | null;
  preferredLocale: "en" | "fr";
  preferredTimeZone: string | null;
  createdAt: string;
};

export type AuthSessionContext = {
  user: AuthenticatedUser;
  session: AuthSession;
};

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string | null;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthService = {
  register(input: RegisterInput): Promise<{ user: AuthenticatedUser; token: string }>;
  login(input: LoginInput): Promise<{ user: AuthenticatedUser; token: string }>;
  authenticateBearerToken(token: string): Promise<AuthSessionContext | null>;
  revokeBearerToken(token: string): Promise<void>;
};

type AuthServiceOptions = {
  authStore: AuthStore;
  sessionTtlMs: number;
};

class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "EMAIL_IN_USE" | "INVALID_CREDENTIALS"
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(displayName: string | null): string | null {
  if (displayName === null) {
    return null;
  }

  const normalized = displayName.trim();
  return normalized === "" ? null : normalized;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scryptAsync(password, salt, PASSWORD_HASH_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("base64url")}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, key] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !key) {
    return false;
  }

  const expectedBuffer = Buffer.from(key, "base64url");
  const candidateBuffer = (await scryptAsync(password, salt, expectedBuffer.length)) as Buffer;

  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

function isEmailUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function toAuthenticatedUser(user: AuthUser): AuthenticatedUser {
  const preferredLocale = user.preferredLocale === "fr" ? "fr" : "en";

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    preferredLocale,
    preferredTimeZone: user.preferredTimeZone ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function getSessionExpirationDate(sessionTtlMs: number): Date {
  return new Date(Date.now() + sessionTtlMs);
}

async function createSessionForUser(
  authStore: AuthStore,
  sessionTtlMs: number,
  userId: string
): Promise<{ token: string; session: AuthSession }> {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const session = await authStore.createSession({
    userId,
    tokenHash,
    expiresAt: getSessionExpirationDate(sessionTtlMs)
  });

  return { token, session };
}

export function createAuthService(options: AuthServiceOptions): AuthService {
  const { authStore, sessionTtlMs } = options;

  return {
    async register(input) {
      const email = normalizeEmail(input.email);
      const displayName = normalizeDisplayName(input.displayName);
      const existingUser = await authStore.findUserByEmail(email);

      if (existingUser) {
        throw new AuthError("Email already in use", "EMAIL_IN_USE");
      }

      const passwordHash = await hashPassword(input.password);
      let user: AuthUser;

      try {
        user = await authStore.createUser({
          email,
          passwordHash,
          displayName
        });
      } catch (error) {
        if (isEmailUniqueConstraintError(error)) {
          throw new AuthError("Email already in use", "EMAIL_IN_USE");
        }

        throw error;
      }

      await authStore.deleteExpiredSessions(new Date());
      const { token } = await createSessionForUser(authStore, sessionTtlMs, user.id);

      return {
        user: toAuthenticatedUser(user),
        token
      };
    },

    async login(input) {
      const email = normalizeEmail(input.email);
      const user = await authStore.findUserByEmail(email);

      if (!user) {
        throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
      }

      const isPasswordValid = await verifyPassword(input.password, user.passwordHash);

      if (!isPasswordValid) {
        throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
      }

      await authStore.deleteExpiredSessions(new Date());
      const { token } = await createSessionForUser(authStore, sessionTtlMs, user.id);

      return {
        user: toAuthenticatedUser(user),
        token
      };
    },

    async authenticateBearerToken(token) {
      const tokenHash = hashSessionToken(token);
      const session = await authStore.findSessionByTokenHash(tokenHash);

      if (!session || session.revokedAt) {
        return null;
      }

      if (session.expiresAt.getTime() <= Date.now()) {
        await authStore.revokeSession(session.id);
        return null;
      }

      const user = await authStore.findUserById(session.userId);

      if (!user) {
        return null;
      }

      return {
        user: toAuthenticatedUser(user),
        session
      };
    },

    async revokeBearerToken(token) {
      const tokenHash = hashSessionToken(token);
      const session = await authStore.findSessionByTokenHash(tokenHash);

      if (!session || session.revokedAt) {
        return;
      }

      await authStore.revokeSession(session.id);
    }
  };
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
