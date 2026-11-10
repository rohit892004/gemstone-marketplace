import { formatMoney } from "@/lib/money/money";

/**
 * Rule-based INDICATIVE valuation engine. Pure: no database, no clock, no images.
 *
 * The estimate is price per carat from a reference table (gemstone type x quality grade x carat band),
 * adjusted by multipliers for origin, treatment and certificate lab. The output carries a confidence
 * level, a range, the factors used, and the reasons the request must go to an expert.
 *
 * The engine never looks at images. Images are for the expert reviewer. Results are never presented as
 * a certified appraisal.
 *
 * Money is integer minor units (BigInt). Carat is integer thousandths of a carat (milli-carats), so no
 * floating point reaches the price. Multipliers are basis points (10000 = x1).
 */

export const CURRENCIES = ["INR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const QUALITY_GRADES = ["PREMIUM", "FINE", "STANDARD", "COMMERCIAL"] as const;
export type QualityGrade = (typeof QUALITY_GRADES)[number];

export const QUALITY_GRADE_LABELS: Record<QualityGrade, string> = {
  PREMIUM: "Premium",
  FINE: "Fine",
  STANDARD: "Standard",
  COMMERCIAL: "Commercial",
};

/** Carat limits: 0.01 ct to 10,000 ct, at most three decimal places. */
export const CARAT_MIN_MILLI = 10;
export const CARAT_MAX_MILLI = 10_000_000;

export const CARAT_BANDS = [
  { key: "UNDER_1", label: "Under 1 ct", minMilli: 0, maxMilli: 1000 },
  { key: "1_TO_2", label: "1 to 2 ct", minMilli: 1000, maxMilli: 2000 },
  { key: "2_TO_5", label: "2 to 5 ct", minMilli: 2000, maxMilli: 5000 },
  { key: "5_PLUS", label: "5 ct and over", minMilli: 5000, maxMilli: Number.POSITIVE_INFINITY },
] as const;
export type CaratBandKey = (typeof CARAT_BANDS)[number]["key"];

/** Range half-width per confidence level, in basis points (1000 = plus or minus 10%). */
export const CONFIDENCE_SPREAD_BPS = { HIGH: 1000, MEDIUM: 2000, LOW: 3500 } as const;

export type Confidence = keyof typeof CONFIDENCE_SPREAD_BPS;
export type ExpertReason = "NO_REFERENCE" | "INCOMPLETE" | "LOW_CONFIDENCE" | "ABOVE_THRESHOLD" | "REQUESTED";

export const MAX_COMPLETENESS = 9;

export interface ReferenceRow {
  gemstoneType: string;
  qualityGrade: QualityGrade;
  band: CaratBandKey;
  pricePerCaratMinor: bigint;
  currency: Currency;
}

/** Multiplier tables keyed by normalised name, in basis points. "none" is the no-certificate lab key. */
export interface MultiplierTable {
  origin: Record<string, number>;
  treatment: Record<string, number>;
  lab: Record<string, number>;
}

export interface ValuationInput {
  gemstoneType: string;
  qualityGrade: QualityGrade | null;
  caratMilli: number | null;
  currency: Currency;
  origin: string | null;
  treatment: string | null;
  /** CertificateLab.code, or null when the stone has no lab certificate. */
  labCode: string | null;
  certificateNumber: string | null;
  dimensionsGiven: boolean;
  colourGiven: boolean;
  clarityGiven: boolean;
}

export interface EngineEstimate {
  estimateMinor: bigint;
  lowMinor: bigint;
  highMinor: bigint;
  currency: Currency;
}

export interface EngineOutput {
  estimate: EngineEstimate | null;
  confidence: Confidence;
  /** 0 to MAX_COMPLETENESS. The points behind the confidence level. */
  completenessScore: number;
  /** Plain-language factors the estimate used. Never contains images or requester identity. */
  factors: string[];
  expertReasons: ExpertReason[];
}

/** Normalises a free-text key (origin, treatment) for lookup: trims, lower-cases, collapses spaces. */
export function normaliseKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Parses a carat weight typed by a user into milli-carats. Null when invalid: not a finite number, outside
 * 0.01 to 10,000 ct, or with more than three decimal places.
 */
export function caratToMilli(input: string | number): number | null {
  const value = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isFinite(value)) return null;
  const milli = Math.round(value * 1000);
  if (Math.abs(value * 1000 - milli) > 1e-6) return null;
  if (milli < CARAT_MIN_MILLI || milli > CARAT_MAX_MILLI) return null;
  return milli;
}

