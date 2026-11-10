import { describe, expect, it } from "vitest";
import { buildDemoReferenceRows } from "./defaults";
import {
  CSV_HEADER,
  MAX_IMPORT_ROWS,
  minorToMajorString,
  parseReferencePriceCsv,
  serialiseReferencePriceCsv,
  splitCsvRecords,
  type ReferencePriceRow,
} from "./admin-csv";

const HEADER = "gemstone_type,currency,quality_grade,carat_band,price_per_carat";

function errorsOf(text: string) {
  const result = parseReferencePriceCsv(text);
  if (result.ok) throw new Error("expected errors");
  return result.errors;
}

describe("splitCsvRecords", () => {
  it("splits LF and CRLF records and reports the starting line of each", () => {
    const records = splitCsvRecords("a,b\r\nc,d\ne,f\r\n");
    expect(records).toEqual([
      { line: 1, fields: ["a", "b"] },
      { line: 2, fields: ["c", "d"] },
      { line: 3, fields: ["e", "f"] },
    ]);
  });

  it("skips blank lines but keeps their line numbers for later rows", () => {
    const records = splitCsvRecords("a\n\n   \nb\n");
    expect(records).toEqual([
      { line: 1, fields: ["a"] },
      { line: 4, fields: ["b"] },
    ]);
  });

  it("strips a UTF-8 byte order mark", () => {
    const records = splitCsvRecords("﻿a,b\n");
    expect(records[0].fields).toEqual(["a", "b"]);
  });

  it("keeps commas, doubled quotes and line breaks inside quoted fields", () => {
    const records = splitCsvRecords('"Ruby, Burmese","say ""hi""","line one\nline two",x\n');
    expect(records).toHaveLength(1);
    expect(records[0].fields).toEqual(["Ruby, Burmese", 'say "hi"', "line one\nline two", "x"]);
    expect(records[0].line).toBe(1);
  });

  it("keeps empty fields", () => {
    expect(splitCsvRecords("a,,c,\n")[0].fields).toEqual(["a", "", "c", ""]);
  });
});

describe("parseReferencePriceCsv", () => {
  it("parses a valid file with LF line endings", () => {
    const result = parseReferencePriceCsv(`${HEADER}\nRuby,INR,FINE,UNDER_1,50000.00\nRuby,USD,FINE,UNDER_1,600.50\n`);
    expect(result).toEqual({
      ok: true,
      rows: [
        { gemstoneType: "Ruby", currency: "INR", qualityGrade: "FINE", band: "UNDER_1", pricePerCaratMinor: BigInt(5000000) },
        { gemstoneType: "Ruby", currency: "USD", qualityGrade: "FINE", band: "UNDER_1", pricePerCaratMinor: BigInt(60050) },
      ],
    });
  });

  it("accepts CRLF, a BOM, blank lines, padded values and lower-case codes", () => {
    const text = `﻿${HEADER}\r\n\r\n  diamond , inr , premium , 1_to_2 , "1,250,000.5" \r\n\r\n`;
    const result = parseReferencePriceCsv(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([
      { gemstoneType: "Diamond", currency: "INR", qualityGrade: "PREMIUM", band: "1_TO_2", pricePerCaratMinor: BigInt(125000050) },
    ]);
  });

  it("accepts a quoted gemstone type", () => {
    const result = parseReferencePriceCsv(`${HEADER}\n"Other Coloured Stones",INR,STANDARD,5_PLUS,100\n`);
    expect(result.ok).toBe(true);
  });

  it("rejects a missing or different header", () => {
    expect(errorsOf("gemstone_type,currency,grade,band,price\nRuby,INR,FINE,UNDER_1,1\n")[0]).toMatchObject({ line: 1 });
    expect(errorsOf(`${HEADER.replace("currency,", "")},x\n`)[0].message).toContain("must be exactly");
  });

  it("reports an empty file and a header-only file", () => {
    expect(errorsOf("")[0].message).toContain("empty");
    expect(errorsOf(`${HEADER}\n\n`)[0].message).toContain("no price rows");
  });

  it("reports every bad row with its own line number", () => {
    const text = [
      HEADER,
      "Ruby,INR,FINE,UNDER_1,50000.00", // line 2 ok
      "Unicorn,INR,FINE,UNDER_1,1", // line 3 unknown type
      "Ruby,EUR,FINE,UNDER_1,1", // line 4 currency
      "Ruby,INR,GOOD,UNDER_1,1", // line 5 grade
      "Ruby,INR,FINE,2_TO_9,1", // line 6 band
      "Ruby,INR,FINE,UNDER_1,abc", // line 7 price format
      "Ruby,INR,FINE,UNDER_1,0", // line 8 zero price
      "Ruby,INR,FINE,UNDER_1,1.234", // line 9 three decimals
      "Ruby,INR,FINE", // line 10 column count
    ].join("\n");
    const errors = errorsOf(text);
    const lines = errors.map((e) => e.line);
    expect(lines).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(errors[0].message).toContain("gemstone_type");
    expect(errors[7].message).toContain("Expected 5 columns");
  });

  it("refuses the whole file when one row is invalid (no partial result)", () => {
    const result = parseReferencePriceCsv(`${HEADER}\nRuby,INR,FINE,UNDER_1,1\nRuby,INR,FINE,UNDER_1,nope\n`);
    expect(result.ok).toBe(false);
    expect("rows" in result).toBe(false);
  });

  it("reports a duplicate key and points at the first occurrence", () => {
    const errors = errorsOf(`${HEADER}\nRuby,INR,FINE,UNDER_1,1\nruby,inr,fine,UNDER_1,2\n`);
    expect(errors).toEqual([expect.objectContaining({ line: 3 })]);
    expect(errors[0].message).toContain("line 2");
  });

  it("treats different bands or currencies as different keys", () => {
    const result = parseReferencePriceCsv(
      `${HEADER}\nRuby,INR,FINE,UNDER_1,1\nRuby,INR,FINE,1_TO_2,1\nRuby,USD,FINE,UNDER_1,1\n`,
    );
    expect(result.ok).toBe(true);
  });

  it("refuses more rows than the limit", () => {
    const body = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `Ruby,INR,FINE,UNDER_1,${i + 1}`).join("\n");
    expect(errorsOf(`${HEADER}\n${body}`)[0].message).toContain("at most");
  });
});

