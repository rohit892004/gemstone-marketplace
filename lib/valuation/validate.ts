import { z } from "zod";
import { moderateContactDetails } from "@/lib/messaging/moderation";
import { parseMajorToMinor } from "@/lib/money/money";
import { CARAT_MAX_MILLI, CARAT_MIN_MILLI, CURRENCIES, QUALITY_GRADES, caratToMilli, type Currency, type QualityGrade } from "./engine";

/**
 * Input rules for valuation requests and valuator decisions. Pure. Every user-written text goes through here
 * before it is stored. Text that carries contact details is refused, never masked: valuation notes are
 * private, but contact must still go through the platform.
 */

export const NOTES_MAX = 1000;
export const CONTACT_REFUSAL = "Notes cannot include phone numbers, email addresses or links. Contact goes through the platform.";

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Empty form fields become null. */
function blankToNull(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

const optionalText = (max: number, label: string) =>
  z.preprocess(blankToNull, z.string().max(max, `${label} must be ${max} characters or fewer.`).nullable());

export const valuationDetailsSchema = z.object({
  gemstoneType: z.preprocess(blankToNull, z.string({ error: "Choose the gemstone type." }).min(2, "Choose the gemstone type.").max(60)),
  categoryId: z.preprocess(blankToNull, z.string().max(40).nullable()),
  shape: optionalText(60, "Shape"),
  carat: z.preprocess(blankToNull, z.string({ error: "Enter the carat weight." }).max(12, "Carat weight is not valid.").nullable()),
  dimensions: optionalText(120, "Dimensions"),
  colour: optionalText(120, "Colour"),
  clarity: optionalText(120, "Clarity"),
  qualityGrade: z.preprocess(blankToNull, z.enum(QUALITY_GRADES).nullable()),
  origin: optionalText(120, "Origin"),
  treatment: optionalText(120, "Treatment"),
  labId: z.preprocess(blankToNull, z.string().max(40).nullable()),
  certificateNumber: optionalText(80, "Certificate number"),
  notes: optionalText(NOTES_MAX, "Notes"),
  currency: z.preprocess(blankToNull, z.enum(CURRENCIES, { error: "Choose INR or USD." })),
});

export interface ValuationDetails {
  gemstoneType: string;
  categoryId: string | null;
  shape: string | null;
  caratMilli: number | null;
  dimensions: string | null;
  colour: string | null;
  clarity: string | null;
  qualityGrade: QualityGrade | null;
  origin: string | null;
  treatment: string | null;
  labId: string | null;
  certificateNumber: string | null;
  notes: string | null;
  currency: Currency;
}

/**
 * Parses the details form. Carat is required and must be a valid weight (0.01 to 10,000 ct, at most three
 * decimals). Notes are checked for contact details.
 */
export function parseValuationDetails(raw: unknown): ValidationResult<ValuationDetails> {
  const parsed = valuationDetailsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  }
  const data = parsed.data;
  if (data.carat === null) return { ok: false, error: "Enter the carat weight." };
  const caratMilli = caratToMilli(data.carat);
  if (caratMilli === null || caratMilli < CARAT_MIN_MILLI || caratMilli > CARAT_MAX_MILLI) {
    return { ok: false, error: "Carat weight must be between 0.01 and 10,000 ct, with at most three decimals." };
  }
  if (data.notes !== null && moderateContactDetails(data.notes).flagged) {
    return { ok: false, error: CONTACT_REFUSAL };
  }
  // Every free-text field can reach the valuator, the PDF or the public verification page, so each is checked.
  const freeText: Array<[string, string | null]> = [
    ["Gemstone type", data.gemstoneType],
    ["Shape", data.shape],
    ["Dimensions", data.dimensions],
    ["Colour", data.colour],
    ["Clarity", data.clarity],
    ["Origin", data.origin],
    ["Treatment", data.treatment],
    ["Certificate number", data.certificateNumber],
  ];
  for (const [label, value] of freeText) {
    if (value !== null && moderateContactDetails(value).flagged) {
      return { ok: false, error: `${label} cannot include phone numbers, email addresses or links.` };
    }
  }
  return {
    ok: true,
    value: {
      gemstoneType: data.gemstoneType,
      categoryId: data.categoryId,
      shape: data.shape,
      caratMilli,
      dimensions: data.dimensions,
      colour: data.colour,
      clarity: data.clarity,
      qualityGrade: data.qualityGrade,
      origin: data.origin,
      treatment: data.treatment,
      labId: data.labId,
      certificateNumber: data.certificateNumber,
      notes: data.notes,
      currency: data.currency,
    },
  };
}

/** A short free-text message between requester and valuator, or a decision reason. Refuses contact details. */
export function parseThreadText(raw: unknown, label: string, max = NOTES_MAX): ValidationResult<string> {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text.length === 0) return { ok: false, error: `Enter ${label}.` };
  if (text.length > max) return { ok: false, error: `${label} must be ${max} characters or fewer.` };
  if (moderateContactDetails(text).flagged) return { ok: false, error: CONTACT_REFUSAL };
  return { ok: true, value: text };
}

export const CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export interface SignOffInput {
  estimateMinor: bigint;
  lowMinor: bigint;
  highMinor: bigint;
  confidence: ConfidenceLevel;
  notes: string;
}

/**
 * Valuator sign-off. Amounts are typed in major units ("12500.50") and stored as minor units. INR and USD both
 * have two minor-unit digits, so one parser serves both.
 */
export function parseSignOff(raw: {
  estimate: unknown;
  low: unknown;
  high: unknown;
  confidence: unknown;
  notes: unknown;
}): ValidationResult<SignOffInput> {
  const amounts: bigint[] = [];
  for (const [label, value] of [
    ["Estimate", raw.estimate],
    ["Low", raw.low],
    ["High", raw.high],
  ] as const) {
    const parsed = parseMajorToMinor(typeof value === "string" ? value : "");
    if (!parsed.ok) return { ok: false, error: `${label} must be an amount greater than zero, with at most two decimals.` };
    amounts.push(parsed.minor);
  }
  const [estimateMinor, lowMinor, highMinor] = amounts;
  if (!(lowMinor <= estimateMinor && estimateMinor <= highMinor)) {
    return { ok: false, error: "The range must hold the estimate: low, then estimate, then high." };
  }
  if (typeof raw.confidence !== "string" || !(CONFIDENCE_LEVELS as readonly string[]).includes(raw.confidence)) {
    return { ok: false, error: "Choose a confidence level." };
  }
  const notes = parseThreadText(raw.notes, "a sign-off note");
  if (!notes.ok) return notes;
  return {
    ok: true,
    value: { estimateMinor, lowMinor, highMinor, confidence: raw.confidence as ConfidenceLevel, notes: notes.value },
  };
}
