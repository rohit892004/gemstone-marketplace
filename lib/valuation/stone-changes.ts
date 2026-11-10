/**
 * Which stone details matter to a published valuation. If the seller changes one of these, the report no longer
 * describes the stone on the listing, so it is taken off the listing. Pure: no database.
 */
export const KEY_STONE_FIELDS = ["species", "caratWeight", "treatment", "certificateLabId", "certificateNo"] as const;
export type KeyStoneField = (typeof KEY_STONE_FIELDS)[number];

type StoneValue = unknown;
/** A record that may hold other fields. Only the key stone fields are compared. */
export type KeyStoneValues = Record<string, StoneValue>;

/** Trims text, and maps empty values to null, so "" and null compare equal. */
function text(value: StoneValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && typeof (value as { toString?: unknown }).toString === "function") {
    return text(String(value));
  }
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** Carat is a decimal. "2.5", "2.500" and 2.5 are the same weight. */
function carat(value: StoneValue): string | null {
  const raw = text(value);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed.toFixed(3) : raw;
}

function normalise(field: KeyStoneField, value: StoneValue): string | null {
  return field === "caratWeight" ? carat(value) : text(value);
}

/** The key stone fields whose value differs between before and after. Only fields present in both are compared. */
export function changedKeyStoneFields(before: KeyStoneValues, after: KeyStoneValues): KeyStoneField[] {
  return KEY_STONE_FIELDS.filter((field) => {
    if (!(field in after)) return false;
    return normalise(field, before[field]) !== normalise(field, after[field]);
  });
}
