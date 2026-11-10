import { describe, expect, it } from "vitest";
import { canPublishOnListing, isResultReady, verificationView } from "./access";

describe("isResultReady", () => {
  it("is true for an automatic or an expert result, and false otherwise", () => {
    expect(isResultReady("AUTO_VALUED")).toBe(true);
    expect(isResultReady("COMPLETED")).toBe(true);
    for (const status of ["DRAFT", "SUBMITTED", "IN_EXPERT_REVIEW", "NEEDS_INFO", "REJECTED"]) {
      expect(isResultReady(status)).toBe(false);
    }
  });
});

describe("canPublishOnListing with automatic results", () => {
  const listing = { id: "gem_1", sellerUserId: "seller_1" };
  const base = { requesterId: "seller_1", assignedValuatorId: null, withdrawnAt: null, gemstoneId: "gem_1" };

  it("lets the seller publish their own automatic result", () => {
    expect(canPublishOnListing({ id: "seller_1", role: "SELLER" }, { ...base, status: "AUTO_VALUED" }, listing)).toBe(true);
  });

  it("does not let the seller publish a withdrawn result", () => {
    expect(canPublishOnListing({ id: "seller_1", role: "SELLER" }, { ...base, status: "AUTO_VALUED", withdrawnAt: new Date() }, listing)).toBe(false);
  });
});

describe("verificationView with automatic results", () => {
  it("shows VALID with the AUTO method for an automatic result", () => {
    const view = verificationView({
      reference: "GSV-26-K7Q2M9",
      completedAt: new Date("2026-11-10T08:00:00Z"),
      submittedAt: null,
      gemstoneType: "Sapphire",
      status: "AUTO_VALUED",
      withdrawnAt: null,
      valuedBy: "AUTO",
    });
    expect(view.status).toBe("VALID");
    expect(view.method).toBe("AUTO");
  });
});
