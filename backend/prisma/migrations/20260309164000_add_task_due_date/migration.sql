ALTER TABLE "Task"
ADD COLUMN "dueDate" DATE;

UPDATE "Task"
SET "dueDate" = "targetDate"
WHERE "dueDate" IS NULL;

CREATE INDEX "Task_userId_dueDate_idx" ON "Task"("userId", "dueDate");
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");
