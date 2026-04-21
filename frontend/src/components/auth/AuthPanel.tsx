"use client";

import type { FormEvent } from "react";

import { APP_NAME, APP_TAGLINE } from "@/lib/app-meta";
import { primaryButtonClass, textFieldClass } from "@/components/ui/constants";

type UserLocale = "en" | "fr";
type AuthMode = "login" | "register" | "forgot_password" | "reset_password";

type AuthFormValues = {
  email: string;
  password: string;
  displayName: string;
  resetToken: string;
};

type AuthPanelProps = {
  locale: UserLocale;
  mode: AuthMode;
  values: AuthFormValues;
  isSubmitting: boolean;
  errorMessage: string | null;
  infoMessage: string | null;
  onModeChange: (mode: AuthMode) => void;
  onValueChange: (field: keyof AuthFormValues, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AuthPanel({
  locale,
  mode,
  values,
  isSubmitting,
  errorMessage,
  infoMessage,
  onModeChange,
  onValueChange,
  onSubmit,
}: AuthPanelProps) {
  const isFrench = locale === "fr";
  const submitLabel =
    mode === "login"
      ? isSubmitting
        ? isFrench
          ? "Connexion..."
          : "Signing in..."
        : isFrench
        ? "Se connecter"
        : "Sign in"
      : mode === "register"
      ? isSubmitting
        ? isFrench
          ? "Creation..."
          : "Creating..."
        : isFrench
        ? "Creer un compte"
        : "Create account"
      : mode === "forgot_password"
      ? isSubmitting
        ? isFrench
          ? "Preparation..."
          : "Preparing..."
        : isFrench
        ? "Generer un jeton"
        : "Generate reset token"
      : isSubmitting
      ? isFrench
        ? "Reinitialisation..."
        : "Resetting..."
      : isFrench
      ? "Reinitialiser le mot de passe"
      : "Reset password";

  const heading =
    mode === "login"
      ? isFrench
        ? "Bon retour"
        : "Welcome back"
      : mode === "register"
      ? isFrench
        ? "Creer un compte"
        : "Create your account"
      : mode === "forgot_password"
      ? isFrench
        ? "Mot de passe oublie"
        : "Forgot password"
      : isFrench
      ? "Nouveau mot de passe"
      : "Set a new password";

  const subtitle =
    mode === "login"
      ? isFrench
        ? "Connectez-vous pour acceder a votre tableau."
        : "Sign in to access your daily board."
      : mode === "register"
      ? isFrench
        ? "Commencez a suivre vos taches maintenant."
        : "Start tracking your tasks today."
      : mode === "forgot_password"
      ? isFrench
        ? "Entrez votre email pour generer un jeton de reinitialisation."
        : "Enter your email to generate a reset token."
      : isFrench
      ? "Collez le jeton si besoin puis choisissez un nouveau mot de passe."
      : "Paste the token if needed, then choose a new password.";

  return (
    <div className="flex min-h-screen animate-fade-in">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-lg font-bold text-white backdrop-blur-sm">J</div>
            <p className="text-xl font-semibold text-white">{APP_NAME}</p>
          </div>
          <h1 className="mt-12 max-w-md text-4xl font-semibold leading-tight text-white">
            {isFrench
              ? "Organisez chaque journee avec intention."
              : "Organize every day with intention."}
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-indigo-200">{APP_TAGLINE}</p>

          <div className="mt-10 space-y-4">
            <div className="flex items-center gap-3 text-sm text-indigo-100">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/15">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              {isFrench ? "Planifiez par jour, gardez les priorites visibles" : "Plan by day, keep priorities visible"}
            </div>
            <div className="flex items-center gap-3 text-sm text-indigo-100">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/15">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              {isFrench ? "Glissez les taches entre les statuts" : "Drag tasks across statuses"}
            </div>
            <div className="flex items-center gap-3 text-sm text-indigo-100">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/15">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              {isFrench ? "Suivez votre progression et consistance" : "Track progress and consistency"}
            </div>
          </div>
        </div>
        <p className="text-xs text-indigo-300">&copy; {new Date().getFullYear()} {APP_NAME}</p>
      </div>

      <div className="flex w-full flex-col items-center justify-center px-6 py-10 lg:w-1/2 lg:px-16">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-sm font-bold text-white">J</div>
              <p className="text-lg font-semibold text-foreground">{APP_NAME}</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-foreground">
            {heading}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {subtitle}
          </p>

          {mode === "login" || mode === "register" ? (
            <div className="mt-6 inline-flex rounded-lg bg-surface-soft p-1">
              <button
                type="button"
                className={`rounded-md px-5 py-2 text-sm font-medium transition-all duration-200 ${
                  mode === "login" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                }`}
                onClick={() => onModeChange("login")}
                disabled={isSubmitting}
              >
                {isFrench ? "Connexion" : "Sign in"}
              </button>
              <button
                type="button"
                className={`rounded-md px-5 py-2 text-sm font-medium transition-all duration-200 ${
                  mode === "register" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                }`}
                onClick={() => onModeChange("register")}
                disabled={isSubmitting}
              >
                {isFrench ? "Inscription" : "Register"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mt-6 text-sm font-medium text-accent hover:text-accent-strong"
              onClick={() => onModeChange("login")}
              disabled={isSubmitting}
            >
              {isFrench ? "Retour a la connexion" : "Back to sign in"}
            </button>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {mode !== "reset_password" ? (
              <label className="block text-sm font-medium text-foreground">
                {isFrench ? "Email" : "Email"}
                <input
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={(event) => onValueChange("email", event.target.value)}
                  className={textFieldClass}
                  disabled={isSubmitting}
                  placeholder="you@company.com"
                  required
                />
              </label>
            ) : null}

            {mode === "reset_password" ? (
              <label className="block text-sm font-medium text-foreground">
                {isFrench ? "Jeton de reinitialisation" : "Reset token"}
                <input
                  type="text"
                  autoComplete="one-time-code"
                  value={values.resetToken}
                  onChange={(event) => onValueChange("resetToken", event.target.value)}
                  className={textFieldClass}
                  disabled={isSubmitting}
                  placeholder={isFrench ? "Collez le jeton ici" : "Paste the token here"}
                  required
                />
              </label>
            ) : null}

            {mode !== "forgot_password" ? (
              <label className="block text-sm font-medium text-foreground">
                {mode === "reset_password"
                  ? isFrench
                    ? "Nouveau mot de passe"
                    : "New password"
                  : isFrench
                  ? "Mot de passe"
                  : "Password"}
                <input
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={values.password}
                  onChange={(event) => onValueChange("password", event.target.value)}
                  className={textFieldClass}
                  disabled={isSubmitting}
                  minLength={8}
                  required
                />
              </label>
            ) : null}

            {mode === "login" ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-strong"
                  onClick={() => onModeChange("forgot_password")}
                  disabled={isSubmitting}
                >
                  {isFrench ? "Mot de passe oublie ?" : "Forgot password?"}
                </button>
              </div>
            ) : null}

            {mode === "register" ? (
              <label className="block text-sm font-medium text-foreground">
                {isFrench ? "Nom affiche (optionnel)" : "Display Name (optional)"}
                <input
                  type="text"
                  autoComplete="name"
                  value={values.displayName}
                  onChange={(event) => onValueChange("displayName", event.target.value)}
                  className={textFieldClass}
                  disabled={isSubmitting}
                  placeholder={isFrench ? "Comment devons-nous vous appeler ?" : "How should we address you?"}
                />
              </label>
            ) : null}

            {infoMessage ? (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm text-sky-700">
                {infoMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button type="submit" className={`w-full py-3 ${primaryButtonClass}`} disabled={isSubmitting}>
              {submitLabel}
            </button>

            {mode === "reset_password" ? (
              <button
                type="button"
                className="w-full text-sm font-medium text-muted hover:text-foreground"
                onClick={() => onModeChange("forgot_password")}
                disabled={isSubmitting}
              >
                {isFrench ? "Generer un nouveau jeton" : "Generate a new token"}
              </button>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
