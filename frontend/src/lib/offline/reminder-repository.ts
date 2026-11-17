/**
 * Reminder data access used by the app (same signatures as the former functions
 * in app-shell.tsx), offline-aware like task-repository.ts.
 */
import { OfflineError } from "../api/http";
import {
  fetchPendingReminders,
  fetchReminders,
  postReminder,
  postReminderAction,
  putReminder,
} from "../api/reminders-api";
import type { Reminder, ReminderAction, ReminderCreateInput, ReminderPatch } from "../api/reminder-types";
import { replaceMatching, upsertServerRecords } from "./local-store";
import { queueLocally, refreshFromServer, writeThrough } from "./repository-helpers";
import { createClientId, getOfflineSession } from "./session";

const OFFLINE_EDIT_UNAVAILABLE = "This reminder is not available offline. Reconnect to edit it.";

function sortByRemindAt(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((left, right) => Date.parse(left.remindAt) - Date.parse(right.remindAt));
}

/** Same rule as GET /api/reminders?date=: still active and due before the end of that (UTC) day. */
export function isActiveOnDate(reminder: Reminder, date: string): boolean {
  const endOfDay = Date.parse(`${date}T00:00:00.000Z`) + 24 * 60 * 60 * 1000;
  return (reminder.status === "pending" || reminder.status === "fired") && Date.parse(reminder.remindAt) < endOfDay;
}

export async function loadReminders(date: string, token: string, signal?: AbortSignal): Promise<Reminder[]> {
  const session = getOfflineSession();
  if (!session) {
    return fetchReminders(date, token, signal);
  }
  await refreshFromServer(async () => {
    const serverReminders = await fetchReminders(date, token, signal);
    await replaceMatching(session.db, session.db.reminders, (reminder) => isActiveOnDate(reminder, date), serverReminders);
  });
  const local = await session.db.reminders.toArray();
  return sortByRemindAt(local.filter((reminder) => isActiveOnDate(reminder, date)));
}

/**
 * Reminders due now. Online the server marks them as fired; offline the local copy
 * is used so the alert still appears, and the server catches up after reconnecting.
 */
export async function loadPendingReminders(token: string, signal?: AbortSignal): Promise<Reminder[]> {
  const session = getOfflineSession();
  if (!session) {
    return fetchPendingReminders(token, signal);
  }
  try {
    const fired = await fetchPendingReminders(token, signal);
    await upsertServerRecords(session.db, session.db.reminders, fired);
    return fired;
  } catch (error) {
    if (!(error instanceof OfflineError)) throw error;
  }
  const now = Date.now();
  const due = (await session.db.reminders.where("status").equals("pending").toArray()).filter(
    (reminder) => Date.parse(reminder.remindAt) <= now
  );
  const firedAt = new Date(now).toISOString();
  const firedLocally = due.map((reminder) => ({ ...reminder, status: "fired" as const, isFired: true, firedAt }));
  await session.db.reminders.bulkPut(firedLocally);
  return sortByRemindAt(firedLocally);
}

function buildLocalReminder(id: string, input: ReminderCreateInput): Reminder {
  const now = new Date().toISOString();
  return {
    id,
    title: input.title,
    description: input.description ?? null,
    project: input.project ?? null,
    projectId: input.projectId ?? null,
    assignees: input.assignees ?? null,
    remindAt: input.remindAt,
    status: "pending",
    isFired: false,
    firedAt: null,
    isDismissed: false,
    dismissedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createReminderApi(input: ReminderCreateInput, token: string): Promise<Reminder> {
  const session = getOfflineSession();
  if (!session) {
    return postReminder(input, token);
  }
  const id = createClientId();
  return writeThrough(
    session,
    async () => {
      const reminder = await postReminder({ ...input, id }, token);
      await session.db.reminders.put(reminder);
      return reminder;
    },
    async () => {
      const local = buildLocalReminder(id, input);
      await session.db.reminders.put(local);
      await queueLocally(session, { kind: "reminder.create", entityId: id, payload: input });
      return local;
    }
  );
}

export async function updateReminderApi(id: string, patch: ReminderPatch, token: string): Promise<Reminder> {
  const session = getOfflineSession();
  if (!session) {
    return putReminder(id, patch, token);
  }
  return writeThrough(
    session,
    async () => {
      const reminder = await putReminder(id, patch, token);
      await session.db.reminders.put(reminder);
      return reminder;
    },
    async () => {
      const local = await session.db.reminders.get(id);
      if (!local) throw new OfflineError(OFFLINE_EDIT_UNAVAILABLE);
      const movedToFuture = patch.remindAt !== undefined && Date.parse(patch.remindAt) > Date.now();
      // Keep the server version stamp: it is the base the queued change applies to.
      const updated: Reminder = {
        ...local,
        ...patch,
        ...(movedToFuture && local.status === "fired" ? { status: "pending", isFired: false, firedAt: null } : {}),
      };
      await session.db.reminders.put(updated);
      await queueLocally(session, { kind: "reminder.update", entityId: id, payload: patch, baseUpdatedAt: local.updatedAt });
      return updated;
    }
  );
}

async function applyAction(id: string, action: ReminderAction, token: string): Promise<Reminder> {
  const session = getOfflineSession();
  if (!session) {
    return postReminderAction(id, action, token);
  }
  return writeThrough(
    session,
    async () => {
      const reminder = await postReminderAction(id, action, token);
      await session.db.reminders.put(reminder);
      return reminder;
    },
    async () => {
      const local = await session.db.reminders.get(id);
      if (!local) throw new OfflineError(OFFLINE_EDIT_UNAVAILABLE);
      const now = new Date().toISOString();
      const updated: Reminder =
        action === "complete"
          ? { ...local, status: "completed", isDismissed: true, dismissedAt: now, completedAt: now }
          : { ...local, status: "cancelled", isDismissed: true, dismissedAt: now, cancelledAt: now };
      await session.db.reminders.put(updated);
      await queueLocally(session, { kind: `reminder.${action}`, entityId: id });
      return updated;
    }
  );
}

export function completeReminderApi(id: string, token: string): Promise<Reminder> {
  return applyAction(id, "complete", token);
}

export function cancelReminderApi(id: string, token: string): Promise<Reminder> {
  return applyAction(id, "cancel", token);
}
