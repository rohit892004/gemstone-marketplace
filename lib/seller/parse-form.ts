import { getEnv } from "@/lib/config/env";
import type { CategoryOption } from "@/lib/seller/category-selection";
import { MAX_CATEGORY_VALUES } from "@/lib/seller/category-selection";
import type { CertificateLabOption } from "@/lib/seller/labs";
import { validateSellerRegistration } from "@/lib/seller/validate";
import type { RawCertificate, SellerRegistrationInput, UploadedFile, Validated, ValidatedSellerRegistration } from "@/lib/seller/types";

/**
 * FormData -> typed input. Extraction only reads strings and files; every rule lives in
 * validateSellerRegistration(). Files above the size limit are not read into memory.
 */

const CERT_KEY = /^certificate_(\d{1,2})_(file|lab|labOther)$/;
const MAX_SLOT_INDEX = 99;

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

async function readFile(form: FormData, key: string): Promise<UploadedFile | null> {
  const value = form.get(key);
  // Browsers send an empty File (size 0) for an untouched file input.
  if (!(value instanceof File) || value.size === 0) return null;
  const maxBytes = getEnv().UPLOAD_MAX_MB * 1024 * 1024;
  const data = value.size > maxBytes ? Buffer.alloc(0) : Buffer.from(await value.arrayBuffer());
  return { name: value.name, size: value.size, data };
}

function splitSpecialties(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export async function extractSellerForm(form: FormData): Promise<SellerRegistrationInput> {
  const slots = new Map<number, RawCertificate>();
  for (const key of form.keys()) {
    const match = CERT_KEY.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    if (index > MAX_SLOT_INDEX) continue;
    if (!slots.has(index)) slots.set(index, { file: null, labCode: "", labOther: "" });
  }

  const certificates: RawCertificate[] = [];
  const indices = [...slots.keys()].sort((a, b) => a - b);
  for (const index of indices) {
    certificates[index] = {
      file: await readFile(form, `certificate_${index}_file`),
      labCode: text(form, `certificate_${index}_lab`),
      labOther: text(form, `certificate_${index}_labOther`),
    };
  }
  // Fill gaps so array position equals slot index (validation reports by index).
  for (let i = 0; i < certificates.length; i++) {
    certificates[i] ??= { file: null, labCode: "", labOther: "" };
  }

  return {
    name: text(form, "name"),
    email: text(form, "email"),
    mobile: text(form, "mobile"),
    password: text(form, "password"),
    country: text(form, "country"),
    businessName: text(form, "businessName"),
    businessType: text(form, "businessType"),
    gstNumber: text(form, "gstNumber"),
    addressLine: text(form, "addressLine"),
    city: text(form, "city"),
    state: text(form, "state"),
    businessCountry: text(form, "businessCountry"),
    pincode: text(form, "pincode"),
    yearsInBusiness: text(form, "yearsInBusiness"),
    specialties: splitSpecialties(text(form, "specialties")),
    categoryIds: form
      .getAll("categoryIds")
      .filter((value): value is string => typeof value === "string")
      .slice(0, MAX_CATEGORY_VALUES),
    idProof: await readFile(form, "idProof"),
    businessProof: await readFile(form, "businessProof"),
    certificates,
  };
}

/** Extracts and validates a seller application form. Returns field errors keyed by form field name. */
export async function parseSellerForm(
  form: FormData,
  labs: readonly CertificateLabOption[],
  categories: readonly CategoryOption[],
): Promise<Validated<ValidatedSellerRegistration>> {
  return validateSellerRegistration(await extractSellerForm(form), labs, categories);
}
