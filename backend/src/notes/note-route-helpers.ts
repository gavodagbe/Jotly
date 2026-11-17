/** Shared schemas and helpers for note routes (split out of src/routes/notes.ts). */
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { parseDateOnly } from "../tasks/task-store";
import { baseUpdatedAtSchema, clientIdSchema } from "../routes/offline-sync-helpers";

export const NOTE_BODY_MAX = 50000;
export const NOTE_TITLE_MAX = 300;
export const NOTE_COLOR_MAX = 50;
export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_URL_LENGTH = 7_100_000;

export const dateQuerySchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, {
    message: "date must be a valid date in YYYY-MM-DD format",
  });

export const createNoteBodySchema = z.object({
  id: clientIdSchema.optional(),
  title: z.string().max(NOTE_TITLE_MAX, "Title is too long").optional().nullable(),
  body: z.string().min(1, "Body is required").max(NOTE_BODY_MAX, "Body is too long"),
  color: z.string().max(NOTE_COLOR_MAX, "Color value is too long").optional().nullable(),
  targetDate: z
    .string()
    .refine((value) => parseDateOnly(value) !== null, {
      message: "targetDate must be a valid date in YYYY-MM-DD format",
    })
    .optional()
    .nullable(),
  calendarEventId: z.string().trim().min(1, "calendarEventId must not be empty").optional().nullable(),
});

export const updateNoteBodySchema = z.object({
  baseUpdatedAt: baseUpdatedAtSchema.optional(),
  title: z.string().max(NOTE_TITLE_MAX, "Title is too long").optional().nullable(),
  body: z.string().min(1, "Body is required").max(NOTE_BODY_MAX, "Body is too long").optional(),
  color: z.string().max(NOTE_COLOR_MAX, "Color value is too long").optional().nullable(),
  targetDate: z
    .string()
    .refine((value) => parseDateOnly(value) !== null, {
      message: "targetDate must be a valid date in YYYY-MM-DD format",
    })
    .optional()
    .nullable(),
  calendarEventId: z.string().trim().min(1, "calendarEventId must not be empty").optional().nullable(),
});

export function isUniqueConstraintPrismaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    typeof error === "object" && error !== null
  ) && (error as { code?: unknown }).code === "P2002";
}

export function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
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
  noteId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    noteId: a.noteId,
    name: a.name,
    url: a.url,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt.toISOString(),
  };
}

export function serializeNote(note: {
  id: string;
  calendarEventId: string | null;
  title: string | null;
  body: string;
  color: string | null;
  targetDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  calendarEvent?: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    htmlLink: string | null;
  } | null;
}) {
  return {
    id: note.id,
    calendarEventId: note.calendarEventId,
    title: note.title,
    body: note.body,
    color: note.color,
    targetDate: note.targetDate
      ? note.targetDate.toISOString().substring(0, 10)
      : null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    linkedCalendarEvent: note.calendarEvent
      ? {
          id: note.calendarEvent.id,
          title: note.calendarEvent.title,
          startTime: note.calendarEvent.startTime.toISOString(),
          endTime: note.calendarEvent.endTime.toISOString(),
          htmlLink: note.calendarEvent.htmlLink,
        }
      : null,
  };
}
