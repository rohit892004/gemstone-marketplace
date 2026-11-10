"use client";

import { useActionState } from "react";
import type { AdminActionState } from "@/lib/admin/action-state";
import { Button } from "@/components/ui/button";

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
    <form action={formAction} className="space-y-4 border border-line bg-surface-raised p-5 sm:p-6">
      <div className="space-y-2">
        <h3 className="font-heading text-xl text-ink">Gemstone categories</h3>
        <p className="text-sm leading-relaxed text-ink-soft">
          Used to match buyer requirements to this seller. Choose at least one. Changes apply whatever the
          seller&apos;s approval status.
        </p>
      </div>
      <input type="hidden" name="sellerId" value={sellerId} />
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Gemstone categories</legend>
        {options.map((option) => (
          <label key={option.id} className="flex min-h-11 items-center gap-3 text-sm text-ink">
            <input type="checkbox" name="categoryIds" value={option.id} defaultChecked={selected.has(option.id)} className="h-4 w-4 accent-brand" />
            {option.name}
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save categories"}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
