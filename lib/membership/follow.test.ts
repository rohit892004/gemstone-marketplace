import { describe, expect, it } from "vitest";
import { decideFollow, followRefusalMessage, type FollowFacts } from "./follow";

const base: FollowFacts = {
  actorRole: "BUYER",
  actorUserId: "u-buyer",
  sellerUserId: "u-seller",
  sellerApproval: "APPROVED",
  currentlyFollowing: false,
};

describe("decideFollow", () => {
  it("lets an approved buyer follow", () => {
    expect(decideFollow(base)).toEqual({ allowed: true, action: "follow" });
  });

  it("lets a seller follow another approved seller", () => {
    expect(decideFollow({ ...base, actorRole: "SELLER", actorUserId: "u-other" })).toEqual({ allowed: true, action: "follow" });
  });

  it("refuses a signed-out visitor", () => {
    expect(decideFollow({ ...base, actorRole: null, actorUserId: null })).toEqual({ allowed: false, reason: "signed-out" });
  });

  it("refuses admins and valuators", () => {
    expect(decideFollow({ ...base, actorRole: "ADMIN" })).toEqual({ allowed: false, reason: "role" });
    expect(decideFollow({ ...base, actorRole: "VALUATOR" })).toEqual({ allowed: false, reason: "role" });
  });

  it("refuses a seller's own profile", () => {
    expect(decideFollow({ ...base, actorRole: "SELLER", actorUserId: "u-seller" })).toEqual({ allowed: false, reason: "own-business" });
  });

  it("refuses pending and suspended sellers", () => {
    expect(decideFollow({ ...base, sellerApproval: "PENDING" })).toEqual({ allowed: false, reason: "seller-not-approved" });
    expect(decideFollow({ ...base, sellerApproval: "SUSPENDED" })).toEqual({ allowed: false, reason: "seller-not-approved" });
  });

  it("always allows unfollow for a signed-in follower", () => {
    expect(decideFollow({ ...base, currentlyFollowing: true, sellerApproval: "SUSPENDED" })).toEqual({ allowed: true, action: "unfollow" });
  });

  it("gives a plain-text message for every refusal", () => {
    expect(followRefusalMessage("own-business")).toBe("You cannot follow your own business.");
    expect(followRefusalMessage("signed-out")).toMatch(/Sign in/);
  });
});
