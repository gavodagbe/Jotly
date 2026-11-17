/** Shared schemas and helpers for reminder routes (split out of src/routes/reminders.ts). */
import { z } from "zod";
import { parseDateOnly } from "../tasks/task-store";
import { baseUpdatedAtSchema, clientIdSchema } from "../routes/offline-sync-helpers";

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_URL_LENGTH = 7_100_000;
export const dateQuerySchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, {
    message: "date must be a valid date in YYYY-MM-DD format",
  });

export const createReminderBodySchema = z.object({
  id: clientIdSchema.optional(),
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().max(2000, "Description is too long").optional().nullable(),
  project: z.string().max(200, "Project is too long").optional().nullable(),
  projectId: z.string().trim().min(1, "projectId must not be empty").optional().nullable(),
  assignees: z.string().max(500, "Assignees is too long").optional().nullable(),
  remindAt: z.string().refine(
    (value) => !isNaN(Date.parse(value)),
    { message: "remindAt must be a valid ISO 8601 date-time" }
  ),
});

export const updateReminderBodySchema = z.object({
  baseUpdatedAt: baseUpdatedAtSchema.optional(),
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long").optional(),
  description: z.string().max(2000, "Description is too long").optional().nullable(),
  project: z.string().max(200, "Project is too long").optional().nullable(),
  projectId: z.string().trim().min(1, "projectId must not be empty").optional().nullable(),
  assignees: z.string().max(500, "Assignees is too long").optional().nullable(),
  remindAt: z
    .string()
    .refine((value) => !isNaN(Date.parse(value)), {
      message: "remindAt must be a valid ISO 8601 date-time",
    })
    .optional(),
});

export function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
}

export function serializeReminder(reminder: {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
  subProject: string | null;
  projectId: string | null;
  assignees: string | null;
  remindAt: Date;
  status: string;
  isFired: boolean;
  firedAt: Date | null;
  isDismissed: boolean;
  dismissedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: reminder.id,
    title: reminder.title,
    description: reminder.description,
    project: reminder.project,
    subProject: reminder.subProject,
    projectId: reminder.projectId,
    assignees: reminder.assignees,
    remindAt: reminder.remindAt.toISOString(),
    status: reminder.status,
    isFired: reminder.isFired,
    firedAt: reminder.firedAt?.toISOString() ?? null,
    isDismissed: reminder.isDismissed,
    dismissedAt: reminder.dismissedAt?.toISOString() ?? null,
    completedAt: reminder.completedAt?.toISOString() ?? null,
    cancelledAt: reminder.cancelledAt?.toISOString() ?? null,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
  };
}

export const createAttachmentBodySchema = z.object({
  name: z.string().trim().min(1, "Attachment name is required").max(200, "Attachment name is too long"),
  url: z
    .string()
    .trim()
    .min(1, "Attachment URL must be valid")
    .max(MAX_ATTACHMENT_URL_LENGTH, "Attachment payload is too large")
    .url("Attachment URL must be valid"),
  contentType: z.string().trim().max(255, "contentType is too long").optional().nullable(),
  sizeBytes: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_ATTACHMENT_SIZE_BYTES, "Attachment exceeds 5 MB limit")
    .optional()
    .nullable(),
});

export function serializeAttachment(a: {
  id: string;
  reminderId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    reminderId: a.reminderId,
    name: a.name,
    url: a.url,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt.toISOString(),
  };
}
