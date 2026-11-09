-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID_PROOF', 'BUSINESS_PROOF', 'CERTIFICATE');

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'MOBILE_OTP');

-- AlterEnum
ALTER TYPE "ApprovalStatus" ADD VALUE 'SUSPENDED';

-- AlterEnum
BEGIN;
CREATE TYPE "UserStatus_new" AS ENUM ('ACTIVE', 'SUSPENDED');
ALTER TABLE "public"."User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus_new" USING ("status"::text::"UserStatus_new");
ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "public"."UserStatus_old";
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ip" TEXT;

-- AlterTable
ALTER TABLE "Gemstone" DROP COLUMN "price",
ADD COLUMN     "priceMinor" BIGINT,
ALTER COLUMN "currency" SET DEFAULT 'INR';

-- AlterTable
ALTER TABLE "Quotation" DROP COLUMN "amount",
ADD COLUMN     "amountMinor" BIGINT NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'INR';

-- AlterTable
ALTER TABLE "SellerDocument" ADD COLUMN     "certificateLabId" TEXT,
ADD COLUMN     "certificateLabOther" TEXT,
ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "sizeBytes" INTEGER NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "DocumentType" NOT NULL;

-- AlterTable
ALTER TABLE "SellerProfile" DROP COLUMN "address",
DROP COLUMN "registrationNo",
ADD COLUMN     "addressLine" TEXT NOT NULL,
ADD COLUMN     "businessType" "BusinessType" NOT NULL,
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "gstNumber" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "specialties" TEXT[],
ADD COLUMN     "state" TEXT NOT NULL,
ADD COLUMN     "yearsInBusiness" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Valuation" DROP COLUMN "estimateHigh",
DROP COLUMN "estimateLow",
ADD COLUMN     "estimateHighMinor" BIGINT,
ADD COLUMN     "estimateLowMinor" BIGINT;

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CertificateLab" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isOther" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateLab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_purpose_idx" ON "AuthToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateLab_code_key" ON "CertificateLab"("code");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SellerDocument_fileKey_key" ON "SellerDocument"("fileKey");

-- CreateIndex
CREATE INDEX "SellerDocument_sellerId_idx" ON "SellerDocument"("sellerId");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerDocument" ADD CONSTRAINT "SellerDocument_certificateLabId_fkey" FOREIGN KEY ("certificateLabId") REFERENCES "CertificateLab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

