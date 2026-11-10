-- Preference and unsubscribe links are HMAC-signed, so the stored token hash is not needed.
-- DropIndex
DROP INDEX "NewsletterSubscriber_manageTokenHash_key";

-- AlterTable
ALTER TABLE "NewsletterSubscriber" DROP COLUMN "manageTokenHash";
