import { parseMajorToMinor } from "@/lib/money/money";
import { CARAT_BANDS, QUALITY_GRADES, type CaratBandKey, type Currency, type QualityGrade } from "./engine";
import { VALUATION_CATEGORIES } from "./defaults";

/**
 * Reference price CSV. Pure: no database and no I/O. The import is all-or-nothing: the caller writes rows only
 * when parseReferencePriceCsv returns ok. Every problem is reported with its line number.
 *
 * Format: header row exactly `gemstone_type,currency,quality_grade,carat_band,price_per_carat`, then one row per
 * price. price_per_carat is a major-unit amount such as 50000.00 (at most two decimals). A UTF-8 BOM, CRLF or LF
 * line endings, quoted fields (commas, doubled quotes, line breaks inside quotes) and blank lines are accepted.
 */

export const CSV_HEADER = ["gemstone_type", "currency", "quality_grade", "carat_band", "price_per_carat"] as const;
export const MAX_IMPORT_ROWS = 2000;

export interface ReferencePriceRow {
  gemstoneType: string;
  currency: Currency;
  qualityGrade: QualityGrade;
  band: CaratBandKey;
  pricePerCaratMinor: bigint;
}

export interface CsvError {
  line: number;
  message: string;
}

export type CsvParseResult = { ok: true; rows: ReferencePriceRow[] } | { ok: false; errors: CsvError[] };

const CURRENCY_CODES: readonly string[] = ["INR", "USD"];
const BAND_KEYS: readonly string[] = CARAT_BANDS.map((band) => band.key);
const GRADE_KEYS: readonly string[] = QUALITY_GRADES;

/**
 * Splits CSV text into records. Each record keeps the physical line number where it starts. Handles quoted
 * fields with commas, doubled quotes and line breaks, and both CRLF and LF. Blank lines produce no record.
 */
export function splitCsvRecords(text: string): Array<{ line: number; fields: string[] }> {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: Array<{ line: number; fields: string[] }> = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let fieldHasContent = false;

  const endRecord = () => {
    fields.push(field);
    // A line with nothing on it (no commas, no text) is a blank line and is skipped.
    const blank = fields.length === 1 && fields[0].trim() === "";
    if (!blank) records.push({ line: recordLine, fields });
    fields = [];
    field = "";
    fieldHasContent = false;
  };

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line += 1;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field.trim() === "" && !fieldHasContent) {
      inQuotes = true;
      field = "";
      fieldHasContent = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
      fieldHasContent = false;
    } else if (ch === "\n" || (ch === "\r" && input[i + 1] !== "\n")) {
      // A CRLF pair is handled by the \n on the next step, so only a bare CR or LF ends the record here.
      endRecord();
      line += 1;
      recordLine = line;
    } else if (ch !== "\r") {
      field += ch;
      if (ch.trim() !== "") fieldHasContent = true;
    }
  }
  // Last line without a trailing newline. An unterminated quote keeps what was read; the row checks report it.
  if (fields.length > 0 || field !== "") endRecord();
  return records;
}

function canonicalCategory(value: string): string | null {
  const wanted = value.trim().toLowerCase();
  const match = VALUATION_CATEGORIES.find((name) => name.toLowerCase() === wanted);
  return match ?? null;
}

