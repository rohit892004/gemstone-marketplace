import { getEnv } from "@/lib/config/env";
import { sanitizeFileName } from "@/lib/seller/sanitize-filename";
import type { CertificateLabOption } from "@/lib/seller/labs";
import {
  LAB_OTHER_MAX,
  MAX_CERTIFICATES,
  type FieldErrors,
  type RawCertificate,
  type SellerRegistrationInput,
  type UploadedFile,
  type Validated,
  type ValidatedFile,
  type ValidatedSellerRegistration,
} from "@/lib/seller/types";
import { uploadErrorMessage, validateUpload } from "@/lib/storage/upload-validation";
import { buyerRegisterSchema, sellerBusinessSchema } from "@/lib/validation/schemas";
import { z } from "zod";

/**
 * Server-side validation of a seller application. Pure: the caller supplies the active labs.
 * Field error keys match the form field names so each message lands on the right input.
 */

const labOtherSchema = z
  .string()
  .trim()
  .min(1, "Enter the lab name")
  .max(LAB_OTHER_MAX, `Use at most ${LAB_OTHER_MAX} characters`);

function issuesToErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
  rename: Record<string, string> = {},
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const first = String(issue.path[0] ?? "form");
    const key = rename[first] ?? first;
    errors[key] ??= issue.message;
  }
  return errors;
}

function validateFile(file: UploadedFile | null, fieldKey: string, errors: FieldErrors): ValidatedFile | null {
  if (!file) {
    errors[fieldKey] = "Upload a file";
    return null;
  }
  const maxBytes = getEnv().UPLOAD_MAX_MB * 1024 * 1024;
  if (file.size > maxBytes || file.data.length > maxBytes) {
    errors[fieldKey] = uploadErrorMessage("too_large");
    return null;
  }
  const check = validateUpload(file.data);
  if (!check.ok) {
    errors[fieldKey] = uploadErrorMessage(check.reason);
    return null;
  }
  return {
    fileName: sanitizeFileName(file.name),
    data: file.data,
    mimeType: check.mimeType,
    ext: check.ext,
    sizeBytes: check.sizeBytes,
  };
}

/** A certificate slot counts as used when it has a file or any lab input. */
function isUsedSlot(slot: RawCertificate): boolean {
  return slot.file !== null || slot.labCode.trim() !== "" || slot.labOther.trim() !== "";
}

export function validateSellerRegistration(
  input: SellerRegistrationInput,
  labs: readonly CertificateLabOption[],
): Validated<ValidatedSellerRegistration> {
  const errors: FieldErrors = {};

  const account = buyerRegisterSchema.safeParse({
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    password: input.password,
    country: input.country,
  });
  if (!account.success) Object.assign(errors, issuesToErrors(account.error.issues));

  const yearsRaw = input.yearsInBusiness.trim();
  const business = sellerBusinessSchema.safeParse({
    businessName: input.businessName,
    businessType: input.businessType,
    gstNumber: input.gstNumber,
    addressLine: input.addressLine,
    city: input.city,
    state: input.state,
    country: input.businessCountry,
    pincode: input.pincode,
    yearsInBusiness: /^\d{1,3}$/.test(yearsRaw) ? Number(yearsRaw) : Number.NaN,
    specialties: input.specialties,
  });
  if (!business.success) {
    Object.assign(errors, issuesToErrors(business.error.issues, { country: "businessCountry" }));
  }

  const idProof = validateFile(input.idProof, "idProof", errors);
  const businessProof = validateFile(input.businessProof, "businessProof", errors);

  const usedSlots = input.certificates
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => isUsedSlot(slot));
  if (usedSlots.length > MAX_CERTIFICATES) {
    errors.certificates = `Upload at most ${MAX_CERTIFICATES} certificates`;
  }

  const certificates: ValidatedSellerRegistration["certificates"] = [];
  for (const { slot, index } of usedSlots.slice(0, MAX_CERTIFICATES)) {
    const fileKey = `certificate_${index}_file`;
    const file = validateFile(slot.file, fileKey, errors);

    const lab = labs.find((candidate) => candidate.code === slot.labCode.trim());
    if (!lab) {
      errors[`certificate_${index}_lab`] = "Select the certificate lab";
      continue;
    }

    let labOther: string | null = null;
    if (lab.isOther) {
      const parsed = labOtherSchema.safeParse(slot.labOther);
      if (!parsed.success) {
        errors[`certificate_${index}_labOther`] = parsed.error.issues[0]?.message ?? "Enter the lab name";
      } else {
        labOther = parsed.data;
      }
    }

    if (file) certificates.push({ file, labId: lab.id, labOther });
  }

  if (!idProof) errors.idProof ??= "Upload your ID proof";
  if (!businessProof) errors.businessProof ??= "Upload your business proof";

  if (Object.keys(errors).length > 0 || !account.success || !business.success || !idProof || !businessProof) {
    return { ok: false, fieldErrors: errors };
  }

  return {
    ok: true,
    value: {
      account: account.data,
      business: business.data,
      idProof,
      businessProof,
      certificates,
    },
  };
}
