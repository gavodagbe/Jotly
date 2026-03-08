-- Add carry-over linkage on Task
ALTER TABLE "Task"
ADD COLUMN "rolledFromTaskId" TEXT;

CREATE INDEX "Task_rolledFromTaskId_idx" ON "Task"("rolledFromTaskId");

CREATE UNIQUE INDEX "Task_rolledFromTaskId_targetDate_key"
ON "Task"("rolledFromTaskId", "targetDate");

ALTER TABLE "Task"
ADD CONSTRAINT "Task_rolledFromTaskId_fkey"
FOREIGN KEY ("rolledFromTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Day affirmation (one per user per date)
CREATE TABLE "DayAffirmation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetDate" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DayAffirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DayAffirmation_userId_targetDate_key"
ON "DayAffirmation"("userId", "targetDate");

CREATE INDEX "DayAffirmation_userId_targetDate_idx"
ON "DayAffirmation"("userId", "targetDate");

ALTER TABLE "DayAffirmation"
ADD CONSTRAINT "DayAffirmation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Day bilan (one per user per date)
CREATE TABLE "DayBilan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetDate" DATE NOT NULL,
    "mood" INTEGER,
    "wins" TEXT,
    "blockers" TEXT,
    "lessonsLearned" TEXT,
    "tomorrowTop3" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DayBilan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DayBilan_userId_targetDate_key"
ON "DayBilan"("userId", "targetDate");

CREATE INDEX "DayBilan_userId_targetDate_idx"
ON "DayBilan"("userId", "targetDate");

ALTER TABLE "DayBilan"
ADD CONSTRAINT "DayBilan_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
