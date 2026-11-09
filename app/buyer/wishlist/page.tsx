import Link from "next/link";
import { Suspense } from "react";
import { ListingCard } from "@/components/catalogue/listing-card";
import { RemoveWishlistButton } from "@/components/product/wishlist-remove-button";
import { listWishlist } from "@/lib/wishlist/queries";
import { requireBuyerPage } from "../guard";

export default function WishlistPage() {
  return (
    <Suspense fallback={null}>
      <WishlistList />
    </Suspense>
  );
}

async function WishlistList() {
  const user = await requireBuyerPage();
  const rows = await listWishlist(user.id);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
        <h2 className="text-lg font-semibold text-ink">Your wishlist is empty</h2>
        <p className="mt-2 text-sm text-ink-soft">Save stones you are watching and they will appear here.</p>
        <Link href="/gemstones" className="mt-4 inline-block text-sm font-medium text-brand-strong underline underline-offset-4">
          Browse gemstones
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {rows.map((row) => (
        <li key={row.gemstoneId} className="flex flex-col gap-2">
          {row.card ? (
            <>
              <ListingCard listing={row.card} />
              <RemoveWishlistButton listingId={row.gemstoneId} />
            </>
          ) : (
            <div className="flex h-full flex-col justify-between gap-3 rounded-lg border border-dashed border-line bg-surface-raised p-5">
              <p className="font-medium text-ink-soft">No longer available</p>
              <RemoveWishlistButton listingId={row.gemstoneId} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
