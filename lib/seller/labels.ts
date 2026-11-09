import type { businessTypeValues } from "@/lib/validation/schemas";

/** Readable labels for the business type select. Client-safe (no database imports). */
export const businessTypeLabels: Record<(typeof businessTypeValues)[number], string> = {
  SOLE_PROPRIETORSHIP: "Sole proprietorship",
  PARTNERSHIP: "Partnership",
  LLP: "Limited liability partnership (LLP)",
  PRIVATE_LIMITED: "Private limited company",
  PUBLIC_LIMITED: "Public limited company",
  OTHER: "Other",
};
