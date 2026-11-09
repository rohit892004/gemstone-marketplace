import type { BuyerRegisterInput, SellerBusinessInput } from "@/lib/validation/schemas";

export const MAX_CERTIFICATES = 5;
export const LAB_OTHER_MAX = 80;

/** A file as received from the request. `size` is the claimed size; `data` is the bytes. */
export interface UploadedFile {
  name: string;
  size: number;
  data: Buffer;
}

export interface RawCertificate {
  file: UploadedFile | null;
  labCode: string;
  labOther: string;
}

/** Form data after extraction, before validation. Strings exactly as submitted. */
export interface SellerRegistrationInput {
  name: string;
  email: string;
  mobile: string;
  password: string;
  country: string;
  businessName: string;
  businessType: string;
  gstNumber: string;
  addressLine: string;
  city: string;
  state: string;
  businessCountry: string;
  pincode: string;
  yearsInBusiness: string;
  specialties: string[];
  idProof: UploadedFile | null;
  businessProof: UploadedFile | null;
  certificates: RawCertificate[];
}

export interface ValidatedFile {
  /** Sanitised display name. Never used in a storage key. */
  fileName: string;
  data: Buffer;
  mimeType: string;
  ext: string;
  sizeBytes: number;
}

export interface ValidatedCertificate {
  file: ValidatedFile;
  labId: string;
  labOther: string | null;
}

export interface ValidatedSellerRegistration {
  account: BuyerRegisterInput;
  business: SellerBusinessInput;
  idProof: ValidatedFile;
  businessProof: ValidatedFile;
  certificates: ValidatedCertificate[];
}

export type FieldErrors = Record<string, string>;
export type Validated<T> = { ok: true; value: T } | { ok: false; fieldErrors: FieldErrors };
