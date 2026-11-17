/** Raw network calls for notes (moved out of app-shell.tsx). */
import { apiRequest, requireData, withBase } from "./http";
import type { Note, NoteInput, NotePatch } from "./note-types";

export async function fetchNotes(token: string, date?: string, signal?: AbortSignal): Promise<Note[]> {
  const path = date ? `/notes?date=${encodeURIComponent(date)}` : "/notes";
  const data = await apiRequest<Note[]>(path, { method: "GET", token, signal }, "Unable to load notes");
  return data ?? [];
}

export async function postNote(input: NoteInput & { id?: string }, token: string): Promise<Note> {
  const data = await apiRequest<Note>("/notes", { method: "POST", token, body: input }, "Unable to create note");
  return requireData(data, "Unable to create note");
}

export async function patchNote(id: string, patch: NotePatch, token: string, baseUpdatedAt?: string): Promise<Note> {
  const data = await apiRequest<Note>(
    `/notes/${encodeURIComponent(id)}`,
    { method: "PATCH", token, body: withBase(patch, baseUpdatedAt) },
    "Unable to update note"
  );
  return requireData(data, "Unable to update note");
}

export async function deleteNote(id: string, token: string): Promise<void> {
  await apiRequest<Note>(`/notes/${encodeURIComponent(id)}`, { method: "DELETE", token }, "Unable to delete note");
}
