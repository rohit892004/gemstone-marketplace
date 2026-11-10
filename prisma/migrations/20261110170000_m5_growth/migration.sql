-- M5: analytics events and rollups, follows, referrals, membership tiers, seller-chosen featured listings.
-- CreateEnum
CREATE TYPE "AnalyticsEventKind" AS ENUM ('PROFILE_VIEW', 'LISTING_VIEW', 'LISTING_IMPRESSION', 'WISHLIST_ADD', 'ENQUIRY_STARTED', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'VALUATION_REQUESTED', 'FOLLOW', 'SEARCH');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'VOIDED');

-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('FREE', 'PREMIUM', 'ELITE');

-- AlterTable
ALTER TABLE "Gemstone" ADD COLUMN     "sellerFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "kind" "AnalyticsEventKind" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "day" DATE NOT NULL,
    "visitorHash" TEXT,
    "sellerId" TEXT,
    "gemstoneId" TEXT,
    "categoryId" TEXT,
    "term" TEXT,
    "dedupeKey" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsRollup" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "sellerId" TEXT,
    "gemstoneId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AnalyticsRollup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerSellerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "ipHash" TEXT,
    "deviceHash" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedReason" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierRule" (
    "tier" "MembershipTier" NOT NULL,
    "activeListingLimit" INTEGER,
    "featuredSlots" INTEGER NOT NULL DEFAULT 0,
    "analyticsDays" INTEGER NOT NULL,
    "hasBadge" BOOLEAN NOT NULL DEFAULT false,
    "rankingBoost" INTEGER NOT NULL DEFAULT 0,
    "unlockReferrals" INTEGER,
    "unlockFollowers" INTEGER,
    "minResponseRate" INTEGER NOT NULL DEFAULT 0,
    "minRating" DECIMAL(3,2),
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierRule_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE "SellerMembership" (
    "sellerId" TEXT NOT NULL,
    "tier" "MembershipTier" NOT NULL DEFAULT 'FREE',
    "tierSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "graceUntil" TIMESTAMP(3),
    "graceTier" "MembershipTier",
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overrideById" TEXT,
    "qualifiedReferrals" INTEGER NOT NULL DEFAULT 0,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "responseRate" INTEGER,
    "averageRating" DECIMAL(3,2),
    "evaluatedAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SellerMembership_pkey" PRIMARY KEY ("sellerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsEvent_dedupeKey_key" ON "AnalyticsEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_kind_day_idx" ON "AnalyticsEvent"("kind", "day");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sellerId_day_idx" ON "AnalyticsEvent"("sellerId", "day");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_gemstoneId_day_idx" ON "AnalyticsEvent"("gemstoneId", "day");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsRollup_key_key" ON "AnalyticsRollup"("key");

-- CreateIndex
CREATE INDEX "AnalyticsRollup_sellerId_day_idx" ON "AnalyticsRollup"("sellerId", "day");

-- CreateIndex
CREATE INDEX "AnalyticsRollup_kind_day_idx" ON "AnalyticsRollup"("kind", "day");

-- CreateIndex
CREATE INDEX "Follow_sellerId_idx" ON "Follow"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_sellerId_key" ON "Follow"("followerId", "sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");

-- CreateIndex
CREATE INDEX "Referral_referrerSellerId_status_idx" ON "Referral"("referrerSellerId", "status");

-- CreateIndex
CREATE INDEX "Referral_flagged_idx" ON "Referral"("flagged");

-- CreateIndex
CREATE INDEX "Referral_ipHash_idx" ON "Referral"("ipHash");

-- CreateIndex
CREATE INDEX "Referral_deviceHash_idx" ON "Referral"("deviceHash");

-- CreateIndex
CREATE UNIQUE INDEX "SellerProfile_referralCode_key" ON "SellerProfile"("referralCode");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerSellerId_fkey" FOREIGN KEY ("referrerSellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerMembership" ADD CONSTRAINT "SellerMembership_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

