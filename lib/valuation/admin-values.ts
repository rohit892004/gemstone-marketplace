import { parseMajorToMinor } from "@/lib/money/money";
import { normaliseKey } from "./engine";

/**
 * Pure conversions for the admin valuation pages. Money is never a float: amounts go through parseMajorToMinor
 * (string to BigInt minor units) and percentages go through integer arithmetic (basis points).
 */

export const MULTIPLIER_KINDS = ["origin", "treatment", "lab"] as const;
export type MultiplierKind = (typeof MULTIPLIER_KINDS)[number];

export const MULTIPLIER_KIND_LABELS: Record<MultiplierKind, string> = {
  origin: "Origin",
  treatment: "Treatment",
  lab: "Certificate lab",
};

/** A multiplier is between 1% and 300% (100 bps to 30000 bps). Basis points: 85% = 8500, 100% = 10000. */
export const MIN_MULTIPLIER_BPS = 100;
export const MAX_MULTIPLIER_BPS = 30000;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * "85" becomes 8500 bps, "85.5" becomes 8550, "100%" is accepted too. Only up to two decimals of a percent
 * (one basis point is 0.01%).
 */
export function parsePercentToBps(input: string): ParseResult<number> {
  const cleaned = input.trim().replace(/%$/, "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, error: "Enter a percentage such as 85 or 92.5." };
  }
  const [whole, frac = ""] = cleaned.split(".");
  const bps = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (bps < MIN_MULTIPLIER_BPS || bps > MAX_MULTIPLIER_BPS) {
    return { ok: false, error: "A multiplier must be between 1% and 300%." };
  }
  return { ok: true, value: bps };
}

/** 8500 becomes "85", 8550 becomes "85.5", 10000 becomes "100". */
export function formatBpsAsPercent(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

/** Multiplier keys are stored normalised (lower case, single spaces). Keys must not be empty. */
export function normaliseMultiplierKey(input: string): ParseResult<string> {
  const key = normaliseKey(input);
  if (key.length === 0) return { ok: false, error: "Enter a key, such as the origin name." };
  if (key.length > 60) return { ok: false, error: "A key must be 60 characters or fewer." };
  if (!/^[a-z0-9][a-z0-9 .'-]*$/.test(key)) {
    return { ok: false, error: "A key may contain letters, digits, spaces, dots, apostrophes and hyphens." };
  }
  return { ok: true, value: key };
}

/**
 * Expert threshold typed in major units. Blank means "no threshold" (null). Anything else must be a positive
 * amount with at most two decimals.
 */
export function parseThresholdInput(input: string): ParseResult<bigint | null> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, value: null };
  const parsed = parseMajorToMinor(trimmed);
  if (!parsed.ok) return { ok: false, error: "Enter an amount above zero with at most two decimals, or leave it blank." };
  return { ok: true, value: parsed.minor };
}

/** The AppSetting value: a decimal string of minor units (JSON cannot hold BigInt). */
export function thresholdToSettingValue(minor: bigint): string {
  return minor.toString(10);
}
