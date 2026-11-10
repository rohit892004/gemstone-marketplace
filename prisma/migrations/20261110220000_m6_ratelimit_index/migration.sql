-- The hourly rate-limit cleanup deletes rows by updatedAt.
CREATE INDEX "RateLimit_updatedAt_idx" ON "RateLimit"("updatedAt");
