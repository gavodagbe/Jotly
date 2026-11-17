/** Raw network calls for reminders (moved out of app-shell.tsx). */
import { apiRequest, requireData, withBase } from "./http";
import type { Reminder, ReminderAction, ReminderCreateInput, ReminderPatch } from "./reminder-types";

export async function fetchReminders(date: string, token: string, signal?: AbortSignal): Promise<Reminder[]> {
  const data = await apiRequest<Reminder[]>(
    `/reminders?date=${encodeURIComponent(date)}`,
    { method: "GET", token, signal },
    "Unable to load reminders"
  );
  return data ?? [];
}

/** Every reminder of the account, whatever its date or status (used to fill the offline copy). */
export async function fetchAllReminders(token: string, signal?: AbortSignal): Promise<Reminder[]> {
  const data = await apiRequest<Reminder[]>("/reminders", { method: "GET", token, signal }, "Unable to load reminders");
  return data ?? [];
}

export async function fetchPendingReminders(token: string, signal?: AbortSignal): Promise<Reminder[]> {
  const data = await apiRequest<Reminder[]>(
    "/reminders/pending",
    { method: "GET", token, signal },
    "Unable to load pending reminders"
  );
  return data ?? [];
}

export async function postReminder(input: ReminderCreateInput & { id?: string }, token: string): Promise<Reminder> {
  const data = await apiRequest<Reminder>("/reminders", { method: "POST", token, body: input }, "Unable to create reminder");
  return requireData(data, "Unable to create reminder");
}

export async function putReminder(
  id: string,
  patch: ReminderPatch,
  token: string,
  baseUpdatedAt?: string
): Promise<Reminder> {
  const data = await apiRequest<Reminder>(
    `/reminders/${encodeURIComponent(id)}`,
    { method: "PUT", token, body: withBase(patch, baseUpdatedAt) },
    "Unable to update reminder"
  );
  return requireData(data, "Unable to update reminder");
}

export async function postReminderAction(id: string, action: ReminderAction, token: string): Promise<Reminder> {
  const message = action === "complete" ? "Unable to complete reminder" : "Unable to cancel reminder";
  const data = await apiRequest<Reminder>(
    `/reminders/${encodeURIComponent(id)}/${action}`,
    { method: "POST", token, body: {} },
    message
  );
  return requireData(data, message);
}
