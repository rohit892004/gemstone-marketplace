-- M4 valuation: new models and VALUATOR role. Replaces the M0 Valuation stub (0 rows).
-- CreateEnum
CREATE TYPE "ValuationSource" AS ENUM ('LISTING', 'STANDALONE');

-- CreateEnum
CREATE TYPE "ValuationMediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ValuationValuedBy" AS ENUM ('AUTO', 'EXPERT');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VALUATOR';

-- AlterEnum
BEGIN;
CREATE TYPE "ValuationStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'AUTO_VALUED', 'IN_EXPERT_REVIEW', 'NEEDS_INFO', 'COMPLETED', 'REJECTED');
ALTER TABLE "public"."Valuation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Valuation" ALTER COLUMN "status" TYPE "ValuationStatus_new" USING ("status"::text::"ValuationStatus_new");
ALTER TYPE "ValuationStatus" RENAME TO "ValuationStatus_old";
ALTER TYPE "ValuationStatus_new" RENAME TO "ValuationStatus";
DROP TYPE "public"."ValuationStatus_old";
ALTER TABLE "Valuation" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "Valuation" DROP CONSTRAINT "Valuation_expertId_fkey";

-- DropForeignKey
ALTER TABLE "Valuation" DROP CONSTRAINT "Valuation_userId_fkey";

-- DropIndex
DROP INDEX "Valuation_status_idx";

-- AlterTable
ALTER TABLE "Valuation" DROP COLUMN "confidence",
DROP COLUMN "estimateHighMinor",
DROP COLUMN "estimateLowMinor",
DROP COLUMN "expertId",
DROP COLUMN "inputs",
DROP COLUMN "mediaKeys",
DROP COLUMN "reportKey",
DROP COLUMN "userId",
ADD COLUMN     "assignedValuatorId" TEXT,
ADD COLUMN     "autoConfidence" TEXT,
ADD COLUMN     "autoEstimateMinor" BIGINT,
ADD COLUMN     "autoFactors" JSONB,
ADD COLUMN     "autoHighMinor" BIGINT,
ADD COLUMN     "autoLowMinor" BIGINT,
ADD COLUMN     "caratMilli" INTEGER,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "certificateNumber" TEXT,
ADD COLUMN     "clarity" TEXT,
ADD COLUMN     "colour" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "dimensions" TEXT,
ADD COLUMN     "expertReasons" TEXT[],
ADD COLUMN     "finalConfidence" TEXT,
ADD COLUMN     "finalEstimateMinor" BIGINT,
ADD COLUMN     "finalHighMinor" BIGINT,
ADD COLUMN     "finalLowMinor" BIGINT,
ADD COLUMN     "gemstoneId" TEXT,
ADD COLUMN     "gemstoneType" TEXT NOT NULL,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "labId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "publishedOnListing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qualityGrade" TEXT,
ADD COLUMN     "reference" TEXT NOT NULL,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestExpert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requesterId" TEXT NOT NULL,
ADD COLUMN     "shape" TEXT,
ADD COLUMN     "source" "ValuationSource" NOT NULL,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "treatment" TEXT,
ADD COLUMN     "valuedBy" "ValuationValuedBy",
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ADD COLUMN     "withdrawnReason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'DRAFT',
ALTER COLUMN "currency" SET NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'INR';

-- CreateTable
CREATE TABLE "ValuationMedia" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "kind" "ValuationMediaKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValuationMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuationNote" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValuationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferencePrice" (
    "id" TEXT NOT NULL,
    "gemstoneType" TEXT NOT NULL,
    "qualityGrade" TEXT NOT NULL,
    "band" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "pricePerCaratMinor" BIGINT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferencePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuationMultiplier" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bps" INTEGER NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ValuationMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ValuationMedia_valuationId_sortOrder_idx" ON "ValuationMedia"("valuationId", "sortOrder");

-- CreateIndex
CREATE INDEX "ValuationNote_valuationId_createdAt_idx" ON "ValuationNote"("valuationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferencePrice_gemstoneType_qualityGrade_band_currency_key" ON "ReferencePrice"("gemstoneType", "qualityGrade", "band", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "ValuationMultiplier_kind_key_key" ON "ValuationMultiplier"("kind", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Valuation_reference_key" ON "Valuation"("reference");

-- CreateIndex
CREATE INDEX "Valuation_requesterId_createdAt_idx" ON "Valuation"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "Valuation_status_createdAt_idx" ON "Valuation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Valuation_assignedValuatorId_status_idx" ON "Valuation"("assignedValuatorId", "status");

-- CreateIndex
CREATE INDEX "Valuation_gemstoneId_idx" ON "Valuation"("gemstoneId");

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_assignedValuatorId_fkey" FOREIGN KEY ("assignedValuatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_gemstoneId_fkey" FOREIGN KEY ("gemstoneId") REFERENCES "Gemstone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_labId_fkey" FOREIGN KEY ("labId") REFERENCES "CertificateLab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValuationMedia" ADD CONSTRAINT "ValuationMedia_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValuationNote" ADD CONSTRAINT "ValuationNote_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValuationNote" ADD CONSTRAINT "ValuationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

