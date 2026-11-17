/** In-memory NoteStore for route tests (mirrors the Prisma store, incl. client-provided ids). */
import { CalendarEvent } from "@prisma/client";
import { NoteCreateInput, NoteStore, StoredNote } from "./note-store";

export class InMemoryNoteStore implements NoteStore {
  private readonly notes = new Map<string, StoredNote>();
  private idCounter = 1;

  constructor(private readonly eventsById = new Map<string, CalendarEvent>()) {}

  private hydrateCalendarEvent(calendarEventId: string | null | undefined) {
    if (!calendarEventId) {
      return null;
    }

    const event = this.eventsById.get(calendarEventId);
    if (!event) {
      return null;
    }

    return {
      id: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      htmlLink: event.htmlLink,
    };
  }

  async listByUser(userId: string): Promise<StoredNote[]> {
    return [...this.notes.values()].filter((note) => note.userId === userId);
  }

  async listByCalendarEventIds(calendarEventIds: string[], userId: string): Promise<StoredNote[]> {
    return [...this.notes.values()].filter(
      (note) =>
        note.userId === userId &&
        typeof note.calendarEventId === "string" &&
        calendarEventIds.includes(note.calendarEventId)
    );
  }

  async getById(id: string, userId: string): Promise<StoredNote | null> {
    const note = this.notes.get(id) ?? null;
    return note && note.userId === userId ? note : null;
  }

  async getByCalendarEventId(calendarEventId: string, userId: string): Promise<StoredNote | null> {
    return (
      [...this.notes.values()].find(
        (note) => note.userId === userId && note.calendarEventId === calendarEventId
      ) ?? null
    );
  }

  async create(input: NoteCreateInput): Promise<StoredNote> {
    if (input.id && this.notes.has(input.id)) {
      throw { code: "P2002" };
    }
    if (input.calendarEventId) {
      const existing = [...this.notes.values()].find(
        (note) => note.calendarEventId === input.calendarEventId
      );
      if (existing) {
        throw { code: "P2002" };
      }
    }

    const now = new Date();
    const note: StoredNote = {
      id: input.id ?? `note-${this.idCounter++}`,
      userId: input.userId,
      calendarEventId: input.calendarEventId ?? null,
      title: input.title ?? null,
      body: input.body,
      color: input.color ?? null,
      targetDate: input.targetDate ?? null,
      createdAt: now,
      updatedAt: now,
      calendarEvent: this.hydrateCalendarEvent(input.calendarEventId),
    };
    this.notes.set(note.id, note);
    return note;
  }

  async update(
    id: string,
    input: {
      title?: string | null;
      body?: string;
      color?: string | null;
      targetDate?: Date | null;
      calendarEventId?: string | null;
    },
    userId: string
  ): Promise<StoredNote | null> {
    const existing = this.notes.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    if (input.calendarEventId) {
      const conflict = [...this.notes.values()].find(
        (note) => note.id !== id && note.calendarEventId === input.calendarEventId
      );
      if (conflict) {
        throw { code: "P2002" };
      }
    }

    const updated: StoredNote = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
      ...(input.calendarEventId !== undefined ? { calendarEventId: input.calendarEventId } : {}),
      updatedAt: new Date(),
      calendarEvent: this.hydrateCalendarEvent(
        input.calendarEventId !== undefined ? input.calendarEventId : existing.calendarEventId
      ),
    };
    this.notes.set(id, updated);
    return updated;
  }

  async remove(id: string, userId: string): Promise<StoredNote | null> {
    const existing = this.notes.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }
    this.notes.delete(id);
    return existing;
  }
}
