import type { ReactNode } from "react";
import { Suspense } from "react";
import { SellerNav } from "@/components/seller/seller-nav";
import { requirePageRole } from "@/lib/auth/require-role";

/**
 * Seller shell. Pending sellers may enter (for the "under review" view), so the layout only
 * requires the SELLER role. Navigation is shown to approved sellers only.
 */
export default function SellerLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}><SellerShell>{children}</SellerShell></Suspense>;
}

async function SellerShell({ children }: { children: ReactNode }) {
  const user = await requirePageRole(["SELLER"]);
  return (
    <>
      {user.sellerApproval === "APPROVED" ? <SellerNav /> : null}
      {children}
    </>
  );
}
