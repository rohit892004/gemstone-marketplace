import { describe, expect, it } from "vitest";
import {
  canActAsValuator,
  canPublishOnListing,
  canRequestValuation,
  canViewValuation,
  valuatorCanWorkOn,
  verificationView,
} from "./access";
import { isValidReference, newValuationReference, REFERENCE_ALPHABET } from "./reference";

const REQUESTER = { id: "buyer_1", role: "BUYER" as const };
const OTHER_BUYER = { id: "buyer_2", role: "BUYER" as const };
const SELLER_OF_LISTING = { id: "seller_1", role: "SELLER" as const };
const VALUATOR = { id: "val_1", role: "VALUATOR" as const };
const OTHER_VALUATOR = { id: "val_2", role: "VALUATOR" as const };
const ADMIN = { id: "admin_1", role: "ADMIN" as const };

const base = {
  requesterId: "buyer_1",
  assignedValuatorId: "val_1",
  status: "IN_EXPERT_REVIEW",
  withdrawnAt: null,
};

describe("canViewValuation", () => {
  it("lets the requester, the assigned valuator and admins view it", () => {
    expect(canViewValuation(REQUESTER, base)).toBe(true);
    expect(canViewValuation(VALUATOR, base)).toBe(true);
    expect(canViewValuation(ADMIN, base)).toBe(true);
  });

  it("refuses another buyer, the seller of the listing, and other valuators", () => {
    expect(canViewValuation(OTHER_BUYER, base)).toBe(false);
    expect(canViewValuation(SELLER_OF_LISTING, base)).toBe(false);
    expect(canViewValuation(OTHER_VALUATOR, base)).toBe(false);
  });

  it("does not let a valuator view a request that is not assigned to them", () => {
    expect(canViewValuation(VALUATOR, { ...base, assignedValuatorId: null })).toBe(false);
    expect(canViewValuation(VALUATOR, { ...base, assignedValuatorId: "val_2" })).toBe(false);
  });

  it("does not let a seller see a buyer's valuation of their own listing", () => {
    const sellerAlsoRequester = { id: "seller_1", role: "SELLER" as const };
    expect(canViewValuation(sellerAlsoRequester, { ...base, requesterId: "buyer_1" })).toBe(false);
  });
});

describe("valuator actions", () => {
  it("only assigned valuators act, and only while the request is actionable", () => {
    expect(canActAsValuator(VALUATOR, base)).toBe(true);
    expect(canActAsValuator(OTHER_VALUATOR, base)).toBe(false);
    expect(valuatorCanWorkOn(VALUATOR, base)).toBe(true);
    expect(valuatorCanWorkOn(VALUATOR, { ...base, status: "NEEDS_INFO" })).toBe(true);
    expect(valuatorCanWorkOn(VALUATOR, { ...base, status: "COMPLETED" })).toBe(false);
    expect(valuatorCanWorkOn(VALUATOR, { ...base, withdrawnAt: new Date() })).toBe(false);
  });

  it("never lets a buyer or an admin act as a valuator", () => {
    expect(canActAsValuator(REQUESTER, base)).toBe(false);
    expect(canActAsValuator(ADMIN, base)).toBe(false);
  });
});

describe("canRequestValuation", () => {
  it("allows buyers and approved sellers", () => {
    expect(canRequestValuation({ role: "BUYER", approvalStatus: null })).toBe(true);
    expect(canRequestValuation({ role: "SELLER", approvalStatus: "APPROVED" })).toBe(true);
  });

  it("refuses pending or rejected sellers, valuators and admins", () => {
    expect(canRequestValuation({ role: "SELLER", approvalStatus: "PENDING" })).toBe(false);
    expect(canRequestValuation({ role: "SELLER", approvalStatus: "REJECTED" })).toBe(false);
    expect(canRequestValuation({ role: "VALUATOR", approvalStatus: null })).toBe(false);
    expect(canRequestValuation({ role: "ADMIN", approvalStatus: null })).toBe(false);
  });
});

