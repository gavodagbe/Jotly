"use client";

import {
  controlButtonClass,
  primaryButtonClass,
  textFieldClass,
} from "@/components/ui/constants";
import { CloseIcon, SaveIcon, TimeZoneIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";

type ProfileFormValues = {
  displayName: string;
  preferredLocale: UserLocale;
  preferredTimeZone: string;
  requireDailyAffirmation: boolean;
  requireDailyBilan: boolean;
  requireWeeklySynthesis: boolean;
  requireMonthlySynthesis: boolean;
};

type GoogleCalendarConnection = {
  id: string;
  email: string;
  color: string;
  calendarId: string;
  lastSyncedAt: string | null;
};

export type ProfileDialogProps = {
  isProfileDialogOpen: boolean;
  profileFormValues: ProfileFormValues;
  handleProfileFieldChange: <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;
  handleProfileSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  closeProfileDialog: () => void;
  isProfileSaving: boolean;
  profileErrorMessage: string | null;
  profileSuccessMessage: string | null;
  userLocaleOptions: ReadonlyArray<{ value: UserLocale; label: string }>;
  isFrench: boolean;
  isGoogleCalendarAvailable: boolean;
  isGoogleCalendarLoading: boolean;
  googleCalendarConnections: GoogleCalendarConnection[];
  connectionCalendarOptions: Record<string, Array<{ id: string; summary: string; primary: boolean }>>;
  googleCalendarError: string | null;
  isGoogleCalendarSyncing: boolean;
  handleConnectGoogleCalendar: () => void;
  handleDisconnectGoogleCalendar: (connectionId: string) => void;
  handleSyncGoogleCalendar: () => void;
  handleUpdateConnectionColor: (connectionId: string, color: string) => void;
  handleUpdateCalendarId: (connectionId: string, calendarId: string) => void;
  fetchConnectionCalendars: (connectionId: string) => void;
  getPreferredLocale: (value: string | null | undefined) => UserLocale;
  getBrowserTimeZone: () => string;
  getGoogleCalendarUnavailableMessage: (isFrench: boolean) => string;
};

export function ProfileDialog({
  isProfileDialogOpen,
  profileFormValues,
  handleProfileFieldChange,
  handleProfileSubmit,
  closeProfileDialog,
  isProfileSaving,
  profileErrorMessage,
  profileSuccessMessage,
  userLocaleOptions,
  isFrench,
  isGoogleCalendarAvailable,
  isGoogleCalendarLoading,
  googleCalendarConnections,
  connectionCalendarOptions,
  googleCalendarError,
  isGoogleCalendarSyncing,
  handleConnectGoogleCalendar,
  handleDisconnectGoogleCalendar,
  handleSyncGoogleCalendar,
  handleUpdateConnectionColor,
  handleUpdateCalendarId,
  fetchConnectionCalendars,
  getPreferredLocale,
  getBrowserTimeZone,
  getGoogleCalendarUnavailableMessage,
}: ProfileDialogProps) {
  if (!isProfileDialogOpen) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeProfileDialog();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={isFrench ? "Parametres du profil" : "Profile settings"}
        className="animate-scale-in w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6"
      >
        <header>
          <h3 className="text-lg font-semibold text-foreground">
            {isFrench ? "Parametres du profil" : "Profile Settings"}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {isFrench
              ? "Personnalisez vos preferences et la langue par defaut de l'assistant."
              : "Personalize your workspace preferences and default assistant language."}
          </p>
        </header>

        <form className="mt-4 space-y-3" onSubmit={handleProfileSubmit}>
          <label className="block text-sm font-semibold text-foreground">
            {isFrench ? "Nom affiche" : "Display Name"}
            <input
              type="text"
              value={profileFormValues.displayName}
              onChange={(event) => handleProfileFieldChange("displayName", event.target.value)}
              className={textFieldClass}
              disabled={isProfileSaving}
              placeholder={isFrench ? "Comment devons-nous vous appeler ?" : "How should we address you?"}
            />
          </label>

          <label className="block text-sm font-semibold text-foreground">
            {isFrench ? "Langue preferee" : "Preferred Language"}
            <select
              value={profileFormValues.preferredLocale}
              onChange={(event) => handleProfileFieldChange("preferredLocale", getPreferredLocale(event.target.value))}
              className={textFieldClass}
              disabled={isProfileSaving}
            >
              {userLocaleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-foreground">
            {isFrench ? "Fuseau horaire prefere" : "Preferred Time Zone"}
            <input
              type="text"
              value={profileFormValues.preferredTimeZone}
              onChange={(event) => handleProfileFieldChange("preferredTimeZone", event.target.value)}
              className={textFieldClass}
              disabled={isProfileSaving}
              placeholder="Europe/Paris"
            />
          </label>

          <button
            type="button"
            className={controlButtonClass}
            onClick={() => handleProfileFieldChange("preferredTimeZone", getBrowserTimeZone())}
            disabled={isProfileSaving}
          >
            <TimeZoneIcon />
            {isFrench ? "Utiliser le fuseau du navigateur" : "Use Browser Time Zone"}
          </button>

          <div className="border-t border-line pt-3">
            <h4 className="text-sm font-semibold text-foreground">Google Calendar</h4>
            {!isGoogleCalendarAvailable ? (
              <p className="mt-2 text-sm text-muted">{getGoogleCalendarUnavailableMessage(isFrench)}</p>
            ) : isGoogleCalendarLoading ? (
              <p className="mt-2 text-sm text-muted">{isFrench ? "Chargement..." : "Loading..."}</p>
            ) : (
              <div className="mt-2 space-y-2">
                {googleCalendarConnections.map((conn) => (
                  <div key={conn.id} className="rounded-lg border border-line px-3 py-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={conn.color}
                          onChange={(e) => handleUpdateConnectionColor(conn.id, e.target.value)}
                          className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                          title={isFrench ? "Couleur du calendrier" : "Calendar color"}
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">{conn.email}</p>
                          {conn.lastSyncedAt ? (
                            <p className="text-xs text-muted">
                              {isFrench ? "Derniere synchronisation :" : "Last synced:"}{" "}
                              {new Date(conn.lastSyncedAt).toLocaleString()}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-muted hover:text-foreground"
                        onClick={() => handleDisconnectGoogleCalendar(conn.id)}
                      >
                        {isFrench ? "Deconnecter" : "Disconnect"}
                      </button>
                    </div>
                    <select
                      value={conn.calendarId}
                      onFocus={() => {
                        if (!connectionCalendarOptions[conn.id]) fetchConnectionCalendars(conn.id);
                      }}
                      onChange={(e) => handleUpdateCalendarId(conn.id, e.target.value)}
                      className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent/15"
                    >
                      {connectionCalendarOptions[conn.id] ? (
                        connectionCalendarOptions[conn.id].map((cal) => (
                          <option key={cal.id} value={cal.id}>
                            {cal.summary}{cal.primary ? (isFrench ? " (principal)" : " (primary)") : ""}
                          </option>
                        ))
                      ) : (
                        <option value={conn.calendarId}>
                          {conn.calendarId === "primary"
                            ? (isFrench ? "Calendrier principal" : "Primary calendar")
                            : conn.calendarId}
                        </option>
                      )}
                    </select>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button type="button" className={controlButtonClass} onClick={handleConnectGoogleCalendar}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {isFrench
                      ? (googleCalendarConnections.length > 0 ? "Ajouter un compte Google" : "Connecter Google Calendar")
                      : (googleCalendarConnections.length > 0 ? "Add Google Account" : "Connect Google Calendar")}
                  </button>
                  {googleCalendarConnections.length > 0 ? (
                    <button
                      type="button"
                      className={controlButtonClass}
                      onClick={handleSyncGoogleCalendar}
                      disabled={isGoogleCalendarSyncing}
                    >
                      {isGoogleCalendarSyncing
                        ? (isFrench ? "Synchronisation..." : "Syncing...")
                        : (isFrench ? "Synchroniser" : "Sync")}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
            {googleCalendarError ? (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {googleCalendarError}
              </p>
            ) : null}
          </div>

          <div className="border-t border-line pt-3">
            <h4 className="text-sm font-semibold text-foreground">
              {isFrench ? "Sections obligatoires" : "Required Sections"}
            </h4>
            <p className="mt-1 text-xs text-muted">
              {isFrench
                ? "Les sections activees doivent etre completes chaque jour pour valider votre journee."
                : "Enabled sections must be completed each day to validate your day."}
            </p>
            <div className="mt-3 space-y-2">
              {(
                [
                  { key: "requireDailyAffirmation" as const, labelFr: "Affirmation du jour", labelEn: "Daily Affirmation" },
                  { key: "requireDailyBilan" as const, labelFr: "Bilan du jour", labelEn: "Daily Review (Bilan)" },
                  { key: "requireWeeklySynthesis" as const, labelFr: "Synthese hebdomadaire (dimanche)", labelEn: "Weekly Synthesis (Sunday)" },
                  { key: "requireMonthlySynthesis" as const, labelFr: "Synthese mensuelle", labelEn: "Monthly Synthesis" },
                ] as const
              ).map(({ key, labelFr, labelEn }) => (
                <label key={key} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={profileFormValues[key]}
                    onChange={(e) => handleProfileFieldChange(key, e.target.checked)}
                    disabled={isProfileSaving}
                    className="h-4 w-4 rounded border-line accent-accent"
                  />
                  <span className="text-sm text-foreground">
                    {isFrench ? labelFr : labelEn}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {profileErrorMessage ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {profileErrorMessage}
            </p>
          ) : null}

          {profileSuccessMessage ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {profileSuccessMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              className={controlButtonClass}
              onClick={closeProfileDialog}
              disabled={isProfileSaving}
            >
              <CloseIcon />
              {isFrench ? "Fermer" : "Close"}
            </button>
            <button type="submit" className={primaryButtonClass} disabled={isProfileSaving}>
              <SaveIcon />
              {isProfileSaving
                ? isFrench ? "Enregistrement..." : "Saving..."
                : isFrench ? "Enregistrer le profil" : "Save Profile"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
