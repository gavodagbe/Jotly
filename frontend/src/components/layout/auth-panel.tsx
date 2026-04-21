"use client";

import { type FormEvent } from "react";
import { APP_NAME } from "@/lib/app-meta";
import { LightningIcon } from "./app-shell.icons";
import { primaryButtonClass, segmentedControlClass, textFieldClass } from "./app-shell.styles";
import type { AuthFormValues, AuthMode, UserLocale } from "./app-shell.types";

export type AuthPanelProps = {
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
    <div className="min-h-screen animate-fade-in bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.14),transparent_28%),linear-gradient(180deg,#fcf8ff_0%,#f7f4ff_100%)]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="auth-brand-shell relative hidden overflow-hidden px-12 py-10 lg:flex lg:flex-col lg:justify-between xl:px-16">
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-lg font-black text-accent shadow-[0_18px_36px_rgba(16,0,105,0.18)]">J</div>
              <div>
                <p className="text-xl font-bold text-white">{APP_NAME}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/60">
                  {isFrench ? "Systeme operationnel quotidien" : "Daily operating system"}
                </p>
              </div>
            </div>

            <div className="mt-24 max-w-xl">
              <h1 className="text-5xl font-black leading-[1.04] tracking-[-0.05em] text-white xl:text-6xl">
                {isFrench ? "Passez du chaos" : "Flow into"}
                <br />
                <span className="text-[#acf847]">{isFrench ? "a la clarte." : "focus."}</span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-8 text-indigo-100/90">
                {isFrench
                  ? "Le cockpit quotidien pour piloter vos taches, vos rappels et votre contexte calendrier sans perdre le fil de la date."
                  : "The daily command center for tasks, reminders, and calendar context without losing the selected-date flow."}
              </p>
            </div>
          </div>

          <div className="relative z-10 grid max-w-xl gap-4 xl:grid-cols-2">
            <article className="rounded-[30px] border border-white/10 bg-white/10 p-5 text-white shadow-[0_30px_60px_rgba(16,0,105,0.14)] backdrop-blur-md">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#acf847] text-[#1f00a4]">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8l2.5 2.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="mt-5 text-3xl font-black tracking-tight">99.9%</p>
              <p className="mt-2 text-sm text-white/78">
                {isFrench ? "Flux garde sous controle, sans friction inutile." : "Keep your flow under control with less friction."}
              </p>
            </article>
            <article className="rounded-[30px] border border-white/10 bg-white/10 p-5 text-white shadow-[0_30px_60px_rgba(16,0,105,0.14)] backdrop-blur-md">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/16 text-[#acf847]">
                <LightningIcon />
              </div>
              <p className="mt-5 text-2xl font-black tracking-tight">Smart Flow</p>
              <p className="mt-2 text-sm text-white/78">
                {isFrench ? "Une priorisation claire, du cockpit au bilan." : "Clear prioritization from board to reflection."}
              </p>
            </article>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-[31rem]">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-strong text-sm font-black text-white shadow-[0_18px_36px_rgba(53,37,205,0.24)]">J</div>
              <div>
                <p className="text-lg font-bold text-foreground">{APP_NAME}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">Daily flow</p>
              </div>
            </div>

            <div className="auth-card-shell rounded-[36px] bg-white/86 p-7 sm:p-9">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black tracking-[-0.04em] text-foreground">{heading}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>
                </div>
                {mode === "login" || mode === "register" ? (
                  <div className={`${segmentedControlClass} shrink-0`}>
                    <button
                      type="button"
                      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-200 ${
                        mode === "login" ? "bg-white text-foreground shadow-[0_10px_24px_rgba(16,0,105,0.08)]" : "text-muted hover:text-foreground"
                      }`}
                      onClick={() => onModeChange("login")}
                      disabled={isSubmitting}
                    >
                      {isFrench ? "Connexion" : "Sign in"}
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-200 ${
                        mode === "register" ? "bg-white text-foreground shadow-[0_10px_24px_rgba(16,0,105,0.08)]" : "text-muted hover:text-foreground"
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
                    className="text-sm font-semibold text-accent transition-colors hover:text-accent-strong"
                    onClick={() => onModeChange("login")}
                    disabled={isSubmitting}
                  >
                    {isFrench ? "Retour a la connexion" : "Back to sign in"}
                  </button>
                )}
              </div>

              <form className="mt-7 space-y-4" onSubmit={onSubmit}>
                {errorMessage ? <p className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}
                {infoMessage ? <p className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">{infoMessage}</p> : null}

                {mode !== "reset_password" ? (
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    {isFrench ? "Adresse email" : "Email address"}
                    <input
                      type="email"
                      autoComplete="email"
                      value={values.email}
                      onChange={(event) => onValueChange("email", event.target.value)}
                      className={textFieldClass}
                      disabled={isSubmitting}
                      placeholder="alex@example.com"
                      required
                    />
                  </label>
                ) : null}

                {mode === "reset_password" ? (
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
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
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span>
                        {mode === "reset_password"
                          ? isFrench
                            ? "Nouveau mot de passe"
                            : "New password"
                          : isFrench
                            ? "Mot de passe"
                            : "Password"}
                      </span>
                      {mode === "login" ? (
                        <button
                          type="button"
                          className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent transition-colors hover:text-accent-strong"
                          onClick={() => onModeChange("forgot_password")}
                          disabled={isSubmitting}
                        >
                          {isFrench ? "Mot de passe oublie ?" : "Forgot Password?"}
                        </button>
                      ) : null}
                    </div>
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

                {mode === "register" ? (
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    {isFrench ? "Nom affiche" : "Display name"}
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

                <button type="submit" className={`w-full py-3.5 ${primaryButtonClass}`} disabled={isSubmitting}>
                  {submitLabel}
                </button>

                {mode === "reset_password" ? (
                  <button
                    type="button"
                    className="w-full text-sm font-medium text-muted transition-colors hover:text-foreground"
                    onClick={() => onModeChange("forgot_password")}
                    disabled={isSubmitting}
                  >
                    {isFrench ? "Generer un nouveau jeton" : "Generate a new token"}
                  </button>
                ) : null}
              </form>

              {mode === "login" || mode === "register" ? (
                <p className="mt-6 text-center text-sm text-muted">
                  {mode === "login" ? (isFrench ? "Pas encore de compte ?" : "Don't have an account?") : isFrench ? "Vous avez deja un compte ?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    className="font-semibold text-accent transition-colors hover:text-accent-strong"
                    onClick={() => onModeChange(mode === "login" ? "register" : "login")}
                    disabled={isSubmitting}
                  >
                    {mode === "login" ? (isFrench ? "Inscription" : "Sign Up") : isFrench ? "Connexion" : "Sign In"}
                  </button>
                </p>
              ) : null}

              <div className="mt-8 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                <span>© 2026 {APP_NAME}</span>
                <span>{isFrench ? "Confidentialite · Conditions" : "Privacy · Terms"}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
