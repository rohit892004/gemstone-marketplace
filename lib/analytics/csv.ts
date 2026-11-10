/**
 * CSV building for the analytics exports. Pure.
 *
 *  - Cells containing a comma, quote, CR or LF are quoted, and quotes are doubled.
 *  - A text cell starting with = + - @, a tab or a carriage return is neutralised with a leading apostrophe, so a
 *    spreadsheet cannot run it as a formula. Numbers are never formulas and are written as they are.
 *  - Lines end with CRLF, as RFC 4180 asks.
 */

export type CsvCell = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = FORMULA_START.test(value) ? "'" + value : value;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** A download file name with only safe characters. */
export function safeFileName(base: string): string {
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "") || "export";
}
