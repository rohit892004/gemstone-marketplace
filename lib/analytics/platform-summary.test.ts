import { describe, expect, it } from "vitest";
import { PLATFORM_CSV_HEADER, platformDailyCsvRows, platformKpis, rankedByPrefix, type PlatformRow } from "./platform-summary";
import { comparisonDays } from "./seller-trends";

const { current, previous } = comparisonDays("2026-05-10", 3);

const row = (day: string, kind: string, count: number): PlatformRow => ({ day, kind, count });

describe("platformKpis", () => {
  const rows: PlatformRow[] = [
    row("2026-05-08", "PLATFORM_SIGNUP_BUYER", 4),
    row("2026-05-10", "PLATFORM_SIGNUP_BUYER", 2),
    row("2026-05-05", "PLATFORM_SIGNUP_BUYER", 3),
    row("2026-05-09", "PLATFORM_ENQUIRY", 7),
  ];

  it("sums each KPI over the window and compares with the previous window", () => {
    const kpis = platformKpis(rows, current, previous);
    const buyers = kpis.find((k) => k.key === "signupBuyers");
    expect(buyers).toMatchObject({ value: 6, previous: 3, change: 100, series: [4, 0, 2] });
  });

  it("returns a null change when the previous window had nothing", () => {
    const kpis = platformKpis(rows, current, previous);
    const enquiries = kpis.find((k) => k.key === "enquiries");
    expect(enquiries).toMatchObject({ value: 7, previous: 0, change: null });
  });

  it("returns every KPI, even with no rows", () => {
    const kpis = platformKpis([], current, previous);
    expect(kpis).toHaveLength(9);
    expect(kpis.every((k) => k.value === 0 && k.change === 0)).toBe(true);
  });
});

describe("rankedByPrefix", () => {
  const rows: PlatformRow[] = [
    row("2026-05-08", "PLATFORM_TOP_TERM:sapphire", 5),
    row("2026-05-09", "PLATFORM_TOP_TERM:sapphire", 4),
    row("2026-05-09", "PLATFORM_TOP_TERM:ruby", 8),
    row("2026-05-09", "PLATFORM_TOP_TERM:emerald", 0),
    row("2026-05-09", "PLATFORM_TOP_CATEGORY:cat1", 3),
    row("2026-04-01", "PLATFORM_TOP_TERM:old", 99),
  ];
  const days = new Set(current);

  it("ranks the terms in the window by total count", () => {
    expect(rankedByPrefix(rows, "PLATFORM_TOP_TERM:", days, 10)).toEqual([
      { key: "sapphire", count: 9 },
      { key: "ruby", count: 8 },
    ]);
  });

  it("only returns the requested prefix and keeps the top N", () => {
    expect(rankedByPrefix(rows, "PLATFORM_TOP_CATEGORY:", days, 10)).toEqual([{ key: "cat1", count: 3 }]);
    expect(rankedByPrefix(rows, "PLATFORM_TOP_TERM:", days, 1)).toEqual([{ key: "sapphire", count: 9 }]);
  });
});

describe("platformDailyCsvRows", () => {
  it("gives one row per day with one column per KPI", () => {
    const out = platformDailyCsvRows([row("2026-05-08", "PLATFORM_ENQUIRY", 4)], ["2026-05-08"]);
    expect(out).toEqual([["2026-05-08", 0, 0, 0, 0, 4, 0, 0, 0, 0]]);
    expect(PLATFORM_CSV_HEADER).toHaveLength(out[0].length);
  });
});
