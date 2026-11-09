"use client";

import { useActionState } from "react";
import { savePortfolioAction, type PortfolioFormState } from "@/app/seller/portfolio/actions";
import { TextField } from "@/components/seller/form-fields";
import { ImageFileField, TextAreaField } from "@/components/seller/catalogue-fields";
import { SPECIALTY_MAX_COUNT, SPECIALTY_MAX_LENGTH } from "@/lib/seller/portfolio";

const initialState: PortfolioFormState = {};

export interface PortfolioFormProps {
  tagline: string;
  description: string;
  specialties: string[];
  hasLogo: boolean;
  hasBanner: boolean;
}

export function PortfolioForm({ tagline, description, specialties, hasLogo, hasBanner }: PortfolioFormProps) {
  const [state, formAction, pending] = useActionState(savePortfolioAction, initialState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={formAction} encType="multipart/form-data" noValidate className="space-y-8">
      {state.saved ? (
        <p role="status" className="rounded-md border border-line bg-surface-raised px-4 py-3 text-sm text-ink">
          Portfolio saved.
        </p>
      ) : null}
      {state.formError ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.formError}
        </p>
      ) : null}

      <fieldset className="space-y-5">
        <legend className="text-lg font-semibold text-ink">Public profile</legend>
        <TextField
          name="tagline"
          label="Tagline"
          error={errors.tagline}
          defaultValue={values.tagline ?? tagline}
          hint="One line shown under your business name. Up to 120 characters."
        />
        <TextAreaField
          name="description"
          label="About your business"
          rows={6}
          maxLength={2000}
          error={errors.description}
          defaultValue={values.description ?? description}
        />
        <TextField
          name="specialties"
          label="Specialties"
          error={errors.specialties}
          defaultValue={values.specialties ?? specialties.join(", ")}
          hint={`Separate with commas. Up to ${SPECIALTY_MAX_COUNT} items, each ${SPECIALTY_MAX_LENGTH} characters or fewer.`}
        />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-lg font-semibold text-ink">Images</legend>
        <ImageFileField
          name="logo"
          label={hasLogo ? "Replace logo" : "Logo"}
          error={errors.logo}
          hint="JPEG, PNG or WebP, up to 15 MB. Location data is removed on upload."
        />
        <ImageFileField
          name="banner"
          label={hasBanner ? "Replace banner" : "Banner"}
          error={errors.banner}
          hint="JPEG, PNG or WebP, up to 15 MB. Location data is removed on upload."
        />
      </fieldset>

      <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Saving..." : "Save portfolio"}
      </button>
    </form>
  );
}
