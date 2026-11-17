import { readMeta, writeMeta, type JotlyOfflineDb, type SyncIssue } from "./db";
import { getOfflineSession } from "./session";
import { updateSyncState } from "./sync-status";

const MAX_ISSUES = 20;
const ISSUES_META_KEY = "issues";

export async function recordIssue(db: JotlyOfflineDb, issue: Omit<SyncIssue, "at">): Promise<void> {
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
