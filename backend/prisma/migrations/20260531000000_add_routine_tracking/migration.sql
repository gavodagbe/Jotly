CREATE TABLE "RoutineTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challenge" TEXT NOT NULL DEFAULT 'normal',
    "startTime" TEXT,
    "endTime" TEXT,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoutineCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "targetDate" DATE NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineCompletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoutineTemplate_userId_isActive_sortOrder_idx" ON "RoutineTemplate"("userId", "isActive", "sortOrder");
CREATE INDEX "RoutineTemplate_userId_sortOrder_idx" ON "RoutineTemplate"("userId", "sortOrder");

CREATE UNIQUE INDEX "RoutineCompletion_routineId_targetDate_key" ON "RoutineCompletion"("routineId", "targetDate");
CREATE INDEX "RoutineCompletion_userId_targetDate_idx" ON "RoutineCompletion"("userId", "targetDate");
CREATE INDEX "RoutineCompletion_routineId_targetDate_idx" ON "RoutineCompletion"("routineId", "targetDate");

ALTER TABLE "RoutineTemplate" ADD CONSTRAINT "RoutineTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineCompletion" ADD CONSTRAINT "RoutineCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineCompletion" ADD CONSTRAINT "RoutineCompletion_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "RoutineTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
