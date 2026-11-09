-- Admin must record a reason when rejecting a review.
ALTER TABLE "Review" ADD COLUMN     "rejectionReason" TEXT;
