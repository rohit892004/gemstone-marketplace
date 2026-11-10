"use client";

import { useActionState } from "react";
import { registerSellerAction, type SellerFormState } from "@/app/register/seller/actions";
import type { CategoryOption } from "@/lib/seller/category-selection";
import type { CertificateLabOption } from "@/lib/seller/labs";
import { businessTypeLabels } from "@/lib/seller/labels";
import { businessTypeValues } from "@/lib/validation/schemas";
import { CheckboxGroupField, FileField, SelectField, TextField } from "./form-fields";

const initialState: SellerFormState = {};
const CERTIFICATE_SLOTS = 5;

const businessTypeOptions = businessTypeValues.map((value) => ({ value, label: businessTypeLabels[value] }));

export function SellerRegisterForm({
  labs,
  categories,
  referralCode,
}: {
  labs: readonly CertificateLabOption[];
  categories: readonly CategoryOption[];
  /** From ?ref= on the registration page. Carried in a hidden field; the server validates it. */
  referralCode?: string;
}) {
  const [state, formAction, pending] = useActionState(registerSellerAction, initialState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const labOptions = labs.map((lab) => ({ value: lab.code, label: lab.name }));
  const categoryOptions = categories.map((category) => ({ value: category.id, label: category.name }));

  return (
    <form action={formAction} encType="multipart/form-data" noValidate className="space-y-10">
      {referralCode ? <input type="hidden" name="ref" value={referralCode} /> : null}
      {state.formError ? (
        <p role="alert" className=" border border-danger/40 bg-surface-raised px-4 py-3 text-sm text-danger">
          {state.formError}
        </p>
      ) : null}
      {Object.keys(errors).length > 0 ? (
        <p role="alert" className=" border border-danger/40 bg-surface-raised px-4 py-3 text-sm text-danger">
          Please correct the highlighted fields. Re-attach any files you selected.
        </p>
      ) : null}

      <fieldset className="space-y-5">
        <legend className="font-heading text-2xl text-ink">Account</legend>
        <TextField name="name" label="Full name" required autoComplete="name" defaultValue={values.name} error={errors.name} />
        <TextField name="email" label="Email" type="email" required autoComplete="email" defaultValue={values.email} error={errors.email} />
        <TextField
          name="mobile"
          label="Mobile"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="+91 98123 45678"
          hint="Include the country code."
          defaultValue={values.mobile}
          error={errors.mobile}
        />
        <TextField
          name="password"
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          hint="At least 10 characters, with a letter and a number."
          error={errors.password}
        />
        <TextField name="country" label="Country of residence" required autoComplete="country-name" defaultValue={values.country} error={errors.country} />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-heading text-2xl text-ink">Business</legend>
        <TextField name="businessName" label="Business name" required defaultValue={values.businessName} error={errors.businessName} />
        <SelectField
          name="businessType"
          label="Business type"
          required
          placeholder="Select a type"
          options={businessTypeOptions}
          defaultValue={values.businessType}
          error={errors.businessType}
        />
        <TextField
          name="gstNumber"
          label="GST number"
          hint="Optional. 15 characters."
          defaultValue={values.gstNumber}
          error={errors.gstNumber}
        />
        <TextField name="addressLine" label="Street address" required autoComplete="street-address" defaultValue={values.addressLine} error={errors.addressLine} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="city" label="City" required autoComplete="address-level2" defaultValue={values.city} error={errors.city} />
          <TextField name="state" label="State / region" required autoComplete="address-level1" defaultValue={values.state} error={errors.state} />
          <TextField name="businessCountry" label="Business country" required defaultValue={values.businessCountry} error={errors.businessCountry} />
          <TextField name="pincode" label="PIN / postal code" hint="Optional." defaultValue={values.pincode} error={errors.pincode} />
        </div>
        <TextField
          name="yearsInBusiness"
          label="Years in business"
          type="number"
          inputMode="numeric"
          required
          defaultValue={values.yearsInBusiness}
          error={errors.yearsInBusiness}
        />
        <TextField
          name="specialties"
          label="Specialties"
          required
          hint="Comma-separated, for example: Ruby, Sapphire, Emerald."
          defaultValue={values.specialties}
          error={errors.specialties}
        />
        <CheckboxGroupField
          name="categoryIds"
          label="Gemstone categories you deal in"
          required
          hint="Choose at least one. Buyers' requirements are matched to sellers by category."
          options={categoryOptions}
          defaultValues={state.selectedCategoryIds}
          error={errors.categoryIds}
        />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-heading text-2xl text-ink">Documents</legend>
        <p className="text-sm text-ink-soft">
          Upload PDF, JPEG or PNG files. Documents are private and used only to verify your application.
        </p>
        <FileField name="idProof" label="ID proof" required hint="Passport, Aadhaar, driving licence or similar." error={errors.idProof} />
        <FileField name="businessProof" label="Business proof" required hint="GST certificate, trade licence or registration." error={errors.businessProof} />
        {errors.certificates ? <p className="text-sm text-danger">{errors.certificates}</p> : null}

        <div className="space-y-6">
          <p className="text-sm font-medium text-ink">Gemstone certificates (optional, up to {CERTIFICATE_SLOTS})</p>
          {Array.from({ length: CERTIFICATE_SLOTS }, (_, index) => (
            <div key={index} className="space-y-4 border border-line bg-surface-raised p-4">
              <FileField name={`certificate_${index}_file`} label={`Certificate ${index + 1}`} error={errors[`certificate_${index}_file`]} />
              <SelectField
                name={`certificate_${index}_lab`}
                label="Issuing lab"
                placeholder="Select a lab"
                options={labOptions}
                defaultValue={values[`certificate_${index}_lab`]}
                error={errors[`certificate_${index}_lab`]}
              />
              <TextField
                name={`certificate_${index}_labOther`}
                label="Lab name (if Other)"
                hint="Only needed when the lab is Other. Up to 80 characters."
                defaultValue={values[`certificate_${index}_labOther`]}
                error={errors[`certificate_${index}_labOther`]}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-4 border-t border-line pt-6">
        <p className="text-sm text-ink-soft">We will email you to verify your address before review.</p>
        <button
          type="submit"
          disabled={pending}
          className=" bg-brand px-5 py-3 text-sm font-medium text-ivory hover:bg-brand-strong disabled:opacity-60"
        >
          {pending ? "Submitting..." : "Submit application"}
        </button>
      </div>
    </form>
  );
}
