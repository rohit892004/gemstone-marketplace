import { z } from "zod";

/**
 * Portfolio editor rules. Only tagline, description and specialties are editable here.
 * Business name, GST, address and contact details are never written by this module.
 */

export const SPECIALTY_MAX_COUNT = 20;
export const SPECIALTY_MAX_LENGTH = 40;

export interface PortfolioText {
  tagline: string | null;
  description: string | null;
  specialties: string[];
}

export type PortfolioField = "tagline" | "description" | "specialties";

/** Splits "Ruby, Sapphire\nEmerald" into trimmed, non-empty values. Duplicates are removed (case-insensitive). */
export function parseSpecialties(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const value = part.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function validatePortfolioText(input: {
  tagline: string;
  description: string;
  specialties: string;
}): { ok: true; value: PortfolioText } | { ok: false; fieldErrors: Partial<Record<PortfolioField, string>> } {
  const fieldErrors: Partial<Record<PortfolioField, string>> = {};

  const tagline = input.tagline.trim();
  if (tagline.length > 120) fieldErrors.tagline = "Keep the tagline to 120 characters or fewer.";

  const description = input.description.trim();
  if (description.length > 2000) fieldErrors.description = "Keep the description to 2000 characters or fewer.";

  const specialties = parseSpecialties(input.specialties);
  if (specialties.length > SPECIALTY_MAX_COUNT) {
    fieldErrors.specialties = `Enter at most ${SPECIALTY_MAX_COUNT} specialties.`;
  } else if (specialties.some((s) => s.length > SPECIALTY_MAX_LENGTH)) {
    fieldErrors.specialties = `Each specialty must be ${SPECIALTY_MAX_LENGTH} characters or fewer.`;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      tagline: tagline || null,
      description: description || null,
      specialties,
    },
  };
}

export const portfolioIdSchema = z.string().min(1).max(64);
