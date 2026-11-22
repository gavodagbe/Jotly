import type { DayAffirmationStore } from "../../day-affirmation/day-affirmation-store";
import type { DayBilanStore } from "../../day-bilan/day-bilan-store";
import type { MonthlyEntryStore } from "../../monthly-entry/monthly-entry-store";
import type { ProjectStore } from "../../projects/project-store";
import type { RecurrenceStore } from "../../recurrence/recurrence-store";
import type { ReminderStore } from "../../reminders/reminder-store";
import type { TaskStore } from "../../tasks/task-store";
import type { WeeklyEntryStore } from "../../weekly-entry/weekly-entry-store";
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
};

/** Per-call context: who is calling and as which Jotly user. */
export type ToolContext = {
  userId: string;
  timeZone: string;
  now: () => Date;
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
  type: "tache" | "rappel" | "affirmation" | "report" | "objectifs";
  action: string;
  id: string;
  date: string;
  horodatage: string;
};

/** Every write returns a proof the LLM must show (id + date) — no proof, no action. */
export function proof(type: Proof["type"], action: string, id: string, date: string, at: Date): { preuve: Proof } {
  return { preuve: { type, action, id, date, horodatage: at.toISOString() } };
}

export function truncate(value: string | null | undefined, max = 500): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