describe("minorToMajorString", () => {
  it("always shows two decimals", () => {
    expect(minorToMajorString(BigInt(5000000))).toBe("50000.00");
    expect(minorToMajorString(BigInt(5))).toBe("0.05");
    expect(minorToMajorString(BigInt(12345))).toBe("123.45");
  });
});

describe("serialiseReferencePriceCsv", () => {
  it("writes the exact header first and quotes only when needed", () => {
    const text = serialiseReferencePriceCsv([
      { gemstoneType: "Other Coloured Stones", currency: "INR", qualityGrade: "FINE", band: "UNDER_1", pricePerCaratMinor: BigInt(100) },
    ]);
    const [first, second] = text.split("\r\n");
    expect(first).toBe(CSV_HEADER.join(","));
    expect(second).toBe("Other Coloured Stones,INR,FINE,UNDER_1,1.00");
    expect(text.endsWith("\r\n")).toBe(true);
  });

  it("sorts rows by type, currency, grade and band", () => {
    const rows: ReferencePriceRow[] = [
      { gemstoneType: "Ruby", currency: "USD", qualityGrade: "FINE", band: "UNDER_1", pricePerCaratMinor: BigInt(1) },
      { gemstoneType: "Diamond", currency: "INR", qualityGrade: "COMMERCIAL", band: "UNDER_1", pricePerCaratMinor: BigInt(1) },
      { gemstoneType: "Diamond", currency: "INR", qualityGrade: "PREMIUM", band: "5_PLUS", pricePerCaratMinor: BigInt(1) },
      { gemstoneType: "Diamond", currency: "INR", qualityGrade: "PREMIUM", band: "UNDER_1", pricePerCaratMinor: BigInt(1) },
    ];
    const lines = serialiseReferencePriceCsv(rows).trim().split("\r\n").slice(1);
    expect(lines).toEqual([
      "Diamond,INR,PREMIUM,UNDER_1,0.01",
      "Diamond,INR,PREMIUM,5_PLUS,0.01",
      "Diamond,INR,COMMERCIAL,UNDER_1,0.01",
      "Ruby,USD,FINE,UNDER_1,0.01",
    ]);
  });

  it("round trip: export then import gives the same rows, for the full demo table", () => {
    const demo = buildDemoReferenceRows().map((row) => ({
      gemstoneType: row.gemstoneType,
      currency: row.currency,
      qualityGrade: row.qualityGrade,
      band: row.band,
      pricePerCaratMinor: row.pricePerCaratMinor,
    }));
    const text = serialiseReferencePriceCsv(demo);
    const parsed = parseReferencePriceCsv(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const key = (r: ReferencePriceRow) => `${r.gemstoneType}|${r.currency}|${r.qualityGrade}|${r.band}`;
    const expected = new Map(demo.map((r) => [key(r), r.pricePerCaratMinor]));
    expect(parsed.rows).toHaveLength(demo.length);
    for (const row of parsed.rows) {
      expect(expected.get(key(row))).toBe(row.pricePerCaratMinor);
    }
    // Exporting the imported rows again gives identical text.
    expect(serialiseReferencePriceCsv(parsed.rows)).toBe(text);
  });

  it("round trip keeps a type name with commas and quotes intact", () => {
    const text = serialiseReferencePriceCsv([
      { gemstoneType: 'Other "Coloured", Stones', currency: "INR", qualityGrade: "FINE", band: "UNDER_1", pricePerCaratMinor: BigInt(7) },
    ]);
    // Unknown names are refused on import, so the serialiser quotes them and the parser reads them back exactly.
    const [record] = splitCsvRecords(text).slice(1);
    expect(record.fields[0]).toBe('Other "Coloured", Stones');
  });
});
