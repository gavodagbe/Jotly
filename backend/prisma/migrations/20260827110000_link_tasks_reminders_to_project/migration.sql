-- AlterTable
ALTER TABLE "Task" ADD COLUMN "subProject" TEXT;
ALTER TABLE "Task" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Reminder" ADD COLUMN "subProject" TEXT;
ALTER TABLE "Reminder" ADD COLUMN "projectId" TEXT;

-- Backfill: create one top-level Project per user per distinct (case-insensitive,
-- whitespace-normalized) non-empty project name found on existing tasks/reminders.
INSERT INTO "Project" ("id", "userId", "name", "parentId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."userId", s."name", NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT "userId", MIN("name") AS "name"
  FROM (
    SELECT "userId", btrim(regexp_replace("project", '\s+', ' ', 'g')) AS "name"
    FROM "Task"
    WHERE "project" IS NOT NULL AND btrim("project") <> ''
    UNION ALL
    SELECT "userId", btrim(regexp_replace("project", '\s+', ' ', 'g')) AS "name"
    FROM "Reminder"
    WHERE "project" IS NOT NULL AND btrim("project") <> ''
  ) names
  GROUP BY "userId", lower("name")
) s;

-- Link tasks to their backfilled project and canonicalize the denormalized name.
UPDATE "Task" t
SET "projectId" = p."id", "project" = p."name"
FROM "Project" p
WHERE p."parentId" IS NULL
  AND p."userId" = t."userId"
  AND lower(p."name") = lower(btrim(regexp_replace(t."project", '\s+', ' ', 'g')))
  AND t."project" IS NOT NULL
  AND btrim(t."project") <> '';

-- Link reminders to their backfilled project and canonicalize the denormalized name.
UPDATE "Reminder" r
SET "projectId" = p."id", "project" = p."name"
FROM "Project" p
WHERE p."parentId" IS NULL
  AND p."userId" = r."userId"
  AND lower(p."name") = lower(btrim(regexp_replace(r."project", '\s+', ' ', 'g')))
  AND r."project" IS NOT NULL
  AND btrim(r."project") <> '';

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Reminder_projectId_idx" ON "Reminder"("projectId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
