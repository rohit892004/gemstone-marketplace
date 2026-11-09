-- Listing link on public-text refusals (M3 owner decision 2).
-- AlterTable
ALTER TABLE "ModerationFlag" ADD COLUMN     "gemstoneId" TEXT;

-- CreateIndex
CREATE INDEX "ModerationFlag_gemstoneId_idx" ON "ModerationFlag"("gemstoneId");

-- AddForeignKey
ALTER TABLE "ModerationFlag" ADD CONSTRAINT "ModerationFlag_gemstoneId_fkey" FOREIGN KEY ("gemstoneId") REFERENCES "Gemstone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
