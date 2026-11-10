import type { ReactNode } from "react";
import { Suspense } from "react";
import { SellerNav } from "@/components/seller/seller-nav";
import { requirePageRole } from "@/lib/auth/require-role";

/**
 * Seller shell. Pending sellers may enter (for the "under review" view), so the layout only
 * requires the SELLER role. Navigation is shown to approved sellers only.
 */
export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <Suspense fallback={null}>
        <SellerShell>{children}</SellerShell>
      </Suspense>
    </div>
  );
}

async function SellerShell({ children }: { children: ReactNode }) {
  const user = await requirePageRole(["SELLER"]);
  if (user.sellerApproval !== "APPROVED") return <>{children}</>;
  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
      <SellerNav />
      <div className="min-w-0 pt-10 lg:pt-0">{children}</div>
    </div>
  );
}
