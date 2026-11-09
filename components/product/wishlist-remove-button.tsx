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
        className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-60"
      >
        Remove from wishlist
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
