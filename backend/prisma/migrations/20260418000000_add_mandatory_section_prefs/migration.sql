-- AlterTable
ALTER TABLE "User" ADD COLUMN "requireDailyAffirmation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "requireDailyBilan" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "requireWeeklySynthesis" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "requireMonthlySynthesis" BOOLEAN NOT NULL DEFAULT false;
