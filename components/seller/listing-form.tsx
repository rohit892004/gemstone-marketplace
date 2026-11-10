"use client";

import { useActionState } from "react";
import { saveListingAction, type ListingFormState } from "@/app/seller/listings/actions";
import { SelectField, TextField } from "@/components/seller/form-fields";
import { RadioGroup, TextAreaField } from "@/components/seller/catalogue-fields";
import { AVAILABILITY_VALUES } from "@/lib/listings/schema";

const initialState: ListingFormState = {};

export interface ListingFormProps {
  /** Empty for a new listing. */
  listingId?: string;
  categories: readonly { id: string; name: string }[];
  labs: readonly { id: string; name: string }[];
  /** Field values as strings. Missing keys use the blank default. */
  defaults: Record<string, string>;
  /** Shown above the form after a successful save. */
  savedNotice?: "draft" | "submit";
}

const availabilityLabels: Record<(typeof AVAILABILITY_VALUES)[number], string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  SOLD: "Sold",
  HIDDEN: "Hidden from buyers",
};

export function ListingForm({ listingId, categories, labs, defaults, savedNotice }: ListingFormProps) {
  const [state, formAction, pending] = useActionState(saveListingAction, initialState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const v = (key: string, fallback = "") => values[key] ?? defaults[key] ?? fallback;
  // The featured checkbox shows only when the page supplies the current state (defaults.sellerFeatured), or for a new
  // listing. Otherwise saving leaves the featured flag alone, so an edit page without the state cannot un-feature.
  const featuredKnown = listingId === undefined || "sellerFeatured" in defaults;
  const featuredDefault = (values.sellerFeatured ?? defaults.sellerFeatured ?? "") === "true";

  return (
    <form action={formAction} noValidate className="space-y-10">
      {listingId ? <input type="hidden" name="listingId" value={listingId} /> : null}

      {state.saved ?? savedNotice ? (
        <p role="status" className="rounded-md border border-line bg-surface-raised px-4 py-3 text-sm text-ink">
          {(state.saved ?? savedNotice) === "submit" ? "Submitted for review." : "Draft saved."}
        </p>
      ) : null}
      {state.formError ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.formError}
        </p>
      ) : null}

      <fieldset className="space-y-5">
        <legend className="text-lg font-semibold text-ink">Listing</legend>
        <TextField name="title" label="Title" required error={errors.title} defaultValue={v("title")} hint="For example: 3.2 ct Blue Sapphire, Ceylon, unheated" />
        <SelectField
          name="categoryId"
          label="Category"
          required
          placeholder="Select a category"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          defaultValue={v("categoryId")}
          error={errors.categoryId}
        />
        <TextField name="species" label="Gemstone type" required error={errors.species} defaultValue={v("species")} hint="For example: Sapphire, Ruby, Emerald" />
        <TextField name="variety" label="Variety" error={errors.variety} defaultValue={v("variety")} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="shape" label="Shape" error={errors.shape} defaultValue={v("shape")} />
          <TextField name="cut" label="Cut" error={errors.cut} defaultValue={v("cut")} />
          <TextField name="caratWeight" label="Carat weight" type="number" required error={errors.caratWeight} defaultValue={v("caratWeight")} hint="Up to 3 decimal places." />
          <TextField name="dimensions" label="Dimensions" error={errors.dimensions} defaultValue={v("dimensions")} hint="For example: 7.5 x 5.2 x 3.1 mm" />
          <TextField name="colour" label="Colour" error={errors.colour} defaultValue={v("colour")} />
          <TextField name="clarity" label="Clarity" error={errors.clarity} defaultValue={v("clarity")} />
          <TextField name="origin" label="Origin" error={errors.origin} defaultValue={v("origin")} />
          <TextField name="treatment" label="Treatment" error={errors.treatment} defaultValue={v("treatment")} hint="For example: Unheated, Heat-treated" />
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-lg font-semibold text-ink">Certificate</legend>
        <SelectField
          name="certificateLabId"
          label="Certificate lab"
          placeholder="No certificate"
          options={labs.map((l) => ({ value: l.id, label: l.name }))}
          defaultValue={v("certificateLabId")}
          error={errors.certificateLabId}
        />
        <TextField name="certificateNo" label="Certificate number" error={errors.certificateNo} defaultValue={v("certificateNo")} />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-lg font-semibold text-ink">Price and stock</legend>
        <RadioGroup
          name="priceMode"
          legend="Pricing"
          defaultValue={v("priceMode", "PRICE")}
          error={errors.priceMode}
          options={[
            { value: "PRICE", label: "Set a price" },
            { value: "ON_REQUEST", label: "Price on request" },
          ]}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="price"
            label="Price (major units)"
            error={errors.price}
            defaultValue={v("price")}
            inputMode="numeric"
            placeholder="12,500.00"
            hint="Ignored when pricing is on request."
          />
          <SelectField
            name="currency"
            label="Currency"
            required
            placeholder="Select a currency"
            options={[
              { value: "INR", label: "INR (Indian rupee)" },
              { value: "USD", label: "USD (US dollar)" },
            ]}
            defaultValue={v("currency", "INR")}
            error={errors.currency}
          />
          <TextField name="quantity" label="Quantity" type="number" required error={errors.quantity} defaultValue={v("quantity", "1")} />
          <SelectField
            name="availability"
            label="Availability"
            required
            placeholder="Select availability"
            options={AVAILABILITY_VALUES.map((value) => ({ value, label: availabilityLabels[value] }))}
            defaultValue={v("availability", "AVAILABLE")}
            error={errors.availability}
          />
        </div>
      </fieldset>

      {featuredKnown ? (
        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold text-ink">Featured</legend>
          <input type="hidden" name="sellerFeaturedSet" value="1" />
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="sellerFeatured"
              value="on"
              defaultChecked={featuredDefault}
              aria-describedby="sellerFeatured-hint"
              className="mt-1 size-4"
            />
            <span>
              <span className="font-medium">Feature this listing</span>
              <span id="sellerFeatured-hint" className="block text-xs text-ink-soft">
                Uses one of your membership&apos;s featured slots. Free members have no featured slots. Turning this off is always allowed.
              </span>
            </span>
          </label>
        </fieldset>
      ) : null}

      <fieldset className="space-y-5">
        <legend className="text-lg font-semibold text-ink">Description</legend>
        <TextAreaField name="description" label="Description" rows={6} maxLength={4000} error={errors.description} defaultValue={v("description")} />
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className="rounded-md border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
        >
          Save draft
        </button>
        <button
          type="submit"
          name="intent"
          value="submit"
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Submit for review
        </button>
      </div>
    </form>
  );
}
