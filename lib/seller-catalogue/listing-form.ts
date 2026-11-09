import { listingInputSchema, type ListingInput } from "@/lib/listings/schema";
import { parseMajorToMinor } from "@/lib/money/money";
import type { SaveIntent } from "@/lib/seller-catalogue/transitions";

/**
 * Listing form: FormData -> validated write values. Every rule lives here or in
 * listingInputSchema, so the server action only does lookups and writes.
 */

export const LISTING_FORM_FIELDS = [
  "title",
  "categoryId",
  "species",
  "variety",
  "shape",
  "cut",
  "caratWeight",
  "dimensions",
  "colour",
  "clarity",
  "origin",
  "treatment",
  "certificateLabId",
  "certificateNo",
  "quantity",
  "priceMode",
  "price",
  "currency",
  "availability",
  "description",
] as const;

export type ListingFormField = (typeof LISTING_FORM_FIELDS)[number] | "intent";

export interface ParsedListingForm {
  input: ListingInput;
  /** null when the price is "on request". */
  priceMinor: bigint | null;
  priceOnRequest: boolean;
  intent: SaveIntent;
  /** Submitted strings, returned so the form can repopulate after a server-side error. */
  values: Record<string, string>;
}

/** Minor units to a form value in major units: 1250000n -> "12500", 1250050n -> "12500.50". */
export function minorToMajorInput(minor: bigint | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  const whole = minor / BigInt(100);
  const frac = minor % BigInt(100);
  return frac === BigInt(0) ? whole.toString() : `${whole}.${frac.toString().padStart(2, "0")}`;
}

/** Form defaults for the editor, from a stored listing. Missing values become empty strings. */
export function listingDefaults(row: {
  title: string;
  categoryId: string | null;
  species: string | null;
  variety: string | null;
  shape: string | null;
  cut: string | null;
  caratWeight: { toString(): string } | null;
  dimensions: string | null;
  colour: string | null;
  clarity: string | null;
  origin: string | null;
  treatment: string | null;
  certificateLabId: string | null;
  certificateNo: string | null;
  quantity: number;
  priceMinor: bigint | null;
  priceOnRequest: boolean;
  currency: string;
  availability: string;
  description: string | null;
}): Record<string, string> {
  return {
    title: row.title,
    categoryId: row.categoryId ?? "",
    species: row.species ?? "",
    variety: row.variety ?? "",
    shape: row.shape ?? "",
    cut: row.cut ?? "",
    caratWeight: row.caratWeight ? row.caratWeight.toString() : "",
    dimensions: row.dimensions ?? "",
    colour: row.colour ?? "",
    clarity: row.clarity ?? "",
    origin: row.origin ?? "",
    treatment: row.treatment ?? "",
    certificateLabId: row.certificateLabId ?? "",
    certificateNo: row.certificateNo ?? "",
    quantity: String(row.quantity),
    priceMode: row.priceOnRequest ? "ON_REQUEST" : "PRICE",
    price: minorToMajorInput(row.priceMinor),
    currency: row.currency,
    availability: row.availability,
    description: row.description ?? "",
  };
}

export type ListingFormParse =
  | { ok: true; value: ParsedListingForm }
  | { ok: false; fieldErrors: Partial<Record<ListingFormField, string>>; values: Record<string, string> };

function readValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of LISTING_FORM_FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === "string" ? raw : "";
  }
  return values;
}

export function parseListingForm(formData: FormData): ListingFormParse {
  const values = readValues(formData);
  const intentRaw = formData.get("intent");
  const intent: SaveIntent = intentRaw === "submit" ? "submit" : "draft";

  const result = listingInputSchema.safeParse(values);
  const fieldErrors: Partial<Record<ListingFormField, string>> = {};

  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key as ListingFormField] = issue.message;
      }
    }
  }

  let priceMinor: bigint | null = null;
  const priceOnRequest = values.priceMode === "ON_REQUEST";
  if (result.success && !priceOnRequest) {
    const price = parseMajorToMinor(values.price);
    if (!price.ok) {
      fieldErrors.price = price.reason === "range" ? "Enter a price between 0.01 and 10,000,000,000" : "Enter a price such as 12500 or 12,500.50";
    } else {
      priceMinor = price.minor;
    }
  }

  if (!result.success || Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values };
  }

  return {
    ok: true,
    value: { input: result.data, priceMinor, priceOnRequest, intent, values },
  };
}
