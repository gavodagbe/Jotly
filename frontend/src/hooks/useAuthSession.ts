"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { ApiRequestError, createAuthHeaders, getApiErrorMessage } from "@/lib/api-client";

export type UserLocale = "en" | "fr";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  preferredLocale: UserLocale;
  preferredTimeZone: string | null;
  requireDailyAffirmation: boolean;
  requireDailyBilan: boolean;
  requireWeeklySynthesis: boolean;
  requireMonthlySynthesis: boolean;
  createdAt: string;
};

export type AuthMode = "login" | "register" | "forgot_password" | "reset_password";

export type AuthFormValues = {
  email: string;
  password: string;
  displayName: string;
  resetToken: string;
};

type AuthSessionOptions = {
  onSessionApplied?: (token: string, user: AuthUser) => void;
  onSessionCleared?: () => void;
};

const AUTH_TOKEN_STORAGE_KEY = "jotly_auth_token";

function getPreferredLocale(value: string | null | undefined): UserLocale {
  if (typeof value !== "string") {
    return "en";
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "fr" || normalized.startsWith("fr-") ? "fr" : "en";
}

function normalizeAuthUser(user: AuthUser): AuthUser {
  const preferredTimeZone =
    typeof user.preferredTimeZone === "string" && user.preferredTimeZone.trim() !== ""
      ? user.preferredTimeZone.trim()
      : null;

  return {
    ...user,
    preferredLocale: getPreferredLocale(user.preferredLocale),
    preferredTimeZone,
  };
}

async function registerUser(values: AuthFormValues): Promise<{ user: AuthUser; token: string }> {
  const response = await fetch("/backend-api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: values.email.trim(),
      password: values.password,
      displayName: values.displayName.trim() || null,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { user: AuthUser; token: string }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to register"));
  }

  if (!payload?.data) {
    throw new Error("Unable to register.");
  }

  return {
    ...payload.data,
    user: normalizeAuthUser(payload.data.user),
  };
}

async function loginUser(values: AuthFormValues): Promise<{ user: AuthUser; token: string }> {
  const response = await fetch("/backend-api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: values.email.trim(),
      password: values.password,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { user: AuthUser; token: string }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to login"));
  }

  if (!payload?.data) {
    throw new Error("Unable to login.");
  }

  return {
    ...payload.data,
    user: normalizeAuthUser(payload.data.user),
  };
}

async function requestPasswordReset(
  email: string
): Promise<{ resetToken: string | null; expiresAt: string | null }> {
  const response = await fetch("/backend-api/auth/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email.trim(),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { resetToken?: string | null; expiresAt?: string | null }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to request password reset"));
  }

  return {
    resetToken: payload?.data?.resetToken ?? null,
    expiresAt: payload?.data?.expiresAt ?? null,
  };
}

async function resetPasswordWithToken(
  token: string,
  password: string
): Promise<{ user: AuthUser; token: string }> {
  const response = await fetch("/backend-api/auth/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: token.trim(),
      password,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { user: AuthUser; token: string }; error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      getApiErrorMessage(response.status, payload, "Unable to reset password"),
      payload?.error?.code ?? null
    );
  }

  if (!payload?.data) {
    throw new Error("Unable to reset password.");
  }

  return {
    ...payload.data,
    user: normalizeAuthUser(payload.data.user),
  };
}

async function loadCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch("/backend-api/auth/me", {
    method: "GET",
    headers: createAuthHeaders(token, false),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { user?: AuthUser }; error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      getApiErrorMessage(response.status, payload, "Unable to validate session"),
      payload?.error?.code ?? null
    );
  }

  if (!payload?.data?.user) {
    throw new Error("Unable to validate session.");
  }

  return normalizeAuthUser(payload.data.user);
}

