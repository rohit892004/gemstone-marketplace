"use client";

import { useActionState } from "react";
import { updateQuantityAction, type InventoryActionState } from "@/app/seller/inventory/actions";

const initialState: InventoryActionState = {};

/** Inline quantity editor for one listing. Each row is its own form, so rows never nest. */
export function InventoryQuantityForm({ listingId, quantity, title }: { listingId: string; quantity: number; title: string }) {
  const [state, formAction, pending] = useActionState(updateQuantityAction, initialState);
  const inputId = `quantity-${listingId}`;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="listingId" value={listingId} />
      <label htmlFor={inputId} className="sr-only">
        Quantity for {title}
      </label>
      <input
        id={inputId}
        name="quantity"
        type="number"
        min={1}
        max={10000}
        step={1}
        defaultValue={quantity}
        aria-invalid={state.error ? true : undefined}
        className="w-24 rounded-md border border-line bg-surface-raised px-2 py-1 text-sm text-ink"
      />
      <button type="submit" disabled={pending} className="rounded-md border border-line px-3 py-1 text-xs font-medium text-ink disabled:opacity-60">
        Save
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-red-700">
          {state.error}
        </span>
      ) : state.message ? (
        <span role="status" className="text-xs text-ink-soft">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