/** The carat band for a weight in milli-carats. Null for weights outside the valid range. */
export function caratBandFor(caratMilli: number): CaratBandKey | null {
  if (!Number.isInteger(caratMilli) || caratMilli < CARAT_MIN_MILLI || caratMilli > CARAT_MAX_MILLI) return null;
  const band = CARAT_BANDS.find((b) => caratMilli >= b.minMilli && caratMilli < b.maxMilli);
  return band ? band.key : null;
}

const BPS = BigInt(10000);
const BPS_CUBED = BPS * BPS * BPS; // three multipliers (origin, treatment, lab), each in basis points

/** Integer division rounded half up, for non-negative BigInts. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / BigInt(2)) / denominator;
}

/** A multiplier in basis points. Missing or invalid values count as x1. */
function bpsOf(value: number | undefined): bigint {
  if (value === undefined || !Number.isInteger(value) || value <= 0) return BPS;
  return BigInt(value);
}

/** Own-property check. A plain `in` test would also match inherited names such as "constructor". */
function hasOwn(table: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(table, key);
}

/** Known values count toward confidence and adjust the estimate. "unknown" and missing values do not. */
function isKnown(key: string | null, table: Record<string, number>): key is string {
  return key !== null && key !== "unknown" && hasOwn(table, key);
}

/** Points toward confidence. See confidenceFor and the rules on runValuationEngine. */
export function completenessPoints(input: ValuationInput, multipliers: MultiplierTable): number {
  let score = 0;
  if (input.labCode !== null) score += 2;
  if (input.certificateNumber !== null && input.certificateNumber.trim().length > 0) score += 1;
  if (input.origin !== null && isKnown(normaliseKey(input.origin), multipliers.origin)) score += 1;
  if (input.treatment !== null && isKnown(normaliseKey(input.treatment), multipliers.treatment)) score += 1;
  if (input.qualityGrade !== null) score += 1;
  if (input.dimensionsGiven) score += 1;
  if (input.colourGiven) score += 1;
  if (input.clarityGiven) score += 1;
  return score;
}

/**
 * Confidence rules:
 *  - HIGH: 7 or more points AND a lab certificate. A stone without a lab certificate is never HIGH.
 *  - MEDIUM: 4 or more points.
 *  - LOW: anything else, including every incomplete request.
 */
export function confidenceFor(score: number, hasLab: boolean): Confidence {
  if (score >= 7 && hasLab) return "HIGH";
  if (score >= 4) return "MEDIUM";
  return "LOW";
}

/**
 * Runs the rule-based estimate. Rules, in order:
 *  1. Missing gemstone type, carat or quality grade: no estimate, reason INCOMPLETE.
 *  2. No reference row for type, grade, carat band and currency: no estimate, reason NO_REFERENCE.
 *  3. Otherwise: price per carat x carat, x origin x treatment x lab multiplier. Unknown or missing origin
 *     and treatment use x1. No certificate uses the "none" lab multiplier. The range is the estimate plus
 *     or minus the confidence spread.
 *  4. Confidence from completeness (confidenceFor). LOW confidence is routed to an expert. The admin
 *     threshold is applied separately by applyExpertThreshold.
 */
