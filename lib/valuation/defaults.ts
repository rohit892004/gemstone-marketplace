import {
  CARAT_BANDS,
  type CaratBandKey,
  type MultiplierTable,
  QUALITY_GRADES,
  type QualityGrade,
  type ReferenceRow,
} from "./engine";

/**
 * DEMO — INDICATIVE starting values for the reference table and multipliers. They are placeholders so the
 * engine has data to work with. They are NOT market prices and the client has not confirmed them. Admins
 * replace them in the reference table editor. Every seeded row is labelled "Demo — indicative".
 */

export const DEMO_LABEL = "Demo — indicative";

/** The seven categories the platform covers (see prisma/seed.ts). */
export const VALUATION_CATEGORIES = [
  "Diamond",
  "Ruby",
  "Sapphire",
  "Emerald",
  "Spinel",
  "Tourmaline",
  "Other Coloured Stones",
] as const;

/** Demo price per carat in whole INR for a FINE grade stone under 1 ct. */
const BASE_INR_PER_CARAT: Record<(typeof VALUATION_CATEGORIES)[number], number> = {
  Diamond: 120_000,
  Ruby: 60_000,
  Sapphire: 45_000,
  Emerald: 52_000,
  Spinel: 18_000,
  Tourmaline: 9_000,
  "Other Coloured Stones": 15_000,
};

const GRADE_FACTOR: Record<QualityGrade, number> = { PREMIUM: 1.6, FINE: 1, STANDARD: 0.6, COMMERCIAL: 0.3 };
const BAND_FACTOR: Record<CaratBandKey, number> = { UNDER_1: 1, "1_TO_2": 1.25, "2_TO_5": 1.5, "5_PLUS": 1.9 };

/** Demo conversion used only to seed USD rows from the INR table. Not a live rate. */
const DEMO_INR_PER_USD = 85;

/**
 * Demo reference rows: every category x grade x carat band, in INR and USD. Prices are minor units
 * (paise, cents). Deterministic, so the seed and the tests agree.
 */
export function buildDemoReferenceRows(): ReferenceRow[] {
  const rows: ReferenceRow[] = [];
  for (const gemstoneType of VALUATION_CATEGORIES) {
    for (const qualityGrade of QUALITY_GRADES) {
      for (const band of CARAT_BANDS) {
        const inrMajor = BASE_INR_PER_CARAT[gemstoneType] * GRADE_FACTOR[qualityGrade] * BAND_FACTOR[band.key];
        const inrMinor = BigInt(Math.round(inrMajor * 100));
        const usdMinor = BigInt(Math.round((inrMajor / DEMO_INR_PER_USD) * 100));
        rows.push({ gemstoneType, qualityGrade, band: band.key, pricePerCaratMinor: inrMinor, currency: "INR" });
        rows.push({ gemstoneType, qualityGrade, band: band.key, pricePerCaratMinor: usdMinor, currency: "USD" });
      }
    }
  }
  return rows;
}

/**
 * Demo multipliers in basis points. Keys are normalised (lower case). "unknown" is never looked up as a
 * value: a missing or unknown treatment is treated as x1 and does not count toward confidence.
 */
export const DEMO_MULTIPLIERS: MultiplierTable = {
  origin: {
    ceylon: 11500,
    kashmir: 15000,
    burma: 13000,
    myanmar: 11000,
    madagascar: 10500,
    colombia: 12000,
    mozambique: 10000,
    brazil: 9000,
    "south africa": 10000,
    india: 10000,
  },
  treatment: {
    none: 10000,
    heat: 8500,
    oil: 8000,
    filled: 7000,
    diffusion: 6000,
    unknown: 9000,
  },
  lab: {
    none: 9000,
    other: 10000,
    gia: 10500,
    igi: 10000,
    grs: 10500,
    ssef: 11000,
    gubelin: 11000,
    agl: 10000,
    gii: 10000,
  },
};


