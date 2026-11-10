/**
 * Follow rules. Pure: the server action passes the facts in, and this decides. Buyers and sellers may follow an
 * approved seller, never their own business. Unfollowing is always allowed for a signed-in follower.
 */

export type FollowAction = "follow" | "unfollow";

export type FollowRefusal = "signed-out" | "role" | "own-business" | "seller-not-approved";

export type FollowDecision = { allowed: true; action: FollowAction } | { allowed: false; reason: FollowRefusal };

export interface FollowFacts {
  /** Null when no user is signed in. */
  actorRole: string | null;
  actorUserId: string | null;
  sellerUserId: string;
  sellerApproval: string;
  currentlyFollowing: boolean;
}

const FOLLOW_ROLES: readonly string[] = ["BUYER", "SELLER"];

export function decideFollow(facts: FollowFacts): FollowDecision {
  if (!facts.actorUserId || !facts.actorRole) return { allowed: false, reason: "signed-out" };
  if (facts.currentlyFollowing) return { allowed: true, action: "unfollow" };
  if (!FOLLOW_ROLES.includes(facts.actorRole)) return { allowed: false, reason: "role" };
  if (facts.actorUserId === facts.sellerUserId) return { allowed: false, reason: "own-business" };
  if (facts.sellerApproval !== "APPROVED") return { allowed: false, reason: "seller-not-approved" };
  return { allowed: true, action: "follow" };
}

/** Plain-text reason for the follow form. */
export function followRefusalMessage(reason: FollowRefusal): string {
  switch (reason) {
    case "signed-out":
      return "Sign in to follow this seller.";
    case "role":
      return "Only buyer and seller accounts can follow sellers.";
    case "own-business":
      return "You cannot follow your own business.";
    case "seller-not-approved":
      return "This seller is not accepting followers right now.";
  }
}
