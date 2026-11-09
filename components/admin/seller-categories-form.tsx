"use client";

import { useActionState } from "react";
import type { AdminActionState } from "@/lib/admin/action-state";

interface SellerCategoriesFormProps {
  action: (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  sellerId: string;
  options: readonly { id: string; name: string }[];
  selectedIds: readonly string[];
}

/** Admin editor for a seller's gemstone categories. Multi-select; at least one is required. */
export function SellerCategoriesForm({ action, sellerId, options, selectedIds }: SellerCategoriesFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const selected = new Set(selectedIds);

  return (
    <form action={formAction} className="space-y-3 rounded border border-stone-300 bg-white p-4">
      <div>
        <h3 className="font-medium">Gemstone categories</h3>
        <p className="text-sm text-stone-600">
          Used to match buyer requirements to this seller. Choose at least one. Changes apply whatever the
          seller&apos;s approval status.
        </p>
      </div>
      <input type="hidden" name="sellerId" value={sellerId} />
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Gemstone categories</legend>
        {options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="categoryIds" value={option.id} defaultChecked={selected.has(option.id)} />
            {option.name}
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={pending} className="rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Saving..." : "Save categories"}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? (
        <p role="status" className="text-sm text-green-800">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
