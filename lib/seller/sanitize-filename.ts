/**
 * Keeps a display-only file name. Path parts are dropped and only [A-Za-z0-9 ._-] survives.
 * The result is never used in a storage key.
 */
export function sanitizeFileName(raw: string): string {
  const lastPart = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = lastPart
    .replace(/[^A-Za-z0-9 ._-]/g, "")
    .replace(/^[.\s]+/, "")
    .trim()
    .slice(0, 120)
    .trim();
  return cleaned || "document";
}
