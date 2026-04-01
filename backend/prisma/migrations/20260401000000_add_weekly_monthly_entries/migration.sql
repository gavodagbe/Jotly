CREATE TABLE "WeeklyEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "isoWeek" INTEGER NOT NULL,
    "objective" TEXT,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "objective" TEXT,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyEntry_userId_year_isoWeek_key" ON "WeeklyEntry"("userId", "year", "isoWeek");
CREATE INDEX "WeeklyEntry_userId_year_isoWeek_idx" ON "WeeklyEntry"("userId", "year", "isoWeek");

CREATE UNIQUE INDEX "MonthlyEntry_userId_year_month_key" ON "MonthlyEntry"("userId", "year", "month");
CREATE INDEX "MonthlyEntry_userId_year_month_idx" ON "MonthlyEntry"("userId", "year", "month");

ALTER TABLE "WeeklyEntry" ADD CONSTRAINT "WeeklyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyEntry" ADD CONSTRAINT "MonthlyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
