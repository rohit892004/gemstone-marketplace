import { describe, expect, it } from "vitest";
import { canViewListing, isOwnListing } from "./visibility";
import { canTransition, statusAfterEdit, statusOnSubmit } from "./status";

const base = {
  status: "PUBLISHED",
  availability: "AVAILABLE",
  seller: { approvalStatus: "APPROVED", userId: "u_seller" },
};

describe("canViewListing", () => {
  it("is public to anyone only when published, not hidden, and seller approved", () => {
    expect(canViewListing(base, null)).toBe(true);
    expect(canViewListing({ ...base, status: "PENDING_REVIEW" }, null)).toBe(false);
    expect(canViewListing({ ...base, status: "DRAFT" }, null)).toBe(false);
    expect(canViewListing({ ...base, availability: "HIDDEN" }, null)).toBe(false);
    expect(canViewListing({ ...base, seller: { ...base.seller, approvalStatus: "PENDING" } }, null)).toBe(false);
    expect(canViewListing({ ...base, seller: { ...base.seller, approvalStatus: "SUSPENDED" } }, null)).toBe(false);
  });

  it("lets the owning seller and admins see unpublished listings", () => {
    const draft = { ...base, status: "DRAFT" };
    expect(canViewListing(draft, { id: "u_seller", role: "SELLER" })).toBe(true);
    expect(canViewListing(draft, { id: "u_admin", role: "ADMIN" })).toBe(true);
    expect(canViewListing(draft, { id: "u_other_seller", role: "SELLER" })).toBe(false);
    expect(canViewListing(draft, { id: "u_buyer", role: "BUYER" })).toBe(false);
  });

  it("detects the owner for self-action blocks", () => {
    expect(isOwnListing(base, "u_seller")).toBe(true);
    expect(isOwnListing(base, "u_buyer")).toBe(false);
    expect(isOwnListing(base, null)).toBe(false);
  });
});

describe("listing moderation transitions", () => {
  it("submits drafts and rejected listings only", () => {
    expect(canTransition("DRAFT", "submit")).toBe(true);
    expect(canTransition("REJECTED", "submit")).toBe(true);
    expect(canTransition("PUBLISHED", "submit")).toBe(false);
  });

  it("approves or rejects only pending listings", () => {
    expect(canTransition("PENDING_REVIEW", "approve")).toBe(true);
    expect(canTransition("PENDING_REVIEW", "reject")).toBe(true);
    expect(canTransition("DRAFT", "approve")).toBe(false);
  });

  it("auto-publishes only for approved sellers when the setting is on", () => {
    expect(statusOnSubmit(true, true)).toBe("PUBLISHED");
    expect(statusOnSubmit(true, false)).toBe("PENDING_REVIEW");
    expect(statusOnSubmit(false, true)).toBe("PENDING_REVIEW");
  });

  it("sends an edited published listing back to draft for review", () => {
    expect(statusAfterEdit("PUBLISHED")).toBe("DRAFT");
    expect(statusAfterEdit("DRAFT")).toBe("DRAFT");
  });
});
