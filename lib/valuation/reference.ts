/**
 * Public reference numbers for valuation reports, e.g. GSV-26-K7Q2M9. Six characters from an alphabet
 * without look-alikes (no 0, O, 1, I, L), so a reader can type one from a printout. Pure: the caller
 * supplies the random bytes.
 */
export const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REFERENCE_LENGTH = 6;
const PREFIX = "GSV";

export function newValuationReference(randomBytes: (size: number) => Uint8Array, year: number): string {
  const bytes = randomBytes(REFERENCE_LENGTH);
  let code = "";
  for (let i = 0; i < REFERENCE_LENGTH; i += 1) {
    code += REFERENCE_ALPHABET[bytes[i] % REFERENCE_ALPHABET.length];
  }
  const yy = String(year % 100).padStart(2, "0");
  return `${PREFIX}-${yy}-${code}`;
}

/** Accepts only the exact format, so the verification route never looks up anything else. */
export const REFERENCE_PATTERN = new RegExp(`^${PREFIX}-\\d{2}-[${REFERENCE_ALPHABET}]{${REFERENCE_LENGTH}}$`);

export function isValidReference(value: string): boolean {
  return REFERENCE_PATTERN.test(value);
}
