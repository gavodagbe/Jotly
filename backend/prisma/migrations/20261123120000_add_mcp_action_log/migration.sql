-- CreateTable
CREATE TABLE "McpActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "tool" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),
    CONSTRAINT "McpActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpActionLog_userId_createdAt_idx" ON "McpActionLog"("userId", "createdAt");
CREATE INDEX "McpActionLog_createdAt_idx" ON "McpActionLog"("createdAt");
