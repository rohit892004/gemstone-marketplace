import { type ContactKind, moderateContactDetails } from "@/lib/messaging/moderation";
import { parseMajorToMinor } from "@/lib/money/money";

/**
 * Pure validation for buyer requirements. No database access. The service calls this before any write.
 *
 * Free text (gemstone type, shape, origin preference, notes) goes through contact-detail masking,
 * so the stored values never contain raw phone numbers, emails or handles.
 * Money is parsed to integer minor units. Carat is a 3-decimal string for a Decimal column.
 */

export const REQUIREMENT_LIMITS = {
  gemstoneTypeMin: 2,
  gemstoneTypeMax: 60,
  shapeMax: 60,
  originMax: 80,
  notesMax: 2000,
  caratMin: 0.01,
  caratMax: 100000,
  quantityMax: 10000,
  /** A deadline may be at most this many days ahead. */
  deadlineMaxDays: 730,
} as const;

export interface RequirementRaw {
  gemstoneType: string;
  categoryId: string;
  shape: string;
  caratMin: string;
  caratMax: string;
  budgetMin: string;
  budgetMax: string;
  currency: string;
  certificateNeeded: string | boolean | null;
  originPreference: string;
  quantity: string;
  /** YYYY-MM-DD from a date input. Empty for no deadline. */
  deadline: string;
  notes: string;
}

export type RequirementField = keyof RequirementRaw;

export interface RequirementValues {
  gemstoneType: string;
  categoryId: string | null;
  shape: string | null;
  caratMin: string | null;
  caratMax: string | null;
  budgetMinMinor: bigint | null;
  budgetMaxMinor: bigint | null;
  currency: "INR" | "USD";
  certificateNeeded: boolean;
  originPreference: string | null;
  quantity: number;
  deadline: Date | null;
  notes: string | null;
}

export type RequirementCheck =
  | {
      ok: true;
      values: RequirementValues;
      /** True when contact details were masked in any free-text field. */
      flagged: boolean;
      kinds: ContactKind[];
    }
  | { ok: false; fieldErrors: Partial<Record<RequirementField, string>> };

const CARAT_RE = /^\d{1,6}(\.\d{1,3})?$/;
const QUANTITY_RE = /^\d{1,5}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Trimmed text, or null when blank. Over-long text is rejected by the caller, never cut silently. */
function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Parses a carat string. Returns the normalised 3-decimal string, or null when invalid. */
export function parseCarat(input: string): string | null {
  const s = input.trim();
  if (!CARAT_RE.test(s)) return null;
  const n = Number(s);
  if (n < REQUIREMENT_LIMITS.caratMin || n > REQUIREMENT_LIMITS.caratMax) return null;
  return n.toFixed(3);
}

/** Parses YYYY-MM-DD as the end of that UTC day. Returns null when the date does not exist. */
export function parseDeadline(input: string): Date | null {
  const s = input.trim();
  if (!DATE_RE.test(s)) return null;
  const startOfDay = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(startOfDay.getTime()) || startOfDay.toISOString().slice(0, 10) !== s) return null;
  return new Date(`${s}T23:59:59.999Z`);
}

