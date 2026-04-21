"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { createAuthHeaders, getApiErrorMessage } from "@/lib/api-client";
import { type AuthUser, type UserLocale } from "@/hooks/useAuthSession";

type CalendarEventTaskStatus = "todo" | "in_progress" | "done" | "cancelled";
type CalendarEventTaskPriority = "low" | "medium" | "high";

export type CalendarEventLinkedTask = {
  id: string;
  title: string;
  status: CalendarEventTaskStatus;
  targetDate: string;
  dueDate: string | null;
  priority: CalendarEventTaskPriority;
  project: string | null;
};

export type LinkedCalendarEvent = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  htmlLink: string | null;
};

export type CalendarEventLinkedNote = {
  id: string;
  title: string | null;
  body: string;
  color: string | null;
  targetDate: string | null;
  calendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventNoteAttachment = {
  id: string;
  calendarEventNoteId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

export type CalendarEventSummary = {
  id: string;
  connectionId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  htmlLink: string | null;
  note: CalendarEventLinkedNote | null;
  linkedTasks: CalendarEventLinkedTask[];
};

export type ProfileFormValues = {
  displayName: string;
  preferredLocale: UserLocale;
  preferredTimeZone: string;
  requireDailyAffirmation: boolean;
  requireDailyBilan: boolean;
  requireWeeklySynthesis: boolean;
  requireMonthlySynthesis: boolean;
};

export type GoogleCalendarConnection = {
  id: string;
  email: string;
  color: string;
  calendarId: string;
  lastSyncedAt: string | null;
};

type ProfileMutationInput = {
  displayName: string | null;
  preferredLocale: UserLocale;
  preferredTimeZone: string | null;
  requireDailyAffirmation: boolean;
  requireDailyBilan: boolean;
  requireWeeklySynthesis: boolean;
  requireMonthlySynthesis: boolean;
};

type UseProfileCalendarOptions = {
  authToken: string | null;
  authUser: AuthUser | null;
  isAuthReady: boolean;
  isFrench: boolean;
  selectedDate: string;
  updateAuthenticatedUser: (user: AuthUser) => void;
};

export function getGoogleCalendarUnavailableMessage(isFrench: boolean): string {
  return isFrench
    ? "Google Calendar n'est pas configure sur ce serveur. Renseignez les variables GOOGLE_* puis redemarrez le backend."
    : "Google Calendar is not configured on this server. Set the GOOGLE_* environment variables and restart the backend.";
}

export function getPreferredLocale(value: string | null | undefined): UserLocale {
  if (typeof value !== "string") {
    return "en";
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "fr" || normalized.startsWith("fr-") ? "fr" : "en";
}

function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function isValidIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
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

function getDefaultProfileFormValues(): ProfileFormValues {
  return {
    displayName: "",
    preferredLocale: "en",
    preferredTimeZone: getBrowserTimeZone(),
    requireDailyAffirmation: false,
    requireDailyBilan: false,
    requireWeeklySynthesis: false,
    requireMonthlySynthesis: false,
  };
}

function getProfileFormValues(user: AuthUser | null): ProfileFormValues {
  if (!user) {
    return getDefaultProfileFormValues();
  }

  return {
    displayName: user.displayName ?? "",
    preferredLocale: getPreferredLocale(user.preferredLocale),
    preferredTimeZone: user.preferredTimeZone ?? getBrowserTimeZone(),
    requireDailyAffirmation: user.requireDailyAffirmation ?? false,
    requireDailyBilan: user.requireDailyBilan ?? false,
    requireWeeklySynthesis: user.requireWeeklySynthesis ?? false,
    requireMonthlySynthesis: user.requireMonthlySynthesis ?? false,
  };
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Unable to read selected file."));
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read selected file."));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

async function updateProfile(input: ProfileMutationInput, token: string): Promise<AuthUser> {
  const response = await fetch("/backend-api/profile", {
    method: "PATCH",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: AuthUser; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to update profile"));
  }

  if (!payload?.data) {
    throw new Error("Unable to update profile.");
  }

  return normalizeAuthUser(payload.data);
}

async function saveCalendarEventNote(
  eventId: string,
  body: string,
  token: string
): Promise<CalendarEventLinkedNote> {
  const response = await fetch(`/backend-api/google-calendar/events/${encodeURIComponent(eventId)}/note`, {
    method: "PUT",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({ body }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: CalendarEventLinkedNote; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to save calendar event note"));
  }

  if (!payload?.data) {
    throw new Error("Unable to save calendar event note.");
  }

  return payload.data;
}

async function deleteCalendarEventNote(eventId: string, token: string): Promise<void> {
  const response = await fetch(`/backend-api/google-calendar/events/${encodeURIComponent(eventId)}/note`, {
    method: "DELETE",
    headers: createAuthHeaders(token, false),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: { deleted: boolean }; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to delete calendar event note"));
  }
}

async function loadCalendarEventNoteAttachments(
  eventId: string,
  token: string
): Promise<CalendarEventNoteAttachment[]> {
  const response = await fetch(`/backend-api/google-calendar/events/${encodeURIComponent(eventId)}/note/attachments`, {
    method: "GET",
    headers: createAuthHeaders(token, false),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: CalendarEventNoteAttachment[]; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to load calendar event note attachments"));
  }
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function createCalendarEventNoteAttachmentApi(
  eventId: string,
  input: { name: string; file: File },
  token: string
): Promise<CalendarEventNoteAttachment> {
  const fileDataUrl = await readFileAsDataUrl(input.file);
  const response = await fetch(`/backend-api/google-calendar/events/${encodeURIComponent(eventId)}/note/attachments`, {
    method: "POST",
    headers: createAuthHeaders(token, true),
    body: JSON.stringify({
      name: input.name,
      url: fileDataUrl,
      contentType: input.file.type || null,
      sizeBytes: input.file.size,
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: CalendarEventNoteAttachment; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to create calendar event note attachment"));
  }
  if (!payload?.data) throw new Error("Unable to create calendar event note attachment.");
  return payload.data;
}

async function deleteCalendarEventNoteAttachmentApi(
  eventId: string,
  attachmentId: string,
  token: string
): Promise<void> {
  const response = await fetch(
    `/backend-api/google-calendar/events/${encodeURIComponent(eventId)}/note/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE", headers: createAuthHeaders(token, false) }
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(getApiErrorMessage(response.status, payload, "Unable to delete calendar event note attachment"));
  }
}

export function useProfileCalendar({
  authToken,
  authUser,
  isAuthReady,
  isFrench,
  selectedDate,
  updateAuthenticatedUser,
}: UseProfileCalendarOptions) {
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [profileFormValues, setProfileFormValues] = useState<ProfileFormValues>(
    getDefaultProfileFormValues
  );
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [googleCalendarConnections, setGoogleCalendarConnections] = useState<GoogleCalendarConnection[]>([]);
  const [isGoogleCalendarAvailable, setIsGoogleCalendarAvailable] = useState(true);
  const [isGoogleCalendarLoading, setIsGoogleCalendarLoading] = useState(false);
  const [isGoogleCalendarSyncing, setIsGoogleCalendarSyncing] = useState(false);
  const [googleCalendarError, setGoogleCalendarError] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventSummary[]>([]);
  const [isCalendarEventsLoading, setIsCalendarEventsLoading] = useState(false);
  const [calendarEventNoteDrafts, setCalendarEventNoteDrafts] = useState<Record<string, string>>({});
  const [pendingCalendarEventNoteIds, setPendingCalendarEventNoteIds] = useState<string[]>([]);
  const [calendarEventNoteAttachments, setCalendarEventNoteAttachments] = useState<Record<string, CalendarEventNoteAttachment[]>>({});
  const [calendarEventNoteAttachmentNameDraft, setCalendarEventNoteAttachmentNameDraft] = useState("");
  const [calendarEventNoteAttachmentFileDraft, setCalendarEventNoteAttachmentFileDraft] = useState<File | null>(null);
  const calendarEventNoteAttachmentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [calendarEventNoteAttachmentErrorMessage, setCalendarEventNoteAttachmentErrorMessage] = useState<string | null>(null);
  const [isCreatingCalendarEventNoteAttachment, setIsCreatingCalendarEventNoteAttachment] = useState(false);
  const [pendingCalendarEventNoteAttachmentIds, setPendingCalendarEventNoteAttachmentIds] = useState<string[]>([]);
  const [pendingCalendarEventTaskIds, setPendingCalendarEventTaskIds] = useState<string[]>([]);
  const [expandedCalendarEventId, setExpandedCalendarEventId] = useState<string | null>(null);
  const [calendarEventSearchQuery, setCalendarEventSearchQuery] = useState("");
  const [connectionCalendarOptions, setConnectionCalendarOptions] = useState<
    Record<string, Array<{ id: string; summary: string; primary: boolean }>>
  >({});

  const resetProfileCalendarState = useCallback(() => {
    setIsProfileDialogOpen(false);
    setProfileFormValues(getDefaultProfileFormValues());
    setProfileErrorMessage(null);
    setProfileSuccessMessage(null);
    setIsProfileSaving(false);
    setGoogleCalendarConnections([]);
    setIsGoogleCalendarAvailable(true);
    setIsGoogleCalendarLoading(false);
    setIsGoogleCalendarSyncing(false);
    setGoogleCalendarError(null);
    setCalendarEvents([]);
    setIsCalendarEventsLoading(false);
    setCalendarEventNoteDrafts({});
    setPendingCalendarEventNoteIds([]);
    setCalendarEventNoteAttachments({});
    setPendingCalendarEventNoteAttachmentIds([]);
    setPendingCalendarEventTaskIds([]);
    setExpandedCalendarEventId(null);
    setCalendarEventSearchQuery("");
    setConnectionCalendarOptions({});
    setCalendarEventNoteAttachmentNameDraft("");
    setCalendarEventNoteAttachmentFileDraft(null);
    if (calendarEventNoteAttachmentFileInputRef.current) {
      calendarEventNoteAttachmentFileInputRef.current.value = "";
    }
    setCalendarEventNoteAttachmentErrorMessage(null);
    setIsCreatingCalendarEventNoteAttachment(false);
  }, []);

  const filteredCalendarEvents = useMemo(() => {
    if (!calendarEventSearchQuery.trim()) return calendarEvents;
    const q = calendarEventSearchQuery.toLowerCase();
    return calendarEvents.filter(
      (event) =>
        event.title.toLowerCase().includes(q) ||
        (event.description && event.description.toLowerCase().includes(q)) ||
        (event.location && event.location.toLowerCase().includes(q))
    );
  }, [calendarEvents, calendarEventSearchQuery]);

  const fetchGoogleCalendarStatus = useCallback(async () => {
    if (!authToken) return;
    setIsGoogleCalendarLoading(true);
    setGoogleCalendarError(null);
    try {
      const response = await fetch("/backend-api/google-calendar/status", {
        headers: createAuthHeaders(authToken, false),
      });
      if (response.status === 404) {
        setIsGoogleCalendarAvailable(false);
        setGoogleCalendarConnections([]);
        setGoogleCalendarError(getGoogleCalendarUnavailableMessage(isFrench));
        return;
      }
      if (response.ok) {
        setIsGoogleCalendarAvailable(true);
        const payload = await response.json();
        setGoogleCalendarConnections(payload.data.connections ?? []);
      }
    } catch {
      // Non-critical — connections will stay empty.
    } finally {
      setIsGoogleCalendarLoading(false);
    }
  }, [authToken, isFrench]);

  const fetchCalendarEvents = useCallback(
    async (date: string, forceLoad = false) => {
      if (!authToken || (!forceLoad && googleCalendarConnections.length === 0)) {
        setCalendarEvents([]);
        setCalendarEventNoteDrafts({});
        setExpandedCalendarEventId(null);
        return;
      }
      setIsCalendarEventsLoading(true);
      try {
        const response = await fetch(`/backend-api/google-calendar/events?date=${date}`, {
          headers: createAuthHeaders(authToken, false),
        });
        if (response.ok) {
          const payload = await response.json();
          const nextEvents = (payload.data ?? []) as CalendarEventSummary[];
          setCalendarEvents(nextEvents);
          setCalendarEventNoteDrafts(
            Object.fromEntries(nextEvents.map((event) => [event.id, event.note?.body ?? ""]))
          );
          setExpandedCalendarEventId(null);
        } else {
          setCalendarEvents([]);
          setCalendarEventNoteDrafts({});
          setExpandedCalendarEventId(null);
        }
      } catch {
        setCalendarEvents([]);
        setCalendarEventNoteDrafts({});
        setExpandedCalendarEventId(null);
      } finally {
        setIsCalendarEventsLoading(false);
      }
    },
    [authToken, googleCalendarConnections.length]
  );

  const handleSyncGoogleCalendar = useCallback(async () => {
    if (!authToken) return;
    setGoogleCalendarError(null);
    setIsGoogleCalendarSyncing(true);
    try {
      const response = await fetch("/backend-api/google-calendar/sync", {
        method: "POST",
        headers: createAuthHeaders(authToken, false),
      });
      if (response.ok) {
        await fetchGoogleCalendarStatus();
        await fetchCalendarEvents(selectedDate, true);
      } else {
        const payload = await response.json().catch(() => null);
        setGoogleCalendarError(
          payload?.error?.message ??
            (isFrench ? "La synchronisation a echoue." : "Sync failed.")
        );
      }
    } catch {
      setGoogleCalendarError(
        isFrench ? "La synchronisation a echoue." : "Sync failed."
      );
    } finally {
      setIsGoogleCalendarSyncing(false);
    }
  }, [authToken, fetchCalendarEvents, fetchGoogleCalendarStatus, isFrench, selectedDate]);

  const handleConnectGoogleCalendar = useCallback(async () => {
    if (!authToken) return;
    if (!isGoogleCalendarAvailable) {
      setGoogleCalendarError(getGoogleCalendarUnavailableMessage(isFrench));
      return;
    }
    setGoogleCalendarError(null);
    try {
      const response = await fetch("/backend-api/google-calendar/auth-url", {
        headers: createAuthHeaders(authToken, false),
      });
      if (response.status === 404) {
        setIsGoogleCalendarAvailable(false);
        setGoogleCalendarError(getGoogleCalendarUnavailableMessage(isFrench));
        return;
      }
      if (!response.ok) {
        setGoogleCalendarError(
          isFrench
            ? "Impossible de demarrer la connexion Google Calendar."
            : "Unable to start Google Calendar connection."
        );
        return;
      }
      const payload = await response.json();
      window.location.href = payload.data.url;
    } catch {
      setGoogleCalendarError(
        isFrench
          ? "Impossible de demarrer la connexion Google Calendar."
          : "Unable to start Google Calendar connection."
      );
    }
  }, [authToken, isFrench, isGoogleCalendarAvailable]);

  const handleDisconnectGoogleCalendar = useCallback(async (connectionId: string) => {
    if (!authToken) return;
    setGoogleCalendarError(null);
    try {
      const response = await fetch(`/backend-api/google-calendar/connection/${connectionId}`, {
        method: "DELETE",
        headers: createAuthHeaders(authToken, false),
      });
      if (response.ok) {
        setGoogleCalendarConnections((prev) => prev.filter((connection) => connection.id !== connectionId));
      } else {
        setGoogleCalendarError(
          isFrench ? "Impossible de deconnecter Google Calendar." : "Unable to disconnect Google Calendar."
        );
      }
    } catch {
      setGoogleCalendarError(
        isFrench ? "Impossible de deconnecter Google Calendar." : "Unable to disconnect Google Calendar."
      );
    }
  }, [authToken, isFrench]);

  const handleUpdateConnectionColor = useCallback(async (connectionId: string, color: string) => {
    if (!authToken) return;
    try {
      const response = await fetch(`/backend-api/google-calendar/connection/${connectionId}/color`, {
        method: "PATCH",
        headers: createAuthHeaders(authToken, true),
        body: JSON.stringify({ color }),
      });
      if (response.ok) {
        setGoogleCalendarConnections((prev) =>
          prev.map((connection) => (connection.id === connectionId ? { ...connection, color } : connection))
        );
      }
    } catch {
      // Non-critical.
    }
  }, [authToken]);

  const fetchConnectionCalendars = useCallback(async (connectionId: string) => {
    if (!authToken) return;
    try {
      const response = await fetch(`/backend-api/google-calendar/connection/${connectionId}/calendars`, {
        headers: createAuthHeaders(authToken, false),
      });
      if (response.ok) {
        const payload = await response.json();
        setConnectionCalendarOptions((prev) => ({ ...prev, [connectionId]: payload.data ?? [] }));
      }
    } catch {
      // Non-critical.
    }
  }, [authToken]);

  const handleUpdateCalendarId = useCallback(async (connectionId: string, calendarId: string) => {
    if (!authToken) return;
    setGoogleCalendarError(null);
    try {
      const response = await fetch(`/backend-api/google-calendar/connection/${connectionId}/calendar`, {
        method: "PATCH",
        headers: createAuthHeaders(authToken, true),
        body: JSON.stringify({ calendarId }),
      });
      if (response.ok) {
        setGoogleCalendarConnections((prev) =>
          prev.map((connection) => (connection.id === connectionId ? { ...connection, calendarId } : connection))
        );
        void handleSyncGoogleCalendar();
      } else {
        const payload = await response.json().catch(() => null);
        setGoogleCalendarError(
          payload?.error?.message ??
            (isFrench
              ? "Impossible de changer le calendrier selectionne."
              : "Unable to change the selected calendar.")
        );
      }
    } catch {
      setGoogleCalendarError(
        isFrench
          ? "Impossible de changer le calendrier selectionne."
          : "Unable to change the selected calendar."
      );
    }
  }, [authToken, handleSyncGoogleCalendar, isFrench]);

  const openProfileDialog = useCallback(() => {
    setProfileFormValues(getProfileFormValues(authUser));
    setProfileErrorMessage(null);
    setProfileSuccessMessage(null);
    setIsProfileDialogOpen(true);
    void fetchGoogleCalendarStatus();
  }, [authUser, fetchGoogleCalendarStatus]);

  const closeProfileDialog = useCallback(() => {
    setIsProfileDialogOpen(false);
  }, []);

  const handleProfileFieldChange = useCallback(
    <K extends keyof ProfileFormValues>(field: K, value: ProfileFormValues[K]) => {
      setProfileFormValues((current) => ({
        ...current,
        [field]: value,
      }));
    },
    []
  );

  const handleProfileSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!authToken || !authUser || isProfileSaving) {
        return;
      }

      const preferredTimeZone = profileFormValues.preferredTimeZone.trim();

      if (preferredTimeZone !== "" && !isValidIanaTimeZone(preferredTimeZone)) {
        setProfileErrorMessage(
          isFrench
            ? "Le fuseau horaire doit etre une valeur IANA valide, par exemple Europe/Paris."
            : "Time zone must be a valid IANA value, for example Europe/Paris."
        );
        setProfileSuccessMessage(null);
        return;
      }

      setIsProfileSaving(true);
      setProfileErrorMessage(null);
      setProfileSuccessMessage(null);

      try {
        const updatedUser = await updateProfile(
          {
            displayName: profileFormValues.displayName.trim() || null,
            preferredLocale: getPreferredLocale(profileFormValues.preferredLocale),
            preferredTimeZone: preferredTimeZone || null,
            requireDailyAffirmation: profileFormValues.requireDailyAffirmation,
            requireDailyBilan: profileFormValues.requireDailyBilan,
            requireWeeklySynthesis: profileFormValues.requireWeeklySynthesis,
            requireMonthlySynthesis: profileFormValues.requireMonthlySynthesis,
          },
          authToken
        );

        updateAuthenticatedUser(updatedUser);
        setProfileFormValues(getProfileFormValues(updatedUser));
        setProfileSuccessMessage(isFrench ? "Profil mis a jour." : "Profile updated.");
      } catch (error) {
        setProfileErrorMessage(
          error instanceof Error
            ? error.message
            : isFrench
            ? "Impossible de mettre a jour le profil."
            : "Unable to update profile."
        );
      } finally {
        setIsProfileSaving(false);
      }
    },
    [authToken, authUser, isFrench, isProfileSaving, profileFormValues, updateAuthenticatedUser]
  );

  const handleSaveCalendarEventNote = useCallback(async (eventId: string) => {
    if (!authToken) return;
    const draft = (calendarEventNoteDrafts[eventId] ?? "").trim();
    if (!draft) {
      setGoogleCalendarError(
        isFrench ? "La note de l'evenement ne peut pas etre vide." : "Calendar event note cannot be empty."
      );
      return;
    }

    setGoogleCalendarError(null);
    setPendingCalendarEventNoteIds((current) =>
      current.includes(eventId) ? current : [...current, eventId]
    );

    try {
      const note = await saveCalendarEventNote(eventId, draft, authToken);
      setCalendarEvents((current) =>
        current.map((event) => (event.id === eventId ? { ...event, note } : event))
      );
      setCalendarEventNoteDrafts((current) => ({
        ...current,
        [eventId]: note.body,
      }));
    } catch (error) {
      setGoogleCalendarError(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible d'enregistrer la note de l'evenement."
          : "Unable to save calendar event note."
      );
    } finally {
      setPendingCalendarEventNoteIds((current) => current.filter((candidate) => candidate !== eventId));
    }
  }, [authToken, calendarEventNoteDrafts, isFrench]);

  const handleDeleteCalendarEventNote = useCallback(async (eventId: string) => {
    if (!authToken) return;

    setGoogleCalendarError(null);
    setPendingCalendarEventNoteIds((current) =>
      current.includes(eventId) ? current : [...current, eventId]
    );

    try {
      await deleteCalendarEventNote(eventId, authToken);
      setCalendarEvents((current) =>
        current.map((event) => (event.id === eventId ? { ...event, note: null } : event))
      );
      setCalendarEventNoteDrafts((current) => ({
        ...current,
        [eventId]: "",
      }));
    } catch (error) {
      setGoogleCalendarError(
        error instanceof Error
          ? error.message
          : isFrench
          ? "Impossible de supprimer la note de l'evenement."
          : "Unable to delete calendar event note."
      );
    } finally {
      setPendingCalendarEventNoteIds((current) => current.filter((candidate) => candidate !== eventId));
    }
  }, [authToken, isFrench]);

  const handleLoadCalendarEventNoteAttachments = useCallback(async (eventId: string) => {
    if (!authToken || calendarEventNoteAttachments[eventId]) return;
    try {
      const attachments = await loadCalendarEventNoteAttachments(eventId, authToken);
      setCalendarEventNoteAttachments((prev) => ({ ...prev, [eventId]: attachments }));
    } catch {
      setCalendarEventNoteAttachments((prev) => ({ ...prev, [eventId]: [] }));
    }
  }, [authToken, calendarEventNoteAttachments]);

  const handleCreateCalendarEventNoteAttachment = useCallback(async (eventId: string) => {
    if (!authToken || isCreatingCalendarEventNoteAttachment) return;
    const file = calendarEventNoteAttachmentFileDraft;
    const name = calendarEventNoteAttachmentNameDraft.trim() || file?.name?.trim() || "";

    if (!name) {
      setCalendarEventNoteAttachmentErrorMessage(isFrench ? "Le nom de la piece jointe est requis." : "Attachment name is required.");
      return;
    }
    if (!file) {
      setCalendarEventNoteAttachmentErrorMessage(isFrench ? "Veuillez selectionner un fichier." : "Please select a file.");
      return;
    }

    setCalendarEventNoteAttachmentErrorMessage(null);
    setIsCreatingCalendarEventNoteAttachment(true);

    try {
      const attachment = await createCalendarEventNoteAttachmentApi(eventId, { name, file }, authToken);
      setCalendarEventNoteAttachments((prev) => ({
        ...prev,
        [eventId]: [...(prev[eventId] ?? []), attachment],
      }));
      setCalendarEventNoteAttachmentNameDraft("");
      setCalendarEventNoteAttachmentFileDraft(null);
      if (calendarEventNoteAttachmentFileInputRef.current) calendarEventNoteAttachmentFileInputRef.current.value = "";
    } catch (error) {
      setCalendarEventNoteAttachmentErrorMessage(
        error instanceof Error ? error.message : isFrench ? "Impossible d'ajouter le document." : "Unable to add document."
      );
    } finally {
      setIsCreatingCalendarEventNoteAttachment(false);
    }
  }, [
    authToken,
    calendarEventNoteAttachmentFileDraft,
    calendarEventNoteAttachmentNameDraft,
    isCreatingCalendarEventNoteAttachment,
    isFrench,
  ]);

  const handleDeleteCalendarEventNoteAttachment = useCallback(async (eventId: string, attachmentId: string) => {
    if (!authToken) return;
    setPendingCalendarEventNoteAttachmentIds((prev) => [...prev, attachmentId]);
    try {
      await deleteCalendarEventNoteAttachmentApi(eventId, attachmentId, authToken);
      setCalendarEventNoteAttachments((prev) => ({
        ...prev,
        [eventId]: (prev[eventId] ?? []).filter((attachment) => attachment.id !== attachmentId),
      }));
    } catch {
      // Silent.
    } finally {
      setPendingCalendarEventNoteAttachmentIds((prev) => prev.filter((id) => id !== attachmentId));
    }
  }, [authToken]);

  useEffect(() => {
    if (!authUser) {
      resetProfileCalendarState();
      return;
    }

    setProfileFormValues(getProfileFormValues(authUser));
  }, [authUser, resetProfileCalendarState]);

  useEffect(() => {
    if (!isAuthReady || !authToken) return;

    const params = new URLSearchParams(window.location.search);
    const googleCalendarResult = params.get("google-calendar");
    if (googleCalendarResult) {
      params.delete("google-calendar");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      if (googleCalendarResult === "connected") {
        fetchGoogleCalendarStatus().then(() => {
          void handleSyncGoogleCalendar();
        });
      } else if (googleCalendarResult === "error") {
        setGoogleCalendarError(
          isFrench
            ? "La connexion Google Calendar a echoue. Veuillez reessayer."
            : "Google Calendar connection failed. Please try again."
        );
      }
    } else {
      void fetchGoogleCalendarStatus();
    }
  }, [authToken, fetchGoogleCalendarStatus, handleSyncGoogleCalendar, isAuthReady, isFrench]);

  useEffect(() => {
    if (!isAuthReady || !authToken || !authUser) {
      setCalendarEvents([]);
      return;
    }

    void fetchCalendarEvents(selectedDate);
  }, [authToken, authUser, fetchCalendarEvents, isAuthReady, selectedDate]);

  return {
    isProfileDialogOpen,
    profileFormValues,
    profileErrorMessage,
    profileSuccessMessage,
    isProfileSaving,
    openProfileDialog,
    closeProfileDialog,
    handleProfileFieldChange,
    handleProfileSubmit,
    googleCalendarConnections,
    isGoogleCalendarAvailable,
    isGoogleCalendarLoading,
    isGoogleCalendarSyncing,
    googleCalendarError,
    setGoogleCalendarError,
    connectionCalendarOptions,
    calendarEvents,
    setCalendarEvents,
    filteredCalendarEvents,
    isCalendarEventsLoading,
    calendarEventNoteDrafts,
    setCalendarEventNoteDrafts,
    pendingCalendarEventNoteIds,
    calendarEventNoteAttachments,
    calendarEventNoteAttachmentNameDraft,
    setCalendarEventNoteAttachmentNameDraft,
    setCalendarEventNoteAttachmentFileDraft,
    calendarEventNoteAttachmentFileInputRef,
    calendarEventNoteAttachmentErrorMessage,
    isCreatingCalendarEventNoteAttachment,
    pendingCalendarEventNoteAttachmentIds,
    pendingCalendarEventTaskIds,
    setPendingCalendarEventTaskIds,
    expandedCalendarEventId,
    setExpandedCalendarEventId,
    calendarEventSearchQuery,
    setCalendarEventSearchQuery,
    fetchGoogleCalendarStatus,
    fetchCalendarEvents,
    handleConnectGoogleCalendar,
    handleDisconnectGoogleCalendar,
    handleSyncGoogleCalendar,
    handleUpdateConnectionColor,
    handleUpdateCalendarId,
    fetchConnectionCalendars,
    handleSaveCalendarEventNote,
    handleDeleteCalendarEventNote,
    handleLoadCalendarEventNoteAttachments,
    handleCreateCalendarEventNoteAttachment,
    handleDeleteCalendarEventNoteAttachment,
  };
}
