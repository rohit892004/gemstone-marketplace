-- M4: valuation notifications preference.
ALTER TABLE "NotificationPreference" ADD COLUMN "valuations" BOOLEAN NOT NULL DEFAULT true;
