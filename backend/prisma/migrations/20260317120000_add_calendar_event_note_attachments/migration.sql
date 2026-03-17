-- CreateTable
CREATE TABLE "CalendarEventNoteAttachment" (
    "id" TEXT NOT NULL,
    "calendarEventNoteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEventNoteAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEventNoteAttachment_calendarEventNoteId_idx" ON "CalendarEventNoteAttachment"("calendarEventNoteId");

-- CreateIndex
CREATE INDEX "CalendarEventNoteAttachment_userId_idx" ON "CalendarEventNoteAttachment"("userId");

-- AddForeignKey
ALTER TABLE "CalendarEventNoteAttachment" ADD CONSTRAINT "CalendarEventNoteAttachment_calendarEventNoteId_fkey" FOREIGN KEY ("calendarEventNoteId") REFERENCES "CalendarEventNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
