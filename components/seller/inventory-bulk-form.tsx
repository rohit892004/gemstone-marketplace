"use client";

import { Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { useActionState } from "react";
import { bulkAvailabilityAction, type InventoryActionState } from "@/app/seller/inventory/actions";
import { availabilityLabels } from "@/lib/seller-catalogue/labels";
import { AVAILABILITY_VALUES } from "@/lib/listings/schema";

const initialState: InventoryActionState = {};

/**
 * Bulk availability form. Row checkboxes elsewhere on the page join this form through the
 * `form` attribute, so the rows stay outside this form element.
 */
export function InventoryBulkForm({ formId }: { formId: string }) {
  const [state, formAction, pending] = useActionState(bulkAvailabilityAction, initialState);

  return (
    <form id={formId} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="bulk-availability" className="block text-sm font-medium text-ink">
          Set availability for selected listings
        </label>
        <Select id="bulk-availability" name="availability" defaultValue="" >
          <option value="" disabled>
            Choose availability
          </option>
          {AVAILABILITY_VALUES.map((value) => (
            <option key={value} value={value}>
              {availabilityLabels[value]}
            </option>
          ))}
        </Select>
      </div>
      <button type="submit" disabled={pending} className={buttonClasses({ className: "disabled:opacity-60" })}>
        Apply
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {state.error}
        </p>
      ) : state.message ? (
        <p role="status" className="w-full text-sm text-ink-soft">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
