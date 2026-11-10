-- AlterTable
ALTER TABLE "NewsletterConsent" ADD COLUMN     "consentText" TEXT,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'SELECTED_TOPICS';
