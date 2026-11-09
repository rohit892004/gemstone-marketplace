-- M2 catalogue: listings, media, listing documents, reviews, settings, search
-- CreateEnum
CREATE TYPE "ListingDocumentType" AS ENUM ('CERTIFICATE', 'VALUATION_REPORT', 'LAB_DOCUMENT');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Availability" ADD VALUE 'HIDDEN';

-- DropIndex
DROP INDEX "Gemstone_species_caratWeight_idx";

-- AlterTable
ALTER TABLE "Gemstone" ADD COLUMN     "certificateLabId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "dimensions" TEXT,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceOnRequest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "searchText" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, coalesce("title", '') || ' ' || coalesce("species", '') || ' ' || coalesce("variety", '') || ' ' || coalesce("colour", '') || ' ' || coalesce("cut", '') || ' ' || coalesce("shape", '') || ' ' || coalesce("origin", '') || ' ' || coalesce("treatment", '') || ' ' || coalesce("description", ''))) STORED,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GemstoneMedia" ADD COLUMN     "alt" TEXT,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "isCover" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "sizeBytes" INTEGER NOT NULL,
ADD COLUMN     "thumbKey" TEXT,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ratingAverage" DECIMAL(3,2),
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tagline" TEXT;

-- CreateTable
CREATE TABLE "ListingDocument" (
    "id" TEXT NOT NULL,
    "gemstoneId" TEXT NOT NULL,
    "type" "ListingDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "certificateLabId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationReason" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingDocument_fileKey_key" ON "ListingDocument"("fileKey");

-- CreateIndex
CREATE INDEX "ListingDocument_gemstoneId_idx" ON "ListingDocument"("gemstoneId");

-- CreateIndex
CREATE INDEX "ListingDocument_verificationStatus_idx" ON "ListingDocument"("verificationStatus");

-- CreateIndex
CREATE INDEX "Review_sellerId_status_idx" ON "Review"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Gemstone_status_species_idx" ON "Gemstone"("status", "species");

-- CreateIndex
CREATE INDEX "Gemstone_status_caratWeight_idx" ON "Gemstone"("status", "caratWeight");

-- CreateIndex
CREATE INDEX "Gemstone_status_priceMinor_idx" ON "Gemstone"("status", "priceMinor");

-- CreateIndex
CREATE INDEX "Gemstone_status_publishedAt_idx" ON "Gemstone"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Gemstone_categoryId_idx" ON "Gemstone"("categoryId");

-- CreateIndex
CREATE INDEX "Gemstone_featured_idx" ON "Gemstone"("featured");

-- CreateIndex
CREATE INDEX "Gemstone_searchText_idx" ON "Gemstone" USING GIN ("searchText");

-- CreateIndex
CREATE UNIQUE INDEX "GemstoneMedia_fileKey_key" ON "GemstoneMedia"("fileKey");

-- CreateIndex
CREATE UNIQUE INDEX "GemstoneMedia_thumbKey_key" ON "GemstoneMedia"("thumbKey");

-- CreateIndex
CREATE INDEX "SellerProfile_approvalStatus_featured_idx" ON "SellerProfile"("approvalStatus", "featured");

-- AddForeignKey
ALTER TABLE "Gemstone" ADD CONSTRAINT "Gemstone_certificateLabId_fkey" FOREIGN KEY ("certificateLabId") REFERENCES "CertificateLab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gemstone" ADD CONSTRAINT "Gemstone_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingDocument" ADD CONSTRAINT "ListingDocument_gemstoneId_fkey" FOREIGN KEY ("gemstoneId") REFERENCES "Gemstone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingDocument" ADD CONSTRAINT "ListingDocument_certificateLabId_fkey" FOREIGN KEY ("certificateLabId") REFERENCES "CertificateLab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingDocument" ADD CONSTRAINT "ListingDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

