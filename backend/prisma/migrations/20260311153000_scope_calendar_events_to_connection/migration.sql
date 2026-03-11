-- Add source connection tracking to imported calendar events
ALTER TABLE "CalendarEvent" ADD COLUMN "connectionId" TEXT;

-- Backfill rows only when a user has a single Google Calendar connection.
UPDATE "CalendarEvent" AS event
SET "connectionId" = connection."id"
FROM "GoogleCalendarConnection" AS connection
WHERE
  connection."userId" = event."userId"
  AND 1 = (
    SELECT COUNT(*)
    FROM "GoogleCalendarConnection" AS scoped_connection
    WHERE scoped_connection."userId" = event."userId"
  );

-- Events imported before connection scoping cannot be attributed safely in multi-account cases.
DELETE FROM "CalendarEvent" WHERE "connectionId" IS NULL;

-- Force the next sync to run a full import so the rebuilt event set is complete.
UPDATE "GoogleCalendarConnection"
SET "lastSyncToken" = NULL, "lastSyncedAt" = NULL;

ALTER TABLE "CalendarEvent" ALTER COLUMN "connectionId" SET NOT NULL;

-- Replace the old user-scoped unique key with a connection-scoped one.
DROP INDEX IF EXISTS "CalendarEvent_userId_googleEventId_key";
CREATE INDEX "CalendarEvent_connectionId_idx" ON "CalendarEvent"("connectionId");
CREATE UNIQUE INDEX "CalendarEvent_connectionId_googleEventId_key" ON "CalendarEvent"("connectionId", "googleEventId");

ALTER TABLE "CalendarEvent"
ADD CONSTRAINT "CalendarEvent_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "GoogleCalendarConnection"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