describe("canPublishOnListing", () => {
  const listing = { id: "gem_1", sellerUserId: "seller_1" };
  const own = { ...base, requesterId: "seller_1", assignedValuatorId: null, status: "COMPLETED", gemstoneId: "gem_1" };

  it("lets the owner publish their own completed report on their own listing", () => {
    expect(canPublishOnListing({ id: "seller_1", role: "SELLER" }, own, listing)).toBe(true);
  });

  it("refuses a buyer's valuation of the listing, even when the seller tries", () => {
    const buyersValuation = { ...own, requesterId: "buyer_1" };
    expect(canPublishOnListing({ id: "seller_1", role: "SELLER" }, buyersValuation, listing)).toBe(false);
  });

  it("refuses a report that is not complete, withdrawn, or made for a different listing", () => {
    expect(canPublishOnListing({ id: "seller_1", role: "SELLER" }, { ...own, status: "IN_EXPERT_REVIEW" }, listing)).toBe(false);
    expect(canPublishOnListing({ id: "seller_1", role: "SELLER" }, { ...own, withdrawnAt: new Date() }, listing)).toBe(false);
    expect(canPublishOnListing({ id: "seller_1", role: "SELLER" }, { ...own, gemstoneId: "gem_2" }, listing)).toBe(false);
  });
});

describe("verificationView", () => {
  const completed = {
    reference: "GSV-26-K7Q2M9",
    completedAt: new Date("2026-11-10T10:00:00.000Z"),
    submittedAt: new Date("2026-11-09T10:00:00.000Z"),
    gemstoneType: "Sapphire",
    status: "COMPLETED",
    withdrawnAt: null,
    valuedBy: "AUTO",
  };

  it("returns exactly the allow-listed fields and no price, range, requester or listing", () => {
    const leaky = { ...completed, autoEstimateMinor: BigInt(123), requesterId: "buyer_1", gemstoneId: "gem_1" };
    const view = verificationView(leaky);
    expect(Object.keys(view).sort()).toEqual(["date", "gemstoneType", "method", "reference", "status"]);
    expect(JSON.stringify(view)).not.toMatch(/123|buyer_1|gem_1/);
  });

  it("reports VALID with the method for a completed report", () => {
    expect(verificationView(completed)).toMatchObject({ status: "VALID", method: "AUTO", date: "2026-11-10T10:00:00.000Z" });
    expect(verificationView({ ...completed, valuedBy: "EXPERT" }).method).toBe("EXPERT");
  });

  it("reports WITHDRAWN once an admin withdraws it, even if it was completed", () => {
    expect(verificationView({ ...completed, withdrawnAt: new Date() }).status).toBe("WITHDRAWN");
  });

  it("reports NOT_COMPLETE for requests still in progress, using the submission date", () => {
    const view = verificationView({ ...completed, status: "IN_EXPERT_REVIEW", completedAt: null, valuedBy: null });
    expect(view.status).toBe("NOT_COMPLETE");
    expect(view.method).toBeNull();
    expect(view.date).toBe("2026-11-09T10:00:00.000Z");
  });
});

describe("valuation references", () => {
  it("formats GSV-YY-XXXXXX from the supplied bytes", () => {
    const ref = newValuationReference((n) => new Uint8Array(n).fill(0), 2026);
    expect(ref).toBe("GSV-26-222222");
    expect(isValidReference(ref)).toBe(true);
  });

  it("uses only the unambiguous alphabet, even for the highest byte values", () => {
    const ref = newValuationReference((n) => new Uint8Array(n).fill(255), 2027);
    expect(ref.slice(-6)).toMatch(new RegExp(`^[${REFERENCE_ALPHABET}]{6}$`));
    expect(REFERENCE_ALPHABET).not.toMatch(/[0O1IL]/);
  });

  it("accepts only the exact format", () => {
    expect(isValidReference("GSV-26-K7Q2M9")).toBe(true);
    expect(isValidReference("gsv-26-K7Q2M9")).toBe(false);
    expect(isValidReference("GSV-26-K7Q2M")).toBe(false);
    expect(isValidReference("GSV-26-K7Q2M0")).toBe(false);
    expect(isValidReference("GSV-26-K7Q2M9; drop")).toBe(false);
  });
});
