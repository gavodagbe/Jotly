-- AlterTable
ALTER TABLE "Task" ADD COLUMN "userId" TEXT;

DO $$
DECLARE
  first_user_id TEXT;
BEGIN
  SELECT "id"
  INTO first_user_id
  FROM "User"
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF first_user_id IS NULL AND EXISTS (SELECT 1 FROM "Task" WHERE "userId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill Task.userId: no users exist to own legacy tasks';
  END IF;

  IF first_user_id IS NOT NULL THEN
    UPDATE "Task"
    SET "userId" = first_user_id
    WHERE "userId" IS NULL;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Task_userId_targetDate_idx" ON "Task"("userId", "targetDate");

-- CreateIndex
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");

-- AddForeignKey
ALTER TABLE "Task"
ADD CONSTRAINT "Task_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
