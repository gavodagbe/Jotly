-- DropIndex
DROP INDEX IF EXISTS "GoogleCalendarConnection_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarConnection_userId_googleAccountEmail_key" ON "GoogleCalendarConnection"("userId", "googleAccountEmail");

-- CreateIndex
CREATE INDEX "GoogleCalendarConnection_userId_idx" ON "GoogleCalendarConnection"("userId");