/** Parses and validates the whole file. Returns every error, or every row when there are none. */
export function parseReferencePriceCsv(text: string): CsvParseResult {
  const records = splitCsvRecords(text);
  const errors: CsvError[] = [];

  if (records.length === 0) return { ok: false, errors: [{ line: 1, message: "The file is empty." }] };

  const header = records[0];
  const headerOk =
    header.fields.length === CSV_HEADER.length &&
    header.fields.every((value, index) => value.trim() === CSV_HEADER[index]);
  if (!headerOk) {
    return {
      ok: false,
      errors: [{ line: header.line, message: `The first row must be exactly: ${CSV_HEADER.join(",")}.` }],
    };
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) return { ok: false, errors: [{ line: header.line, message: "The file has no price rows." }] };
  if (dataRecords.length > MAX_IMPORT_ROWS) {
    return { ok: false, errors: [{ line: header.line, message: `A file can hold at most ${MAX_IMPORT_ROWS} rows.` }] };
  }

  const rows: ReferencePriceRow[] = [];
  const seen = new Map<string, number>();

  for (const record of dataRecords) {
    if (record.fields.length !== CSV_HEADER.length) {
      errors.push({
        line: record.line,
        message: `Expected ${CSV_HEADER.length} columns but found ${record.fields.length}.`,
      });
      continue;
    }
    const [rawType, rawCurrency, rawGrade, rawBand, rawPrice] = record.fields.map((value) => value.trim());
    const rowErrors: string[] = [];

    const gemstoneType = canonicalCategory(rawType);
    if (!gemstoneType) rowErrors.push(`gemstone_type "${rawType}" is not one of the seven gemstone types.`);

    const currency = rawCurrency.toUpperCase();
    if (!CURRENCY_CODES.includes(currency)) rowErrors.push(`currency "${rawCurrency}" must be INR or USD.`);

    const grade = rawGrade.toUpperCase();
    if (!GRADE_KEYS.includes(grade)) rowErrors.push(`quality_grade "${rawGrade}" must be PREMIUM, FINE, STANDARD or COMMERCIAL.`);

    const band = rawBand.toUpperCase();
    if (!BAND_KEYS.includes(band)) rowErrors.push(`carat_band "${rawBand}" must be UNDER_1, 1_TO_2, 2_TO_5 or 5_PLUS.`);

    const price = parseMajorToMinor(rawPrice);
    if (!price.ok) {
      rowErrors.push(
        price.reason === "range"
          ? `price_per_carat "${rawPrice}" is out of range or not above zero.`
          : `price_per_carat "${rawPrice}" must be an amount like 50000.00 with at most two decimals.`,
      );
    }

    if (rowErrors.length > 0) {
      for (const message of rowErrors) errors.push({ line: record.line, message });
      continue;
    }

    const key = `${gemstoneType}|${currency}|${grade}|${band}`;
    const firstLine = seen.get(key);
    if (firstLine !== undefined) {
      errors.push({ line: record.line, message: `Duplicate of the row on line ${firstLine} (same type, currency, grade and band).` });
      continue;
    }
    seen.set(key, record.line);

    rows.push({
      gemstoneType: gemstoneType as string,
      currency: currency as Currency,
      qualityGrade: grade as QualityGrade,
      band: band as CaratBandKey,
      pricePerCaratMinor: (price as { ok: true; minor: bigint }).minor,
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rows };
}

/** Quotes a field only when it needs it (RFC 4180). */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value) || value !== value.trim()) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Minor units to a major-unit string with exactly two decimals. 5000000n becomes "50000.00". */
export function minorToMajorString(minor: bigint): string {
  const negative = minor < BigInt(0);
  const abs = negative ? -minor : minor;
  const whole = abs / BigInt(100);
  const frac = (abs % BigInt(100)).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${frac}`;
}

const TYPE_ORDER = new Map<string, number>(VALUATION_CATEGORIES.map((name, index) => [name, index]));
const GRADE_ORDER = new Map<string, number>(QUALITY_GRADES.map((grade, index) => [grade, index]));
const BAND_ORDER = new Map<string, number>(CARAT_BANDS.map((band, index) => [band.key, index]));

/** Serialises rows with the header. Rows are sorted by type, currency, grade and band, so exports are stable. */
export function serialiseReferencePriceCsv(rows: ReferencePriceRow[]): string {
  const sorted = [...rows].sort((a, b) => {
    const typeDiff = (TYPE_ORDER.get(a.gemstoneType) ?? 99) - (TYPE_ORDER.get(b.gemstoneType) ?? 99);
    if (typeDiff !== 0) return typeDiff;
    if (a.currency !== b.currency) return a.currency < b.currency ? -1 : 1;
    const gradeDiff = (GRADE_ORDER.get(a.qualityGrade) ?? 99) - (GRADE_ORDER.get(b.qualityGrade) ?? 99);
    if (gradeDiff !== 0) return gradeDiff;
    return (BAND_ORDER.get(a.band) ?? 99) - (BAND_ORDER.get(b.band) ?? 99);
  });
  const lines = [CSV_HEADER.join(",")];
  for (const row of sorted) {
    lines.push(
      [
        csvField(row.gemstoneType),
        row.currency,
        row.qualityGrade,
        row.band,
        minorToMajorString(row.pricePerCaratMinor),
      ].join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
