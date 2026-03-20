-- Add optional durable link from Note to CalendarEvent
ALTER TABLE "Note"
ADD COLUMN "calendarEventId" TEXT;

-- Backfill existing calendar event notes into durable Note rows
INSERT INTO "Note" (
  "id",
  "userId",
  "calendarEventId",
  "title",
  "body",
  "color",
  "targetDate",
  "createdAt",
  "updatedAt"
)
SELECT
  legacy_note."id",
  legacy_note."userId",
  legacy_note."calendarEventId",
  NULL,
  legacy_note."body",
  NULL,
  COALESCE(calendar_event."startDate", DATE(calendar_event."startTime")),
  legacy_note."createdAt",
  legacy_note."updatedAt"
FROM "CalendarEventNote" AS legacy_note
INNER JOIN "CalendarEvent" AS calendar_event
  ON calendar_event."id" = legacy_note."calendarEventId"
WHERE NOT EXISTS (
  SELECT 1
  FROM "Note" AS note
  WHERE note."calendarEventId" = legacy_note."calendarEventId"
);

-- Backfill existing calendar event note attachments onto the unified note attachment model
INSERT INTO "NoteAttachment" (
  "id",
  "noteId",
  "userId",
  "name",
  "url",
  "contentType",
  "sizeBytes",
  "createdAt"
)
SELECT
  legacy_attachment."id",
  legacy_attachment."calendarEventNoteId",
  legacy_attachment."userId",
  legacy_attachment."name",
  legacy_attachment."url",
  legacy_attachment."contentType",
  legacy_attachment."sizeBytes",
  legacy_attachment."createdAt"
FROM "CalendarEventNoteAttachment" AS legacy_attachment
INNER JOIN "Note" AS note
  ON note."id" = legacy_attachment."calendarEventNoteId"
WHERE NOT EXISTS (
  SELECT 1
  FROM "NoteAttachment" AS attachment
  WHERE attachment."id" = legacy_attachment."id"
);

-- Enforce one durable note per calendar event
CREATE UNIQUE INDEX "Note_calendarEventId_key" ON "Note"("calendarEventId");

CREATE INDEX "Note_userId_calendarEventId_idx" ON "Note"("userId", "calendarEventId");

ALTER TABLE "Note"
ADD CONSTRAINT "Note_calendarEventId_fkey"
FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
