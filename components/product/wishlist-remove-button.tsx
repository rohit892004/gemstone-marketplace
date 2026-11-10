"use client";

import { useState, useTransition } from "react";
import { removeFromWishlist } from "@/lib/wishlist/actions";

/** Removes an item from the buyer's wishlist. Used on the wishlist page. */
export function RemoveWishlistButton({ listingId }: { listingId: string }) {
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (removed) return null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await removeFromWishlist(listingId);
            if (result.ok) setRemoved(true);
            else setError(result.error);
          })
        }
        className="inline-flex min-h-11 items-center text-[13px] text-ink-soft underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      >
        Remove from wishlist
      </button>
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
