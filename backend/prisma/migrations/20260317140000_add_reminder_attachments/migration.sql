-- CreateTable
CREATE TABLE "ReminderAttachment" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderAttachment_reminderId_createdAt_idx" ON "ReminderAttachment"("reminderId", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderAttachment_userId_idx" ON "ReminderAttachment"("userId");

-- AddForeignKey
ALTER TABLE "ReminderAttachment" ADD CONSTRAINT "ReminderAttachment_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
