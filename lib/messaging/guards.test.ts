import { describe, expect, it } from "vitest";
import { canTransact, isOwnListing, isOwnRequirement } from "./guards";

describe("canTransact (buyers and approved sellers can post requirements and make offers)", () => {
  it("allows buyers", () => {
    expect(canTransact({ role: "BUYER", approvalStatus: null })).toBe(true);
  });

  it("allows approved sellers", () => {
    expect(canTransact({ role: "SELLER", approvalStatus: "APPROVED" })).toBe(true);
  });

  it("refuses sellers who are pending, rejected or suspended", () => {
    for (const status of ["PENDING", "REJECTED", "SUSPENDED", null]) {
      expect(canTransact({ role: "SELLER", approvalStatus: status })).toBe(false);
    }
  });

  it("refuses admins", () => {
    expect(canTransact({ role: "ADMIN", approvalStatus: null })).toBe(false);
  });
});

describe("isOwnListing", () => {
  it("is true when the acting user owns the listing's seller account", () => {
    expect(isOwnListing("user_s1", "user_s1")).toBe(true);
  });

  it("is false for another seller's listing, so a seller can act as a buyer there", () => {
    expect(isOwnListing("user_s1", "user_s2")).toBe(false);
  });
});

describe("isOwnRequirement", () => {
  it("is true when the seller posted the requirement, so they can never respond to it", () => {
    expect(isOwnRequirement("user_s1", "user_s1")).toBe(true);
  });

  it("is false for another user's requirement", () => {
    expect(isOwnRequirement("user_s1", "user_b1")).toBe(false);
  });
});
