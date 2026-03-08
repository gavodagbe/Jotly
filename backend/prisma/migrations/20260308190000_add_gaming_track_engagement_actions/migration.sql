-- CreateTable
CREATE TABLE "GamingTrackChallengeClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "challengeWeekStart" DATE NOT NULL,
    "rewardXp" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamingTrackChallengeClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamingTrackStreakProtectionUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamingTrackStreakProtectionUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamingTrackNudgeDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nudgeId" TEXT NOT NULL,
    "dismissedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamingTrackNudgeDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamingTrackChallengeClaim_userId_challengeId_challengeWeekStart_key" ON "GamingTrackChallengeClaim"("userId", "challengeId", "challengeWeekStart");

-- CreateIndex
CREATE INDEX "GamingTrackChallengeClaim_userId_challengeWeekStart_idx" ON "GamingTrackChallengeClaim"("userId", "challengeWeekStart");

-- CreateIndex
CREATE UNIQUE INDEX "GamingTrackStreakProtectionUsage_userId_usedOn_key" ON "GamingTrackStreakProtectionUsage"("userId", "usedOn");

-- CreateIndex
CREATE INDEX "GamingTrackStreakProtectionUsage_userId_usedOn_idx" ON "GamingTrackStreakProtectionUsage"("userId", "usedOn");

-- CreateIndex
CREATE UNIQUE INDEX "GamingTrackNudgeDismissal_userId_nudgeId_dismissedOn_key" ON "GamingTrackNudgeDismissal"("userId", "nudgeId", "dismissedOn");

-- CreateIndex
CREATE INDEX "GamingTrackNudgeDismissal_userId_dismissedOn_idx" ON "GamingTrackNudgeDismissal"("userId", "dismissedOn");

-- AddForeignKey
ALTER TABLE "GamingTrackChallengeClaim" ADD CONSTRAINT "GamingTrackChallengeClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamingTrackStreakProtectionUsage" ADD CONSTRAINT "GamingTrackStreakProtectionUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamingTrackNudgeDismissal" ADD CONSTRAINT "GamingTrackNudgeDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
