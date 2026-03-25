import assert from "node:assert/strict";
import test from "node:test";
import { createAssistantContextSearchPlugin } from "../assistant/assistant-context-search-plugin";
import { createNoteSearchPlugin } from "../notes/note-search-plugin";
import { createTaskSearchPlugin } from "../tasks/task-search-plugin";

test("task search metadata includes the task target date for comments and attachments", async () => {
  const targetDate = new Date("2026-03-19T00:00:00.000Z");
  const task = {
    id: "task-1",
    userId: "user-1",
    rolledFromTaskId: null,
    title: "Deep work",
    description: "Focus block",
    status: "todo",
    targetDate,
    dueDate: null,
    priority: "medium",
    project: null,
    assignees: null,
    plannedTime: null,
    recurrenceSourceTaskId: null,
    recurrenceOccurrenceDate: null,
    calendarEventId: null,
    createdAt: new Date("2026-03-18T09:00:00.000Z"),
    updatedAt: new Date("2026-03-18T09:00:00.000Z"),
    completedAt: null,
    cancelledAt: null,
  };
  const comment = {
    id: "comment-1",
    taskId: task.id,
    body: "Need to finish this before lunch",
    createdAt: new Date("2026-03-18T09:15:00.000Z"),
    updatedAt: new Date("2026-03-18T09:15:00.000Z"),
  };
  const attachment = {
    id: "attachment-1",
    taskId: task.id,
    name: "brief.pdf",
    url: "data:application/pdf;base64,AA==",
    contentType: "application/pdf",
    sizeBytes: 2,
    createdAt: new Date("2026-03-18T09:20:00.000Z"),
  };

  const plugin = createTaskSearchPlugin({
    taskStore: {
      async listByUser() {
        return [task];
      },
    },
    commentStore: {
      async listByTaskId() {
        return [comment];
      },
    },
    attachmentStore: {
      async listByTaskId() {
        return [attachment];
      },
    },
  } as never);

  const entries = await plugin.fetchEntries("user-1");
  const commentEntry = entries.find((entry) => entry.sourceType === "comment");
  const attachmentEntry = entries.find((entry) => entry.sourceType === "attachment");

  assert.equal(commentEntry?.metadata.targetDate, "2026-03-19");
  assert.equal(attachmentEntry?.metadata.targetDate, "2026-03-19");
});

test("assistant context search metadata includes event start time for calendar notes", async () => {
  const plugin = createAssistantContextSearchPlugin({
    async getByUserId() {
      return {
        profile: null,
        dayAffirmations: [],
        dayBilans: [],
        reminders: [],
        calendarEvents: [
          {
            id: "event-1",
            userId: "user-1",
            connectionId: "connection-1",
            externalEventId: "external-1",
            title: "Design review",
            description: null,
            location: null,
            organizer: null,
            attendees: null,
            startTime: new Date("2026-03-22T14:00:00.000Z"),
            endTime: new Date("2026-03-22T15:00:00.000Z"),
            isAllDay: false,
            status: "confirmed",
            htmlLink: null,
            colorId: null,
            createdAt: new Date("2026-03-18T09:00:00.000Z"),
            updatedAt: new Date("2026-03-18T09:00:00.000Z"),
          },
        ],
        calendarEventNotes: [
          {
            id: "note-1",
            userId: "user-1",
            calendarEventId: "event-1",
            body: "Bring the final deck",
            createdAt: new Date("2026-03-18T09:05:00.000Z"),
            updatedAt: new Date("2026-03-18T09:05:00.000Z"),
          },
        ],
      };
    },
  } as never);

  const entries = await plugin.fetchEntries("user-1");
  const calendarNoteEntry = entries.find((entry) => entry.sourceType === "calendarNote");

  assert.equal(calendarNoteEntry?.metadata.startTime, "2026-03-22T14:00:00.000Z");
});

test("note search metadata includes note target date for note attachments", async () => {
  const plugin = createNoteSearchPlugin({
    noteStore: {
      async listByUser() {
        return [
          {
            id: "note-1",
            userId: "user-1",
            title: "Trip checklist",
            body: "Passport, charger, tickets",
            color: null,
            targetDate: new Date("2026-03-25T00:00:00.000Z"),
            createdAt: new Date("2026-03-18T09:00:00.000Z"),
            updatedAt: new Date("2026-03-18T09:00:00.000Z"),
          },
        ];
      },
    },
    noteAttachmentStore: {
      async listByNoteId() {
        return [
          {
            id: "note-attachment-1",
            noteId: "note-1",
            userId: "user-1",
            name: "tickets.pdf",
            url: "data:application/pdf;base64,AA==",
            contentType: "application/pdf",
            sizeBytes: 2,
            createdAt: new Date("2026-03-18T09:10:00.000Z"),
          },
        ];
      },
    },
  } as never);

  const entries = await plugin.fetchEntries("user-1");
  const attachmentEntry = entries.find((entry) => entry.sourceType === "noteAttachment");

  assert.equal(attachmentEntry?.metadata.targetDate, "2026-03-25");
});
