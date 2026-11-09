import Link from "next/link";
import { Suspense } from "react";
import { requireBuyerPage } from "./guard";
import { prisma } from "@/lib/db/client";

export default function BuyerDashboardPage() {
  return (
    <Suspense fallback={null}>
      <BuyerOverview />
    </Suspense>
  );
}

async function BuyerOverview() {
  const user = await requireBuyerPage();
  const wishlistCount = await prisma.wishlistItem.count({ where: { buyerId: user.id } });

  return (
    <div className="space-y-6">
      <p className="text-ink-soft">
        Welcome{user.name ? `, ${user.name}` : ""}. Signed in as {user.email}.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        <li className="rounded-lg border border-line bg-surface-raised p-5">
          <h2 className="font-semibold text-ink">Wishlist</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {wishlistCount} {wishlistCount === 1 ? "stone" : "stones"} saved
          </p>
          <Link href="/buyer/wishlist" className="mt-3 inline-block text-sm font-medium text-brand-strong underline underline-offset-4">
            Open wishlist
          </Link>
        </li>
        <li className="rounded-lg border border-dashed border-line bg-surface-raised p-5">
          <h2 className="font-semibold text-ink">Enquiries, chat and valuations</h2>
          <p className="mt-1 text-sm text-ink-soft">These tabs go live in the next update.</p>
        </li>
      </ul>
    </div>
  );
}
