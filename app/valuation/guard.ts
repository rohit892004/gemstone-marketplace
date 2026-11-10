import { redirect } from "next/navigation";
import { checkRole, type CurrentUser } from "@/lib/auth/require-role";

/**
 * Who may request and read a valuation on the requester side: BUYER, or SELLER with an APPROVED account.
 * Pending, rejected, suspended, admin and valuator accounts are not requesters.
 *
 * requesterState() never redirects, so the landing page can explain the situation. gateRequester() is for
 * pages that need a requester and sends signed-out visitors to sign in, with next= set to the page.
 */

export type RequesterState =
  | { kind: "allowed"; user: CurrentUser }
  | { kind: "signed-out" }
  | { kind: "unverified" }
  | { kind: "suspended" }
  | { kind: "not-approved" }
  | { kind: "not-allowed" };

export async function requesterState(): Promise<RequesterState> {
  const result = await checkRole(["BUYER", "SELLER"], { sellerApproved: true });
  if (result.ok) return { kind: "allowed", user: result.user };
  switch (result.code) {
    case "UNAUTHENTICATED":
      return { kind: "signed-out" };
    case "EMAIL_NOT_VERIFIED":
      return { kind: "unverified" };
    case "ACCOUNT_SUSPENDED":
    case "SELLER_SUSPENDED":
      return { kind: "suspended" };
    case "SELLER_NOT_APPROVED":
      return { kind: "not-approved" };
    default:
      return { kind: "not-allowed" };
  }
}

/** For requester pages. Redirects signed-out, unverified and suspended visitors. Returns the state otherwise. */
export async function gateRequester(nextPath: string): Promise<Exclude<RequesterState, { kind: "signed-out" | "unverified" | "suspended" }>> {
  const state = await requesterState();
  switch (state.kind) {
    case "signed-out":
      redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    case "unverified":
      redirect("/login?error=email_not_verified");
    case "suspended":
      redirect("/login?error=account_suspended");
    default:
      return state;
  }
}

/**
 * For the seller's buying-side pages. Approved sellers only. Pending and other states get a message, not a redirect,
 * and the buyer area stays closed to sellers (proxy.ts). Returns "other" for a non-seller, so the page can send them to the dashboard.
 */
export async function sellerBuyingGate(): Promise<{ kind: "allowed"; userId: string } | { kind: "message"; state: RequesterState } | { kind: "other" }> {
  const state = await requesterState();
  if (state.kind !== "allowed") return { kind: "message", state };
  if (state.user.role !== "SELLER") return { kind: "other" };
  return { kind: "allowed", userId: state.user.id };
}