export function runValuationEngine(
  input: ValuationInput,
  reference: readonly ReferenceRow[],
  multipliers: MultiplierTable,
): EngineOutput {
  const factors: string[] = [];
  const reasons: ExpertReason[] = [];
  const score = completenessPoints(input, multipliers);
  const gemstoneType = input.gemstoneType.trim();

  const noEstimate = (reason: ExpertReason): EngineOutput => {
    reasons.push(reason, "LOW_CONFIDENCE");
    return { estimate: null, confidence: "LOW", completenessScore: score, factors, expertReasons: unique(reasons) };
  };

  if (gemstoneType.length === 0 || input.caratMilli === null || input.qualityGrade === null) {
    factors.push("Gemstone type, carat weight and quality grade are needed for an automatic estimate.");
    return noEstimate("INCOMPLETE");
  }
  const band = caratBandFor(input.caratMilli);
  if (band === null) {
    factors.push("Carat weight is outside the range the estimate covers.");
    return noEstimate("INCOMPLETE");
  }

  const row = reference.find(
    (r) =>
      normaliseKey(r.gemstoneType) === normaliseKey(gemstoneType) &&
      r.qualityGrade === input.qualityGrade &&
      r.band === band &&
      r.currency === input.currency,
  );
  if (!row) {
    factors.push(`No reference price for ${gemstoneType}, ${QUALITY_GRADE_LABELS[input.qualityGrade]} grade, in ${input.currency}.`);
    return noEstimate("NO_REFERENCE");
  }

  const bandLabel = CARAT_BANDS.find((b) => b.key === band)?.label ?? band;
  factors.push(
    `Reference price for ${gemstoneType}, ${QUALITY_GRADE_LABELS[input.qualityGrade]} grade, ${bandLabel}: ${formatMoney(row.pricePerCaratMinor, row.currency)} per carat.`,
  );

  // Base price: price per carat x carat weight (milli-carats / 1000), rounded to the minor unit.
  const base = divRound(row.pricePerCaratMinor * BigInt(input.caratMilli), BigInt(1000));

  const originKey = input.origin === null ? null : normaliseKey(input.origin);
  const treatmentKey = input.treatment === null ? null : normaliseKey(input.treatment);
  const labKey = input.labCode === null ? "none" : input.labCode.toLowerCase();

  const originKnown = isKnown(originKey, multipliers.origin);
  const treatmentKnown = isKnown(treatmentKey, multipliers.treatment);
  const originBps = originKnown && originKey !== null ? bpsOf(multipliers.origin[originKey]) : BPS;
  const treatmentBps = treatmentKnown && treatmentKey !== null ? bpsOf(multipliers.treatment[treatmentKey]) : BPS;
  const labBps = hasOwn(multipliers.lab, labKey) ? bpsOf(multipliers.lab[labKey]) : BPS;

  if (originKnown) {
    factors.push(`Origin ${input.origin}: x${ratio(originBps)}.`);
  } else {
    factors.push(
      input.origin ? `Origin "${input.origin}" is not in the table, so no origin adjustment is applied.` : "Origin not given, so no origin adjustment is applied.",
    );
  }
  if (treatmentKnown) {
    factors.push(`Treatment ${input.treatment}: x${ratio(treatmentBps)}.`);
  } else {
    factors.push("Treatment not confirmed, so no treatment adjustment is applied.");
  }
  factors.push(input.labCode !== null ? `Certificate lab ${labKey}: x${ratio(labBps)}.` : `No lab certificate: x${ratio(labBps)}.`);

  const estimate = divRound(base * originBps * treatmentBps * labBps, BPS_CUBED);
  if (estimate <= BigInt(0)) {
    // Rounding can take a very small base to zero. A zero estimate is not a valuation, so it goes to an expert.
    factors.push("The calculated value rounds to nothing, so an expert must value this stone.");
    reasons.push("LOW_CONFIDENCE");
    return { estimate: null, confidence: "LOW", completenessScore: score, factors, expertReasons: unique(reasons) };
  }
  const confidence = confidenceFor(score, input.labCode !== null);
  const spread = BigInt(CONFIDENCE_SPREAD_BPS[confidence]);
  const low = divRound(estimate * (BPS - spread), BPS);
  const high = divRound(estimate * (BPS + spread), BPS);

  if (confidence === "LOW") reasons.push("LOW_CONFIDENCE");
  return {
    estimate: { estimateMinor: estimate, lowMinor: low, highMinor: high, currency: input.currency },
    confidence,
    completenessScore: score,
    factors,
    expertReasons: unique(reasons),
  };
}

/** Adds ABOVE_THRESHOLD when the estimate is above the admin-set threshold. Pure. */
export function applyExpertThreshold(output: EngineOutput, thresholdMinor: bigint | null): EngineOutput {
  if (output.estimate === null || thresholdMinor === null) return output;
  if (output.estimate.estimateMinor <= thresholdMinor) return output;
  return { ...output, expertReasons: unique([...output.expertReasons, "ABOVE_THRESHOLD"]) };
}

/** True when the request must go to an expert reviewer. */
export function needsExpert(output: EngineOutput): boolean {
  return output.expertReasons.length > 0;
}

/** A basis-point multiplier as a plain decimal: 10000 -> "1", 8500 -> "0.85", 11500 -> "1.15". */
export function ratio(bps: bigint): string {
  const whole = bps / BPS;
  const frac = bps % BPS;
  if (frac === BigInt(0)) return whole.toString();
  return (Number(bps) / 10000).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
