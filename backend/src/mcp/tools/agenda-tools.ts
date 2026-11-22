import type { CalendarEvent } from "@prisma/client";
import { z } from "zod";
import { normalizePlainText } from "../../assistant/assistant-search-sync";
import { addUtcDays } from "../../tasks/task-route-helpers";
import { parseDateOnly } from "../../tasks/task-store";
import { formatDateOnly, formatLocalDateTime } from "../mcp-dates";
import { McpTool } from "./tool-definition";
import { McpMemoryStores, McpToolError, requireMemory, truncate } from "./tool-kit";

const MAX_RANGE_DAYS = 62;

/** One calendar event, times in the user's time zone. All-day events carry dates only. */
function describeEvent(event: CalendarEvent, noteText: string, timeZone: string) {
  const allDay = event.isAllDay && event.startDate && event.endDate;
  return {
    id: event.id,
    titre: event.title,
    ...(allDay
      ? {
          toute_la_journee: true,
          du: formatDateOnly(event.startDate as Date),
          // Google all-day end dates are exclusive.
          au: formatDateOnly(addUtcDays(event.endDate as Date, -1)),
        }
      : {
          toute_la_journee: false,
          debut: formatLocalDateTime(event.startTime, timeZone),
          fin: formatLocalDateTime(event.endTime, timeZone),
        }),
    lieu: event.location,
    participants: event.attendees,
    a_une_note: noteText.length > 0,
    extrait_note: truncate(noteText, 500),
  };
}

async function withNotes(memory: McpMemoryStores, events: CalendarEvent[], userId: string, timeZone: string) {
  const visible = events.filter((event) => event.status !== "cancelled");
  const ids = visible.map((event) => event.id);
  const [notes, legacyNotes] = await Promise.all([
    memory.noteStore.listByCalendarEventIds(ids, userId),
    memory.calendarEventNoteStore?.listByCalendarEventIds(ids, userId) ?? [],
  ]);
  return visible.map((event) =>
    describeEvent(
      event,
      normalizePlainText(
        notes.find((note) => note.calendarEventId === event.id)?.body,
        legacyNotes.find((note) => note.calendarEventId === event.id)?.body
      ),
      timeZone
    )
  );
}

/**
 * Events of one day, with the same query as Jotly's day view. Null when the
 * agenda is not available (no calendar store), so lire_journee still works.
 */
export async function agendaForDay(memory: McpMemoryStores | undefined, day: Date, userId: string, timeZone: string) {
  if (!memory?.calendarEventStore) return null;
  const events = await memory.calendarEventStore.listByDate(day, userId, timeZone);
  return withNotes(memory, events, userId, timeZone);
}

function parseDay(value: string, label: string): Date {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new McpToolError(`${label} invalide « ${value} » : format AAAA-MM-JJ.`);
  return parsed;
}

const lireAgendaShape = {
  du: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Premier jour (AAAA-MM-JJ)."),
  au: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(`Dernier jour INCLUS (AAAA-MM-JJ), ${MAX_RANGE_DAYS} jours au plus après le premier. Par défaut : le même jour.`),
};

export const lireAgenda: McpTool<typeof lireAgendaShape> = {
  name: "lire_agenda",
  title: "Lire l'agenda",
  description:
    "Agenda de Godwin synchronisé dans Jotly (Google Agenda) : événements, rendez-vous et réunions d'un jour ou d'une période, avec heures locales, lieu, participants et extrait des notes. À utiliser pour « mes événements », « mon agenda », « mes rendez-vous de demain », ou pour planifier les tâches entre les rendez-vous. Pour aujourd'hui, lire_journee contient déjà l'agenda.",
  inputSchema: lireAgendaShape,
  write: false,
  async handler({ du, au }, ctx, stores) {
    const memory = requireMemory(stores);
    if (!memory.calendarEventStore) throw new McpToolError("L'agenda n'est pas connecté à Jotly.");
    const start = parseDay(du, "Date de début");
    const end = au ? parseDay(au, "Date de fin") : start;
    if (end < start || end > addUtcDays(start, MAX_RANGE_DAYS)) {
      throw new McpToolError(`Période invalide : la fin doit suivre le début, sur ${MAX_RANGE_DAYS} jours au plus.`);
    }

    // Jotly's range query excludes its end date: pass the day after the last day asked for.
    const events = await memory.calendarEventStore.listByDateRange(start, addUtcDays(end, 1), ctx.userId, ctx.timeZone);
    const evenements = await withNotes(memory, events, ctx.userId, ctx.timeZone);
    return { du: formatDateOnly(start), au: formatDateOnly(end), nombre: evenements.length, evenements };
  },
};
