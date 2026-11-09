import type { Role } from "@/app/generated/prisma/client";

/**
 * Valuation access rules. Pure: the database reads happen in the caller, and these functions decide.
 *
 *  - A valuation is private to the requester, the valuator it is assigned to, and admins.
 *  - A seller who owns a listing is never shown a buyer's valuation of that listing.
 *  - The seller may publish a COMPLETED report of their OWN listing request, and only then is it shown on
 *    the listing.
 *  - The public verification page shows only what verificationView allows: never the price or the requester.
 */

export interface ValuationViewer {
  id: string;
  role: Role;
}

export interface ValuationAccessRecord {
  requesterId: string;
  assignedValuatorId: string | null;
  status: string;
  withdrawnAt: Date | null;
}

/** Requesters, assigned valuators and admins. Nobody else. */
export function canViewValuation(viewer: ValuationViewer, valuation: ValuationAccessRecord): boolean {
  if (viewer.role === "ADMIN") return true;
  if (viewer.id === valuation.requesterId) return true;
  return viewer.role === "VALUATOR" && valuation.assignedValuatorId !== null && viewer.id === valuation.assignedValuatorId;
}

/** Only valuators act on valuations, and only on the ones assigned to them. */
export function canActAsValuator(viewer: ValuationViewer, valuation: ValuationAccessRecord): boolean {
  return viewer.role === "VALUATOR" && valuation.assignedValuatorId !== null && viewer.id === valuation.assignedValuatorId;
}

/** Statuses in which a valuator may still work on the request. */
export const VALUATOR_ACTIONABLE_STATUSES = ["IN_EXPERT_REVIEW", "NEEDS_INFO"] as const;

export function valuatorCanWorkOn(viewer: ValuationViewer, valuation: ValuationAccessRecord): boolean {
  return (
    canActAsValuator(viewer, valuation) &&
    (VALUATOR_ACTIONABLE_STATUSES as readonly string[]).includes(valuation.status) &&
    valuation.withdrawnAt === null
  );
}

/**
 * The requester may publish on a listing only when they own that listing, the valuation was made for it,
 * and the report is complete and not withdrawn. The seller of a listing can never publish someone else's
 * valuation.
 */
export function canPublishOnListing(
  viewer: ValuationViewer,
  valuation: ValuationAccessRecord & { gemstoneId: string | null },
  listing: { id: string; sellerUserId: string },
): boolean {
  return (
    viewer.id === valuation.requesterId &&
    valuation.gemstoneId === listing.id &&
    listing.sellerUserId === viewer.id &&
    valuation.status === "COMPLETED" &&
    valuation.withdrawnAt === null
  );
}

/** Buyers and sellers may request a valuation. Pending or suspended sellers may not. */
export function canRequestValuation(user: { role: Role; approvalStatus: string | null }): boolean {
  if (user.role === "BUYER") return true;
  return user.role === "SELLER" && user.approvalStatus === "APPROVED";
}

export type VerificationMethod = "AUTO" | "EXPERT";
export type VerificationStatus = "VALID" | "WITHDRAWN" | "NOT_COMPLETE";

/**
 * What the public verification page may show. An allow-list: it returns these five fields and nothing else.
 * It never includes the price, the range, the requester, the listing or the notes.
 */
export interface VerificationView {
  reference: string;
  /** Completion date, or the submission date when not complete. ISO string. */
  date: string | null;
  gemstoneType: string;
  status: VerificationStatus;
  method: VerificationMethod | null;
}

export function verificationView(valuation: {
  reference: string;
  completedAt: Date | null;
  submittedAt: Date | null;
  gemstoneType: string;
  status: string;
  withdrawnAt: Date | null;
  valuedBy: string | null;
}): VerificationView {
  const date = valuation.completedAt ?? valuation.submittedAt;
  let status: VerificationStatus = "NOT_COMPLETE";
  if (valuation.withdrawnAt !== null) status = "WITHDRAWN";
  else if (valuation.status === "COMPLETED") status = "VALID";
  const method: VerificationMethod | null =
    valuation.valuedBy === "EXPERT" ? "EXPERT" : valuation.valuedBy === "AUTO" ? "AUTO" : null;
  return {
    reference: valuation.reference,
    date: date ? date.toISOString() : null,
    gemstoneType: valuation.gemstoneType,
    status,
    method,
  };
}
