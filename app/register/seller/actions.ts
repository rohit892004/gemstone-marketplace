"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getClientIp } from "@/lib/security/client-ip";
import { extractSellerForm } from "@/lib/seller/parse-form";
import { registerSeller } from "@/lib/seller/register-seller";
import { attributeSellerReferral } from "./referral";

export interface SellerFormState {
  fieldErrors?: Record<string, string>;
  formError?: string;
  /** Submitted text values, returned so the form can repopulate after an error. */
  values?: Record<string, string>;
  /** Submitted category ids, returned so the checkboxes stay ticked after an error. */
  selectedCategoryIds?: string[];
}

export async function registerSellerAction(
  _previous: SellerFormState,
  formData: FormData,
): Promise<SellerFormState> {
  const input = await extractSellerForm(formData);
  const ip = getClientIp(await headers());
  const result = await registerSeller(input, { ip });

  if (result.ok) {
    // Referral attribution is best-effort and never changes the outcome the applicant sees.
    const ref = formData.get("ref");
    await attributeSellerReferral({ email: input.email, ref: typeof ref === "string" ? ref : null });
    redirect("/check-email");
  }

  const selectedCategoryIds = input.categoryIds;
  const values: Record<string, string> = {
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    country: input.country,
    businessName: input.businessName,
    businessType: input.businessType,
    gstNumber: input.gstNumber,
    addressLine: input.addressLine,
    city: input.city,
    state: input.state,
    businessCountry: input.businessCountry,
    pincode: input.pincode,
    yearsInBusiness: input.yearsInBusiness,
    specialties: input.specialties.join(", "),
  };
  input.certificates.forEach((slot, index) => {
    values[`certificate_${index}_lab`] = slot.labCode;
    values[`certificate_${index}_labOther`] = slot.labOther;
  });

  if (result.reason === "validation") {
    return { fieldErrors: result.fieldErrors, values, selectedCategoryIds };
  }
  if (result.reason === "rate_limited") {
    return {
      formError: "Too many registration attempts from your network. Please try again later.",
      values,
      selectedCategoryIds,
    };
  }
  return { formError: "We could not create your account. Please try again.", values, selectedCategoryIds };
}
