-- M5: membership and follow notifications preference.
ALTER TABLE "NotificationPreference" ADD COLUMN "membership" BOOLEAN NOT NULL DEFAULT true;
