import type { DayAffirmationStore } from "../../day-affirmation/day-affirmation-store";
import type { DayBilanStore } from "../../day-bilan/day-bilan-store";
import type { MonthlyEntryStore } from "../../monthly-entry/monthly-entry-store";
import type { ProjectStore } from "../../projects/project-store";
import type { RecurrenceStore } from "../../recurrence/recurrence-store";
import type { ReminderStore } from "../../reminders/reminder-store";
import type { TaskStore } from "../../tasks/task-store";
import type { WeeklyEntryStore } from "../../weekly-entry/weekly-entry-store";
import type { AttachmentStore } from "../../attachments/attachment-store";
import type { AssistantEmbeddingClient } from "../../assistant/assistant-embedding-client";
import type { AssistantSearchDocumentStore } from "../../assistant/assistant-search-document-store";
import type { CommentStore } from "../../comments/comment-store";
import type { CalendarEventNoteStore } from "../../google-calendar/calendar-event-note-store";
import type { CalendarEventStore } from "../../google-calendar/calendar-event-store";
import type { NoteAttachmentStore } from "../../notes/note-attachment-store";
import type { NoteStore } from "../../notes/note-store";
import type { ActionChange } from "../actions/snapshots";
import { MCP_SCOPE } from "../mcp-config";

/** Error whose message is shown to the LLM (French, actionable). Other errors are masked. */
export class McpToolError extends Error {}

export type McpDomainStores = {
  taskStore: TaskStore;
  reminderStore: ReminderStore;
  dayAffirmationStore: DayAffirmationStore;
  dayBilanStore: DayBilanStore;
  projectStore: ProjectStore;
  weeklyEntryStore: WeeklyEntryStore;
  monthlyEntryStore: MonthlyEntryStore;
  recurrenceStore?: RecurrenceStore;
  /** Read-only access to notes, meetings and the search index (phase 3). */
  memory?: McpMemoryStores;
};

export type McpMemoryStores = {
  searchDocumentStore: AssistantSearchDocumentStore;
  embeddingClient?: AssistantEmbeddingClient;
  noteStore: NoteStore;
  noteAttachmentStore?: NoteAttachmentStore;
  calendarEventStore?: CalendarEventStore;
  calendarEventNoteStore?: CalendarEventNoteStore;
  commentStore?: CommentStore;
  attachmentStore?: AttachmentStore;
};

export function requireMemory(stores: McpDomainStores): McpMemoryStores {
  if (!stores.memory) throw new McpToolError("La recherche dans les notes n'est pas disponible sur ce serveur.");
  return stores.memory;
}

/** Per-call context: who is calling and as which Jotly user. */
export type ToolContext = {
  userId: string;
  timeZone: string;
  now: () => Date;
  /** Records the entities a write changed (for undo); returns the action_id to put in the proof. */
  recordAction(changes: ActionChange[]): Promise<string>;
};

// ChatGPT only forwards the OAuth token to tools that declare they need it.
export const OAUTH_META = { securitySchemes: [{ type: "oauth2", scopes: [MCP_SCOPE] }] };

export const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
export const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export type Proof = {
  type: "tache" | "taches" | "rappel" | "affirmation" | "bilan" | "report" | "objectifs" | "annulation";
  action: string;
  id: string;
  date: string;
  horodatage: string;
  /** Pass to `annuler` to undo this write. */
  action_id?: string;
};

/** Every write returns a proof the LLM must show (id + date) — no proof, no action. */
export function proof(
  type: Proof["type"],
  action: string,
  id: string,
  date: string,
  at: Date,
  actionId?: string
): { preuve: Proof } {
  return {
    preuve: { type, action, id, date, horodatage: at.toISOString(), ...(actionId ? { action_id: actionId } : {}) },
  };
}

export function truncate(value: string | null | undefined, max = 500): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
