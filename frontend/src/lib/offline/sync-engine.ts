/**
 * Pushes the outbox to the server in order, then refreshes the local window.
 * See planning/OFFLINE.md (phase 2) for the rules.
 */
import { deleteTask, fetchAllTasks, isOfflineError, patchTask, postTask, putTaskTimeEntry, TaskApiError } from "../api/tasks-api";
import type { Task } from "../api/task-types";
import { readMeta, writeMeta, type JotlyOfflineDb, type OutboxEntry, type SyncIssue } from "./db";
import { replaceTasksInRange } from "./local-store";
import { countOutbox, hasOtherPendingOps, peekOutbox, setInFlightSeq } from "./outbox";
import { getOfflineSession, isBrowserOnline } from "./session";
import { notifySyncApplied, updateSyncState } from "./sync-status";

const WINDOW_DAYS_BEFORE = 7;
const WINDOW_DAYS_AFTER = 30;
const MAX_ISSUES = 20;
const ISSUES_META_KEY = "issues";

type OpOutcome = "done" | "stop";

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getSyncWindow(now = new Date()): { from: string; to: string } {
  const from = new Date(now);
  from.setDate(from.getDate() - WINDOW_DAYS_BEFORE);
  const to = new Date(now);
  to.setDate(to.getDate() + WINDOW_DAYS_AFTER);
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

async function recordIssue(db: JotlyOfflineDb, issue: Omit<SyncIssue, "at">): Promise<void> {
  const issues = await readMeta<SyncIssue[]>(db, ISSUES_META_KEY, []);
  const next = [...issues, { ...issue, at: Date.now() }].slice(-MAX_ISSUES);
  await writeMeta(db, ISSUES_META_KEY, next);
  updateSyncState({ issues: next });
}

export async function loadSyncIssues(db: JotlyOfflineDb): Promise<SyncIssue[]> {
  return readMeta<SyncIssue[]>(db, ISSUES_META_KEY, []);
}

export async function dismissSyncIssues(): Promise<void> {
  const session = getOfflineSession();
  if (session) {
    await writeMeta(session.db, ISSUES_META_KEY, []);
  }
  updateSyncState({ issues: [] });
}

/** Store the server copy, unless later local edits are still waiting (keep them, refresh the version only). */
async function storeServerTask(db: JotlyOfflineDb, entry: OutboxEntry, serverTask: Task): Promise<void> {
  if (await hasOtherPendingOps(db, entry.entityId, entry.seq ?? -1)) {
    const local = await db.tasks.get(entry.entityId);
    await db.tasks.put(
      local ? { ...local, updatedAt: serverTask.updatedAt, createdAt: serverTask.createdAt } : serverTask
    );
    return;
  }
  await db.tasks.put(serverTask);
}

async function sendUpdate(db: JotlyOfflineDb, entry: OutboxEntry & { kind: "task.update" }, token: string) {
  try {
    const task = await patchTask(entry.entityId, entry.payload, token, { baseUpdatedAt: entry.baseUpdatedAt });
    await storeServerTask(db, entry, task);
  } catch (error) {
    if (!(error instanceof TaskApiError) || error.status !== 409 || !error.data) {
      throw error;
    }
    // Conflict: the most recent change wins.
    const serverTask = error.data as Task;
    const serverEditedAt = serverTask.updatedAt ? Date.parse(serverTask.updatedAt) : 0;
    if (entry.editedAt > serverEditedAt) {
      const task = await patchTask(entry.entityId, entry.payload, token);
      await storeServerTask(db, entry, task);
      await recordIssue(db, {
        kind: "conflict",
        entityId: entry.entityId,
        opKind: entry.kind,
        message: `"${task.title}": changed elsewhere too — your offline change was more recent and was kept.`,
      });
    } else {
      await storeServerTask(db, entry, serverTask);
      await recordIssue(db, {
        kind: "conflict",
        entityId: entry.entityId,
        opKind: entry.kind,
        message: `"${serverTask.title}": changed elsewhere more recently — the other version was kept.`,
      });
    }
  }
}

async function sendEntry(db: JotlyOfflineDb, entry: OutboxEntry, token: string): Promise<void> {
  switch (entry.kind) {
    case "task.create": {
      const task = await postTask({ ...entry.payload, id: entry.entityId }, token);
      await storeServerTask(db, entry, task);
      return;
    }
    case "task.update":
      await sendUpdate(db, entry, token);
      return;
    case "task.delete":
      try {
        await deleteTask(entry.entityId, token);
      } catch (error) {
        if (!(error instanceof TaskApiError && error.status === 404)) throw error;
      }
      return;
    case "timeEntry.put":
      await putTaskTimeEntry(entry.entityId, entry.payload, token);
      return;
  }
}

function isRetryable(error: unknown): boolean {
  if (isOfflineError(error)) return true;
  if (error instanceof TaskApiError) {
    return error.status >= 500 || error.status === 429 || error.status === 401 || error.status === 408;
  }
  return true;
}

async function processEntry(db: JotlyOfflineDb, entry: OutboxEntry, token: string): Promise<OpOutcome> {
  setInFlightSeq(entry.seq ?? null);
  try {
    await sendEntry(db, entry, token);
  } catch (error) {
    if (isRetryable(error)) {
      await db.outbox.update(entry.seq as number, { attempts: entry.attempts + 1 });
      return "stop";
    }
    // Rejected by the server (validation, not found...): set it aside so the rest can sync.
    const local = await db.tasks.get(entry.entityId);
    if (entry.kind === "task.create" || (error instanceof TaskApiError && error.status === 404)) {
      await db.tasks.delete(entry.entityId);
    }
    await recordIssue(db, {
      kind: "rejected",
      entityId: entry.entityId,
      opKind: entry.kind,
      message: `${local ? `"${local.title}": ` : ""}${error instanceof Error ? error.message : "change rejected"}`,
    });
  } finally {
    setInFlightSeq(null);
  }
  await db.outbox.delete(entry.seq as number);
  return "done";
}

/** Download the date window and replace the local copy (pending local edits are preserved). */
export async function pullWindow(db: JotlyOfflineDb, token: string, now = new Date()): Promise<void> {
  const { from, to } = getSyncWindow(now);
  const tasks = await fetchAllTasks(token, { dateFrom: from, dateTo: to });
  await replaceTasksInRange(db, from, to, tasks);
}

let running: Promise<void> | null = null;

/** Push pending changes then pull fresh data. Concurrent calls share the same run. */
export function syncNow(options: { pull?: boolean } = {}): Promise<void> {
  if (!running) {
    running = runSync(options.pull ?? true).finally(() => {
      running = null;
    });
  }
  return running;
}

async function runSync(pull: boolean): Promise<void> {
  const session = getOfflineSession();
  if (!session || !isBrowserOnline()) {
    return;
  }
  const { db, token } = session;
  updateSyncState({ isSyncing: true, pendingCount: await countOutbox(db) });
  let pushed = 0;
  let blocked = false;
  try {
    for (let entry = await peekOutbox(db); entry; entry = await peekOutbox(db)) {
      if ((await processEntry(db, entry, token)) === "stop") {
        blocked = true;
        break;
      }
      pushed += 1;
      updateSyncState({ pendingCount: await countOutbox(db) });
    }
    if (!blocked && pull) {
      await pullWindow(db, token);
    }
    if (!blocked) {
      updateSyncState({ lastSyncedAt: Date.now() });
    }
  } catch {
    // Pull failed (offline again): keep local data, retry on the next trigger.
  } finally {
    if (getOfflineSession() === session) {
      updateSyncState({ isSyncing: false, pendingCount: await countOutbox(db) });
    }
  }
  // Screens only need to reload when local changes were reconciled with the server.
  if (pushed > 0) {
    notifySyncApplied();
  }
}
