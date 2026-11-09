"use client";

import { useState, useTransition } from "react";
import { addToWishlist, removeFromWishlist } from "@/lib/wishlist/actions";

/**
 * Toggle for the wishlist. Calls the server actions; the server re-checks role, ownership and
 * visibility on every call, so this component only renders the result.
 */
export function WishlistButton({ listingId, initialSaved }: { listingId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      setError(null);
      const result = saved ? await removeFromWishlist(listingId) : await addToWishlist(listingId);
      if (result.ok) setSaved(result.saved);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        className="w-full rounded-md border border-brand px-4 py-2.5 text-sm font-medium text-brand-strong hover:bg-accent-soft disabled:opacity-60"
      >
        {saved ? "Saved" : "Save to wishlist"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
