ALTER TABLE "User"
ADD COLUMN "preferredLocale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "preferredTimeZone" TEXT;