async function logoutUser(token: string): Promise<void> {
  const response = await fetch("/backend-api/auth/logout", {
    method: "POST",
    headers: createAuthHeaders(token, false),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to logout"));
  }
}

export function useAuthSession({ onSessionApplied, onSessionCleared }: AuthSessionOptions = {}) {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [guestLocale, setGuestLocale] = useState<UserLocale>("en");
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authFormValues, setAuthFormValues] = useState<AuthFormValues>({
    email: "",
    password: "",
    displayName: "",
    resetToken: "",
  });
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [authInfoMessage, setAuthInfoMessage] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const activeLocale = useMemo(
    () => getPreferredLocale(authUser?.preferredLocale ?? guestLocale),
    [authUser?.preferredLocale, guestLocale]
  );
  const isFrench = activeLocale === "fr";
  const activeTimeZone = authUser?.preferredTimeZone ?? null;

  const applyAuthSession = useCallback(
    (token: string, user: AuthUser) => {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      setAuthToken(token);
      setAuthUser(user);
      setAuthMode("login");
      setAuthErrorMessage(null);
      setAuthInfoMessage(null);
      onSessionApplied?.(token, user);
    },
    [onSessionApplied]
  );

  const clearAuthSession = useCallback(() => {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setAuthMode("login");
    setAuthErrorMessage(null);
    setAuthInfoMessage(null);
    setAuthFormValues((current) => ({
      ...current,
      password: "",
      resetToken: "",
    }));
    onSessionCleared?.();
  }, [onSessionCleared]);

  function handleAuthFormFieldChange(field: keyof AuthFormValues, value: string) {
    setAuthFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleAuthModeChange(mode: AuthMode) {
    setAuthMode(mode);
    setAuthErrorMessage(null);
    setAuthInfoMessage(null);
    setAuthFormValues((current) => ({
      ...current,
      password: "",
      displayName: mode === "register" ? current.displayName : "",
      resetToken: mode === "reset_password" ? current.resetToken : "",
    }));
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAuthSubmitting) {
      return;
    }

    setAuthErrorMessage(null);
    setAuthInfoMessage(null);
    setIsAuthSubmitting(true);

    try {
      if (authMode === "login" || authMode === "register") {
        const result =
          authMode === "login" ? await loginUser(authFormValues) : await registerUser(authFormValues);

        applyAuthSession(result.token, result.user);
        setAuthFormValues({
          email: result.user.email,
          password: "",
          displayName: result.user.displayName ?? "",
          resetToken: "",
        });
      } else if (authMode === "forgot_password") {
        const result = await requestPasswordReset(authFormValues.email);
        const resetToken = result.resetToken;
        if (resetToken) {
          setAuthFormValues((current) => ({
            ...current,
            password: "",
            resetToken,
          }));
          setAuthMode("reset_password");
          setAuthInfoMessage(
            isFrench
              ? "Un jeton de reinitialisation a ete genere. Choisissez maintenant un nouveau mot de passe."
              : "A reset token was generated. You can now choose a new password."
          );
        } else {
          setAuthFormValues((current) => ({
            ...current,
            password: "",
            resetToken: "",
          }));
          setAuthInfoMessage(
            isFrench
              ? "Aucun jeton n'a ete genere. Verifiez l'email saisi ou creez un compte si vous n'en avez pas encore."
              : "No reset token was generated. Check the email address or create an account if you do not have one yet."
          );
        }
      } else {
        const result = await resetPasswordWithToken(
          authFormValues.resetToken,
          authFormValues.password
        );

        applyAuthSession(result.token, result.user);
        setAuthFormValues({
          email: result.user.email,
          password: "",
          displayName: result.user.displayName ?? "",
          resetToken: "",
        });
      }
    } catch (error) {
      if (
        authMode === "reset_password" &&
        error instanceof ApiRequestError &&
        error.statusCode === 401 &&
        error.apiCode === "INVALID_RESET_TOKEN"
      ) {
        setAuthMode("login");
        setAuthFormValues((current) => ({
          ...current,
          password: "",
          resetToken: "",
        }));
        setAuthErrorMessage(
          isFrench
            ? "Ce jeton de reinitialisation n'est plus valide. Connectez-vous avec votre mot de passe actuel ou demandez un nouveau jeton."
            : "This reset token is no longer valid. Sign in with your current password or request a new reset token."
        );
        return;
      }

      setAuthErrorMessage(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de vous authentifier."
          : "Unable to authenticate."
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    const token = authToken;

    try {
      if (token) {
        await logoutUser(token);
      }
    } catch {
      // Keep logout UX predictable even if backend session cleanup fails.
    } finally {
      clearAuthSession();
    }
  }

  const updateAuthenticatedUser = useCallback((user: AuthUser) => {
    const normalizedUser = normalizeAuthUser(user);
    setAuthUser(normalizedUser);
    setAuthFormValues((current) => ({
      ...current,
      email: normalizedUser.email,
      displayName: normalizedUser.displayName ?? "",
    }));
  }, []);

  useEffect(() => {
    setGuestLocale(
      getPreferredLocale(window.navigator?.language ?? window.navigator?.languages?.[0] ?? "en")
    );
  }, []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    setAuthToken(storedToken);
    setIsAuthReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!authToken) {
      setAuthUser(null);
      return;
    }

    let cancelled = false;

    loadCurrentUser(authToken)
      .then((user) => {
        if (!cancelled) {
          setAuthUser(user);
          setAuthErrorMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          if (error instanceof ApiRequestError && error.statusCode === 401) {
            clearAuthSession();
            setAuthErrorMessage(
              isFrench
                ? "Votre session a expire. Veuillez vous reconnecter."
                : "Your session expired. Please sign in again."
            );
            return;
          }

          setAuthErrorMessage(
            error instanceof Error
              ? error.message
              : isFrench
              ? "Impossible de valider votre session pour le moment."
              : "Unable to validate your session right now."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, clearAuthSession, isAuthReady, isFrench]);

  return {
    authToken,
    authUser,
    activeLocale,
    activeTimeZone,
    isFrench,
    isAuthReady,
    authMode,
    authFormValues,
    authErrorMessage,
    authInfoMessage,
    isAuthSubmitting,
    handleAuthFormFieldChange,
    handleAuthModeChange,
    handleAuthSubmit,
    handleLogout,
    clearAuthSession,
    updateAuthenticatedUser,
  };
}
