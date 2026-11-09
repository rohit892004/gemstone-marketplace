-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('ENQUIRY', 'GENERAL', 'REQUIREMENT');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'OFFER', 'QUOTATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'SCAM', 'HARASSMENT', 'FAKE_LISTING', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('OPEN', 'DISMISSED', 'ACTIONED');

-- AlterEnum
ALTER TYPE "QuotationStatus" ADD VALUE 'WITHDRAWN';

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_enquiryId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "Enquiry" DROP CONSTRAINT "Enquiry_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "Enquiry" DROP CONSTRAINT "Enquiry_gemstoneId_fkey";

-- DropForeignKey
ALTER TABLE "Enquiry" DROP CONSTRAINT "Enquiry_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "Quotation" DROP CONSTRAINT "Quotation_enquiryId_fkey";

-- DropForeignKey
ALTER TABLE "Quotation" DROP CONSTRAINT "Quotation_sellerId_fkey";

-- DropIndex
DROP INDEX "Conversation_buyerId_lastMessageAt_idx";

-- DropIndex
DROP INDEX "Conversation_buyerId_sellerId_gemstoneId_key";

-- DropIndex
DROP INDEX "Conversation_enquiryId_key";

-- DropIndex
DROP INDEX "Conversation_sellerId_lastMessageAt_idx";

-- DropIndex
DROP INDEX "Message_flagged_idx";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "buyerId",
DROP COLUMN "enquiryId",
DROP COLUMN "sellerId",
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "ConversationKind" NOT NULL,
ADD COLUMN     "pairKey" TEXT NOT NULL,
ADD COLUMN     "requirementId" TEXT,
ADD COLUMN     "startedById" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
-- AlterTable
ALTER TABLE "Message" DROP COLUMN "flagReason",
ADD COLUMN     "kind" "MessageKind" NOT NULL DEFAULT 'TEXT';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "emailedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Quotation" DROP COLUMN "enquiryId",
ADD COLUMN     "conversationId" TEXT NOT NULL,
ADD COLUMN     "itemTitle" TEXT NOT NULL,
ADD COLUMN     "messageId" TEXT NOT NULL,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "terms" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contactStrikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "messagingRestrictedUntil" TIMESTAMP(3);

-- DropTable
DROP TABLE "Enquiry";

-- DropEnum
DROP TYPE "EnquiryStatus";

-- DropEnum
DROP TYPE "EnquiryType";

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "note" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "counterOfId" TEXT,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "categoryId" TEXT,
    "gemstoneType" TEXT NOT NULL,
    "shape" TEXT,
    "caratMin" DECIMAL(10,3),
    "caratMax" DECIMAL(10,3),
    "budgetMinMinor" BIGINT,
    "budgetMaxMinor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "certificateNeeded" BOOLEAN NOT NULL DEFAULT false,
    "originPreference" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "deadline" TIMESTAMP(3),
    "notes" TEXT,
    "status" "RequirementStatus" NOT NULL DEFAULT 'OPEN',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementResponse" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationFlag" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "requirementId" TEXT,
    "senderId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kinds" TEXT[],
    "status" "ModerationStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enquiries" BOOLEAN NOT NULL DEFAULT true,
    "messages" BOOLEAN NOT NULL DEFAULT true,
    "offersAndQuotes" BOOLEAN NOT NULL DEFAULT true,
    "requirements" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "_CategoryToSellerProfile" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToSellerProfile_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_createdAt_idx" ON "ConversationParticipant"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageAttachment_storageKey_key" ON "MessageAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_messageId_key" ON "Offer"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_counterOfId_key" ON "Offer"("counterOfId");

-- CreateIndex
CREATE INDEX "Offer_conversationId_createdAt_idx" ON "Offer"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Requirement_status_categoryId_createdAt_idx" ON "Requirement"("status", "categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Requirement_buyerId_createdAt_idx" ON "Requirement"("buyerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementResponse_conversationId_key" ON "RequirementResponse"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementResponse_requirementId_sellerId_key" ON "RequirementResponse"("requirementId", "sellerId");

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationFlag_status_createdAt_idx" ON "ModerationFlag"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationFlag_senderId_createdAt_idx" ON "ModerationFlag"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "_CategoryToSellerProfile_B_index" ON "_CategoryToSellerProfile"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_pairKey_key" ON "Conversation"("pairKey");

-- CreateIndex
CREATE INDEX "Conversation_gemstoneId_idx" ON "Conversation"("gemstoneId");

-- CreateIndex
CREATE INDEX "Conversation_requirementId_idx" ON "Conversation"("requirementId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Message_flagged_createdAt_idx" ON "Message"("flagged", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_messageId_key" ON "Quotation"("messageId");

-- CreateIndex
CREATE INDEX "Quotation_conversationId_createdAt_idx" ON "Quotation"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Quotation_sellerId_status_idx" ON "Quotation"("sellerId", "status");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_counterOfId_fkey" FOREIGN KEY ("counterOfId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementResponse" ADD CONSTRAINT "RequirementResponse_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementResponse" ADD CONSTRAINT "RequirementResponse_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationFlag" ADD CONSTRAINT "ModerationFlag_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationFlag" ADD CONSTRAINT "ModerationFlag_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationFlag" ADD CONSTRAINT "ModerationFlag_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationFlag" ADD CONSTRAINT "ModerationFlag_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToSellerProfile" ADD CONSTRAINT "_CategoryToSellerProfile_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToSellerProfile" ADD CONSTRAINT "_CategoryToSellerProfile_B_fkey" FOREIGN KEY ("B") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

