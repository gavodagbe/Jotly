-- AlterTable
ALTER TABLE "User" ADD COLUMN "requireDailyTimeImputation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TaskTimeEntry" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "fraction" DECIMAL(3,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskTimeEntry_userId_entryDate_idx" ON "TaskTimeEntry"("userId", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTimeEntry_taskId_entryDate_key" ON "TaskTimeEntry"("taskId", "entryDate");

-- AddForeignKey
ALTER TABLE "TaskTimeEntry" ADD CONSTRAINT "TaskTimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTimeEntry" ADD CONSTRAINT "TaskTimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
