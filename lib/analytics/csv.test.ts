import { describe, expect, it } from "vitest";
import { csvCell, safeFileName, toCsv } from "./csv";

describe("csvCell", () => {
  it("writes plain text as it is", () => {
    expect(csvCell("Sapphire")).toBe("Sapphire");
  });

  it("quotes cells with commas, quotes and line breaks, doubling quotes", () => {
    expect(csvCell("a, b")).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell("cr\rhere")).toBe('"cr\rhere"');
  });

  it("neutralises formula starts with a leading apostrophe", () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+44")).toBe("'+44");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tcmd")).toBe("'\tcmd");
  });

  it("neutralises and then quotes when both apply", () => {
    expect(csvCell("=A1,B1")).toBe("\"'=A1,B1\"");
  });

  it("does not touch a formula character in the middle of text", () => {
    expect(csvCell("price = low")).toBe("price = low");
    expect(csvCell("a-b")).toBe("a-b");
  });

  it("writes numbers as they are, never as formulas", () => {
    expect(csvCell(-12)).toBe("-12");
    expect(csvCell(3.5)).toBe("3.5");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("writes empty for null and undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF and ends with a line break", () => {
    expect(
      toCsv([
        ["Date", "Views"],
        ["2026-05-01", 12],
      ]),
    ).toBe("Date,Views\r\n2026-05-01,12\r\n");
  });

  it("escapes every cell in a row", () => {
    expect(toCsv([["Title, long", "=bad"]])).toBe("\"Title, long\",'=bad\r\n");
  });
});

describe("safeFileName", () => {
  it("keeps letters, digits, dots, dashes and underscores", () => {
    expect(safeFileName("seller-analytics_30.csv")).toBe("seller-analytics_30.csv");
  });

  it("replaces anything else and never returns an empty name", () => {
    expect(safeFileName("../../etc passwd")).toBe("etc-passwd");
    expect(safeFileName("!!!")).toBe("export");
  });
});
