import { AuthzError, requirePageRole, requireRole } from "@/lib/auth/require-role";

/**
 * For approved-only seller pages. Returns "not_approved" for PENDING/REJECTED sellers so the
 * page can show a neutral notice. Every other failure (signed out, suspended, wrong role)
 * is redirected by requirePageRole, never rendered.
 */
export async function gateApprovedSeller(): Promise<"approved" | "not_approved"> {
  try {
    await requireRole(["SELLER"], { sellerApproved: true });
    return "approved";
  } catch (error) {
    if (error instanceof AuthzError && error.code === "SELLER_NOT_APPROVED") return "not_approved";
    if (error instanceof AuthzError) {
      await requirePageRole(["SELLER"]); // redirects; does not return for these codes
      return "not_approved";
    }
    throw error;
  }
}
