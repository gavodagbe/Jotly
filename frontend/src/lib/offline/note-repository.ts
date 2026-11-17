/**
 * Note data access used by the app (same signatures as the former functions in
 * app-shell.tsx), offline-aware like task-repository.ts. Text only: attachments
 * stay online-only.
 */
import { OfflineError } from "../api/http";
import { deleteNote, fetchNotes, patchNote, postNote } from "../api/notes-api";
import type { Note, NoteInput, NotePatch } from "../api/note-types";
import { isNoteOnDate } from "./entity-sync";
import { replaceMatching } from "./local-store";
import { queueLocally, refreshFromServer, writeThrough } from "./repository-helpers";
import { createClientId, getOfflineSession } from "./session";

const OFFLINE_EDIT_UNAVAILABLE = "This note is not available offline. Reconnect to edit it.";

function newestFirst(notes: Note[]): Note[] {
  return [...notes].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function loadNotes(token: string, date?: string, signal?: AbortSignal): Promise<Note[]> {
  const session = getOfflineSession();
  if (!session) {
    return fetchNotes(token, date, signal);
  }
  const inScope = (note: Note) => (date ? isNoteOnDate(note, date) : true);
  await refreshFromServer(async () => {
    const serverNotes = await fetchNotes(token, date, signal);
    await replaceMatching(session.db, session.db.notes, inScope, serverNotes);
  });
  return newestFirst((await session.db.notes.toArray()).filter(inScope));
}

function buildLocalNote(id: string, input: NoteInput): Note {
  const now = new Date().toISOString();
  return {
    id,
    title: input.title ?? null,
    body: input.body,
    color: input.color ?? null,
    targetDate: input.targetDate ?? null,
    calendarEventId: input.calendarEventId ?? null,
    linkedCalendarEvent: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createNoteApi(input: NoteInput, token: string): Promise<Note> {
  const session = getOfflineSession();
  if (!session) {
    return postNote(input, token);
  }
  const id = createClientId();
  return writeThrough(
    session,
    async () => {
      const note = await postNote({ ...input, id }, token);
      await session.db.notes.put(note);
      return note;
    },
    async () => {
      const local = buildLocalNote(id, input);
      await session.db.notes.put(local);
      await queueLocally(session, { kind: "note.create", entityId: id, payload: input });
      return local;
    }
  );
}

export async function updateNoteApi(id: string, patch: NotePatch, token: string): Promise<Note> {
  const session = getOfflineSession();
  if (!session) {
    return patchNote(id, patch, token);
  }
  return writeThrough(
    session,
    async () => {
      const note = await patchNote(id, patch, token);
      await session.db.notes.put(note);
      return note;
    },
    async () => {
      const local = await session.db.notes.get(id);
      if (!local) throw new OfflineError(OFFLINE_EDIT_UNAVAILABLE);
      // Keep the server version stamp: it is the base the queued change applies to.
      const updated: Note = { ...local, ...patch, body: patch.body ?? local.body };
      await session.db.notes.put(updated);
      await queueLocally(session, { kind: "note.update", entityId: id, payload: patch, baseUpdatedAt: local.updatedAt });
      return updated;
    }
  );
}

export async function deleteNoteApi(id: string, token: string): Promise<void> {
  const session = getOfflineSession();
  if (!session) {
    return deleteNote(id, token);
  }
  return writeThrough(
    session,
    async () => {
      await deleteNote(id, token);
      await session.db.notes.delete(id);
    },
    async () => {
      await session.db.notes.delete(id);
      await queueLocally(session, { kind: "note.delete", entityId: id });
    }
  );
}
