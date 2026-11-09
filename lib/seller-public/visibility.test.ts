import { describe, expect, it } from "vitest";
import { isPubliclyVisible, showVerifiedBadge, visibleDocuments } from "./visibility";

const doc = (isPublic: boolean, verificationStatus: string) => ({ id: `${isPublic}-${verificationStatus}`, isPublic, verificationStatus });

describe("product documents", () => {
  it("shows a document only when it is public AND VERIFIED", () => {
    const docs = [doc(true, "VERIFIED"), doc(false, "VERIFIED"), doc(true, "PENDING"), doc(true, "REJECTED")];
    expect(visibleDocuments(docs).map((d) => d.id)).toEqual(["true-VERIFIED"]);
  });

  it("hides everything when no document qualifies", () => {
    expect(visibleDocuments([doc(false, "PENDING"), doc(true, "PENDING")])).toEqual([]);
  });

  it("shows the Verified badge only when a visible document exists", () => {
    expect(showVerifiedBadge([doc(true, "VERIFIED")])).toBe(true);
    expect(showVerifiedBadge([doc(false, "VERIFIED")])).toBe(false);
    expect(showVerifiedBadge([doc(true, "PENDING")])).toBe(false);
    expect(showVerifiedBadge([])).toBe(false);
  });
});

describe("isPubliclyVisible", () => {
  const base = { status: "PUBLISHED", availability: "AVAILABLE", seller: { approvalStatus: "APPROVED" } };

  it("is visible when published, not hidden and the seller is approved", () => {
    expect(isPubliclyVisible(base)).toBe(true);
    expect(isPubliclyVisible({ ...base, availability: "SOLD" })).toBe(true);
  });

  it("is not visible when hidden, unpublished or from an unapproved seller", () => {
    expect(isPubliclyVisible({ ...base, availability: "HIDDEN" })).toBe(false);
    expect(isPubliclyVisible({ ...base, status: "PENDING_REVIEW" })).toBe(false);
    expect(isPubliclyVisible({ ...base, seller: { approvalStatus: "SUSPENDED" } })).toBe(false);
  });
});