export function validateRequirementInput(raw: RequirementRaw, now: Date): RequirementCheck {
  const errors: Partial<Record<RequirementField, string>> = {};
  const kinds = new Set<ContactKind>();
  let flagged = false;

  // Masks free text. Records the kinds found, never the values.
  const mask = (value: string | null): string | null => {
    if (value === null) return null;
    const result = moderateContactDetails(value);
    if (result.flagged) {
      flagged = true;
      result.kinds.forEach((k) => kinds.add(k));
    }
    return result.text;
  };

  const gemstoneTypeRaw = raw.gemstoneType.trim();
  if (gemstoneTypeRaw.length < REQUIREMENT_LIMITS.gemstoneTypeMin || gemstoneTypeRaw.length > REQUIREMENT_LIMITS.gemstoneTypeMax) {
    errors.gemstoneType = `Enter the gemstone type (${REQUIREMENT_LIMITS.gemstoneTypeMin} to ${REQUIREMENT_LIMITS.gemstoneTypeMax} characters).`;
  }

  const shapeRaw = clean(raw.shape);
  if (shapeRaw && shapeRaw.length > REQUIREMENT_LIMITS.shapeMax) errors.shape = `Keep the shape to ${REQUIREMENT_LIMITS.shapeMax} characters.`;

  const originRaw = clean(raw.originPreference);
  if (originRaw && originRaw.length > REQUIREMENT_LIMITS.originMax) {
    errors.originPreference = `Keep the origin preference to ${REQUIREMENT_LIMITS.originMax} characters.`;
  }

  const notesRaw = clean(raw.notes);
  if (notesRaw && notesRaw.length > REQUIREMENT_LIMITS.notesMax) {
    errors.notes = `Keep notes to ${REQUIREMENT_LIMITS.notesMax} characters or fewer.`;
  }

  const categoryId = clean(raw.categoryId);
  // Every requirement needs a category: sellers only see requirements in their own categories.
  if (!categoryId) errors.categoryId = "Choose the gemstone category this requirement is for.";

  // Carat range.
  let caratMin: string | null = null;
  let caratMax: string | null = null;
  if (raw.caratMin.trim()) {
    caratMin = parseCarat(raw.caratMin);
    if (!caratMin) errors.caratMin = "Enter a carat weight from 0.01 to 100,000, with up to 3 decimals.";
  }
  if (raw.caratMax.trim()) {
    caratMax = parseCarat(raw.caratMax);
    if (!caratMax) errors.caratMax = "Enter a carat weight from 0.01 to 100,000, with up to 3 decimals.";
  }
  if (caratMin && caratMax && Number(caratMin) > Number(caratMax)) {
    errors.caratMax = "The maximum carat must be the same as or more than the minimum.";
  }

  // Budget range, in minor units of the chosen currency.
  const parseBudget = (value: string): bigint | null | "invalid" => {
    if (!value.trim()) return null;
    const parsed = parseMajorToMinor(value);
    if (!parsed.ok) return "invalid";
    return parsed.minor;
  };
  const budgetMin = parseBudget(raw.budgetMin);
  const budgetMax = parseBudget(raw.budgetMax);
  if (budgetMin === "invalid") errors.budgetMin = "Enter the budget as a number, for example 500,000.";
  if (budgetMax === "invalid") errors.budgetMax = "Enter the budget as a number, for example 900,000.";
  if (typeof budgetMin === "bigint" && typeof budgetMax === "bigint" && budgetMin > budgetMax) {
    errors.budgetMax = "The maximum budget must be the same as or more than the minimum.";
  }

  const currencyRaw = raw.currency.trim() || "INR";
  if (currencyRaw !== "INR" && currencyRaw !== "USD") errors.currency = "Choose INR or USD.";

  const quantityRaw = raw.quantity.trim();
  const quantity = Number(quantityRaw);
  if (!QUANTITY_RE.test(quantityRaw) || quantity < 1 || quantity > REQUIREMENT_LIMITS.quantityMax) {
    errors.quantity = `Enter a quantity from 1 to ${REQUIREMENT_LIMITS.quantityMax.toLocaleString("en-IN")}.`;
  }

  // Deadline: optional, must be a real date in the future and within the allowed window.
  let deadline: Date | null = null;
  if (raw.deadline.trim()) {
    deadline = parseDeadline(raw.deadline);
    if (!deadline) {
      errors.deadline = "Enter a valid date.";
    } else if (deadline.getTime() <= now.getTime()) {
      errors.deadline = "Choose a date in the future.";
    } else if (deadline.getTime() > now.getTime() + REQUIREMENT_LIMITS.deadlineMaxDays * 24 * 60 * 60 * 1000) {
      errors.deadline = "Choose a date within the next two years.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  const cert = raw.certificateNeeded;
  const certificateNeeded = cert === true || cert === "on" || cert === "true" || cert === "1";

  // Build the values first: masking sets `flagged` and `kinds`, so they must be read after it runs.
  const values: RequirementValues = {
    gemstoneType: mask(gemstoneTypeRaw) ?? gemstoneTypeRaw,
    categoryId,
    shape: mask(shapeRaw),
    caratMin,
    caratMax,
    budgetMinMinor: typeof budgetMin === "bigint" ? budgetMin : null,
    budgetMaxMinor: typeof budgetMax === "bigint" ? budgetMax : null,
    currency: currencyRaw as "INR" | "USD",
    certificateNeeded,
    originPreference: mask(originRaw),
    quantity,
    deadline,
    notes: mask(notesRaw),
  };

  return { ok: true, values, flagged, kinds: [...kinds] };
}

/** Reads the raw requirement fields from a submitted form. Missing fields become empty strings. */
export function requirementRawFromFormData(formData: FormData): RequirementRaw {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const cert = formData.get("certificateNeeded");
  return {
    gemstoneType: text("gemstoneType"),
    categoryId: text("categoryId"),
    shape: text("shape"),
    caratMin: text("caratMin"),
    caratMax: text("caratMax"),
    budgetMin: text("budgetMin"),
    budgetMax: text("budgetMax"),
    currency: text("currency"),
    certificateNeeded: typeof cert === "string" ? cert : null,
    originPreference: text("originPreference"),
    quantity: text("quantity"),
    deadline: text("deadline"),
    notes: text("notes"),
  };
}

/** Form defaults for the edit page, from a stored requirement. Money becomes major units, dates YYYY-MM-DD. */
export function requirementFormDefaults(row: {
  gemstoneType: string;
  categoryId: string | null;
  shape: string | null;
  caratMin: { toString(): string } | null;
  caratMax: { toString(): string } | null;
  budgetMinMinor: bigint | null;
  budgetMaxMinor: bigint | null;
  currency: string;
  certificateNeeded: boolean;
  originPreference: string | null;
  quantity: number;
  deadline: Date | null;
  notes: string | null;
}): RequirementRaw {
  const major = (minor: bigint | null) => (minor === null ? "" : (Number(minor) / 100).toString());
  return {
    gemstoneType: row.gemstoneType,
    categoryId: row.categoryId ?? "",
    shape: row.shape ?? "",
    caratMin: row.caratMin ? row.caratMin.toString() : "",
    caratMax: row.caratMax ? row.caratMax.toString() : "",
    budgetMin: major(row.budgetMinMinor),
    budgetMax: major(row.budgetMaxMinor),
    currency: row.currency,
    certificateNeeded: row.certificateNeeded ? "on" : null,
    originPreference: row.originPreference ?? "",
    quantity: String(row.quantity),
    deadline: row.deadline ? row.deadline.toISOString().slice(0, 10) : "",
    notes: row.notes ?? "",
  };
}
