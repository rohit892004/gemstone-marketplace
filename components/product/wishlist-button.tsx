"use client";

import { useState, useTransition } from "react";
import { addToWishlist, removeFromWishlist } from "@/lib/wishlist/actions";
import { buttonClasses } from "@/components/ui/button";

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
        className={buttonClasses({ variant: "secondary", block: true, className: "disabled:opacity-60" })}
      >
        {saved ? "Saved" : "Save to wishlist"}
      </button>
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
