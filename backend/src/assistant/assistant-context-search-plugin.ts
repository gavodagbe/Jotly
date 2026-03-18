import { formatDateOnly } from "../tasks/task-store";
import { AssistantContextStore } from "./assistant-context-store";
import { SearchIndexEntry, SearchIndexPlugin, normalizePlainText } from "./assistant-search-sync";

export function createAssistantContextSearchPlugin(
  contextStore: AssistantContextStore
): SearchIndexPlugin {
  return {
    async fetchEntries(userId) {
      const entries: SearchIndexEntry[] = [];
      const snapshot = await contextStore.getByUserId(userId);
      const eventTitlesById = new Map(
        snapshot.calendarEvents.map((event) => [event.id, event.title])
      );
      const eventStartTimesById = new Map(
        snapshot.calendarEvents.map((event) => [event.id, event.startTime.toISOString()])
      );

      for (const affirmation of snapshot.dayAffirmations) {
        entries.push({
          sourceType: "affirmation",
          sourceId: affirmation.id,
          title: `Affirmation ${formatDateOnly(affirmation.targetDate)}`,
          bodyText: normalizePlainText(affirmation.text),
          metadata: {
            targetDate: formatDateOnly(affirmation.targetDate),
            isCompleted: affirmation.isCompleted,
          },
          updatedAt: affirmation.updatedAt,
        });
      }

      for (const bilan of snapshot.dayBilans) {
        entries.push({
          sourceType: "bilan",
          sourceId: bilan.id,
          title: `Bilan ${formatDateOnly(bilan.targetDate)}`,
          bodyText: normalizePlainText(
            bilan.wins,
            bilan.blockers,
            bilan.lessonsLearned,
            bilan.tomorrowTop3
          ),
          metadata: {
            targetDate: formatDateOnly(bilan.targetDate),
            mood: bilan.mood,
          },
          updatedAt: bilan.updatedAt,
        });
      }

      for (const reminder of snapshot.reminders) {
        entries.push({
          sourceType: "reminder",
          sourceId: reminder.id,
          title: reminder.title,
          bodyText: normalizePlainText(
            reminder.description,
            reminder.project,
            reminder.assignees
          ),
          metadata: {
            remindAt: reminder.remindAt.toISOString(),
            isDismissed: reminder.isDismissed,
            isFired: reminder.isFired,
          },
          updatedAt: reminder.updatedAt,
        });
      }

      for (const event of snapshot.calendarEvents) {
        entries.push({
          sourceType: "calendarEvent",
          sourceId: event.id,
          title: event.title,
          bodyText: normalizePlainText(
            event.description,
            event.location,
            event.organizer,
            event.attendees
          ),
          metadata: {
            startTime: event.startTime.toISOString(),
            endTime: event.endTime.toISOString(),
            isAllDay: event.isAllDay,
          },
          updatedAt: event.updatedAt,
        });
      }

      for (const note of snapshot.calendarEventNotes) {
        entries.push({
          sourceType: "calendarNote",
          sourceId: note.id,
          title: `Calendar note for ${eventTitlesById.get(note.calendarEventId) ?? note.calendarEventId}`,
          bodyText: normalizePlainText(note.body),
          metadata: {
            calendarEventId: note.calendarEventId,
            calendarEventTitle: eventTitlesById.get(note.calendarEventId) ?? null,
            startTime: eventStartTimesById.get(note.calendarEventId) ?? null,
          },
          updatedAt: note.updatedAt,
        });
      }

      return entries;
    },
  };
}
