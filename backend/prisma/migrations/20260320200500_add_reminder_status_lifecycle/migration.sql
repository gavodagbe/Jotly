CREATE TYPE "ReminderStatus" AS ENUM ('pending', 'fired', 'completed', 'cancelled');

ALTER TABLE "Reminder"
ADD COLUMN "status" "ReminderStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3);

UPDATE "Reminder"
SET
  "status" = CASE
    WHEN "isDismissed" = true THEN 'completed'::"ReminderStatus"
    WHEN "isFired" = true THEN 'fired'::"ReminderStatus"
    ELSE 'pending'::"ReminderStatus"
  END,
  "completedAt" = CASE
    WHEN "isDismissed" = true THEN "dismissedAt"
    ELSE NULL
  END;

CREATE INDEX "Reminder_userId_status_remindAt_idx"
ON "Reminder"("userId", "status", "remindAt");
