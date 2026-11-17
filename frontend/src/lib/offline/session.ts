/**
 * The signed-in account the offline layer works for. Without a session the
 * repository falls back to plain network calls (behaviour before offline mode).
 */
import { openOfflineDb, type JotlyOfflineDb } from "./db";

export type OfflineSession = { userId: string; token: string; db: JotlyOfflineDb };

let session: OfflineSession | null = null;

export function getOfflineSession(): OfflineSession | null {
  return session;
}

export function setOfflineSession(userId: string, token: string, dbFactory = openOfflineDb): OfflineSession {
  if (session && session.userId === userId) {
    session = { ...session, token };
    return session;
  }
  session?.db.close();
  session = { userId, token, db: dbFactory(userId) };
  return session;
}

export function clearOfflineSessionState(): void {
  session?.db.close();
  session = null;
}

export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function createClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
