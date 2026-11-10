import { Suspense } from "react";
import { Heart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
      <EmptyState
        icon={Heart}
        title="Your wishlist is empty"
        body="Save stones you are watching and they will appear here."
        action={
          <ButtonLink href="/gemstones" variant="secondary">
            Browse gemstones
          </ButtonLink>
        }
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {rows.map((row) => (
        <li key={row.gemstoneId} className="flex flex-col gap-2">
          {row.card ? (
            <>
              <ListingCard listing={row.card} />
              <RemoveWishlistButton listingId={row.gemstoneId} />
            </>
          ) : (
            <div className="flex h-full flex-col justify-between gap-3 border border-line bg-surface-raised p-5">
              <p className="font-heading text-xl text-ink-soft">No longer available</p>
              <RemoveWishlistButton listingId={row.gemstoneId} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
