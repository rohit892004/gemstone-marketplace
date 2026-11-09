import { redirect } from "next/navigation";
import { requireBuyerFeatures } from "@/lib/auth/buyer-access";
import { AuthzError } from "@/lib/auth/require-role";

/**
 * Page-level wrapper around requireBuyerFeatures(): BUYER and SELLER pass, everyone else is
 * redirected instead of seeing a raw error. Call it inside a Suspense child.
 */
export async function requireBuyerPage() {
  try {
    return await requireBuyerFeatures();
  } catch (err) {
    if (!(err instanceof AuthzError)) throw err;
    switch (err.code) {
      case "UNAUTHENTICATED":
        redirect("/login");
      case "EMAIL_NOT_VERIFIED":
        redirect("/login?error=email_not_verified");
      case "ACCOUNT_SUSPENDED":
      case "SELLER_SUSPENDED":
        redirect("/login?error=account_suspended");
      default:
        redirect("/dashboard");
    }
  }
}
