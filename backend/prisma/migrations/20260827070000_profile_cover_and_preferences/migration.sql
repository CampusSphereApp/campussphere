ALTER TABLE "User"
ADD COLUMN "coverImage" TEXT,
ADD COLUMN "notificationPreferences" JSONB,
ADD COLUMN "privacySettings" JSONB,
ADD COLUMN "appearanceSettings" JSONB;
