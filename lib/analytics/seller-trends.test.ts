import { describe, expect, it } from "vitest";
import {
  addDays,
  comparisonDays,
  conversionRate,
  countsByDay,
  dailySeries,
  dayRange,
  formatChange,
  formatDuration,
  dayToUnixSeconds,
  median,
  parseRange,
  percentChange,
  ratePercent,
  sumByKey,
  topN,
} from "./seller-trends";

describe("parseRange", () => {
  it("accepts 7, 30 and 90", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("30")).toBe(30);
    expect(parseRange("90")).toBe(90);
  });

  it("falls back to 30 for anything else", () => {
    expect(parseRange(undefined)).toBe(30);
    expect(parseRange(null)).toBe(30);
    expect(parseRange("")).toBe(30);
    expect(parseRange("14")).toBe(30);
    expect(parseRange("365")).toBe(30);
    expect(parseRange("abc")).toBe(30);
    expect(parseRange("-7")).toBe(30);
  });

  it("reads the first value of a repeated query parameter", () => {
    expect(parseRange(["90", "7"])).toBe(90);
    expect(parseRange(["x", "7"])).toBe(30);
  });
});

describe("day helpers", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });

  it("lists days oldest first, ending on the last day", () => {
    expect(dayRange("2026-05-10", 3)).toEqual(["2026-05-08", "2026-05-09", "2026-05-10"]);
  });

  it("gives the current and the previous window of the same length", () => {
    const { current, previous } = comparisonDays("2026-05-10", 3);
    expect(current).toEqual(["2026-05-08", "2026-05-09", "2026-05-10"]);
    expect(previous).toEqual(["2026-05-05", "2026-05-06", "2026-05-07"]);
  });

  it("gives unix seconds at UTC midnight", () => {
    expect(dayToUnixSeconds("1970-01-02")).toBe(86400);
  });
});

describe("percentChange", () => {
  it("is the rounded change against the previous value", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(101, 100)).toBe(1);
    expect(percentChange(1, 3)).toBe(-67);
  });

  it("is null when there is nothing to compare against", () => {
    expect(percentChange(12, 0)).toBeNull();
  });

  it("is zero for no change, including zero to zero", () => {
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(100, 100)).toBe(0);
  });
});

describe("rates and conversion", () => {
  it("is null with no denominator", () => {
    expect(ratePercent(3, 0)).toBeNull();
    expect(conversionRate(3, 0)).toBeNull();
  });

  it("is enquiries over views, one decimal", () => {
    expect(conversionRate(5, 200)).toBe(2.5);
    expect(conversionRate(1, 3)).toBe(33.3);
    expect(conversionRate(0, 40)).toBe(0);
  });
});

describe("median", () => {
  it("is null for an empty list", () => {
    expect(median([])).toBeNull();
  });

  it("is the middle value for an odd count", () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it("is the average of the two middle values for an even count", () => {
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });

  it("does not reorder the input", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("daily series", () => {
  it("fills missing days with zero, in day order", () => {
    const counts = countsByDay([
      { day: "2026-05-08", count: 4 },
      { day: "2026-05-08", count: 1 },
      { day: "2026-05-10", count: 2 },
    ]);
    expect(dailySeries(counts, dayRange("2026-05-10", 4))).toEqual([0, 5, 0, 2]);
  });
});

describe("topN", () => {
  const items = [
    { name: "b", n: 5 },
    { name: "a", n: 5 },
    { name: "c", n: 9 },
    { name: "d", n: 0 },
  ];

  it("ranks by score, breaks ties by label, and drops zeros", () => {
    const ranked = topN(items, (i) => i.n, (i) => i.name, 10).map((i) => i.name);
    expect(ranked).toEqual(["c", "a", "b"]);
  });

  it("keeps only the first N", () => {
    expect(topN(items, (i) => i.n, (i) => i.name, 1).map((i) => i.name)).toEqual(["c"]);
  });

  it("sums counts per key and skips null keys", () => {
    const rows = [
      { k: "x", c: 2 },
      { k: "x", c: 3 },
      { k: null, c: 9 },
    ];
    expect(sumByKey(rows, (r) => r.k, (r) => r.c)).toEqual(new Map([["x", 5]]));
  });
});

describe("display formatting", () => {
  it("formats a change with a sign", () => {
    expect(formatChange(12)).toBe("+12%");
    expect(formatChange(-5)).toBe("\u22125%");
    expect(formatChange(0)).toBe("No change");
    expect(formatChange(null)).toBe("No earlier data to compare");
  });

  it("formats a duration in a readable unit", () => {
    expect(formatDuration(null)).toBe("No replies yet");
    expect(formatDuration(30)).toBe("under a minute");
    expect(formatDuration(720)).toBe("12 min");
    expect(formatDuration(9000)).toBe("2.5 hours");
    expect(formatDuration(259200)).toBe("3 days");
  });
});
