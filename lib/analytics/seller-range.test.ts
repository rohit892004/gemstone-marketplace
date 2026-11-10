import { describe, expect, it } from "vitest";
import { lastFigureDay, resolveRange } from "./seller-range";

describe("resolveRange (tier window cap)", () => {
  it("shows the requested range when the tier allows it", () => {
    expect(resolveRange(90, 365)).toEqual({ requested: 90, days: 90, capped: false });
    expect(resolveRange(30, 90)).toEqual({ requested: 30, days: 30, capped: false });
  });

  it("caps the range to the tier history and says so", () => {
    // Free sellers get 30 days of analytics: a 90-day request shows 30.
    expect(resolveRange(90, 30)).toEqual({ requested: 90, days: 30, capped: true });
    expect(resolveRange(7, 0)).toEqual({ requested: 7, days: 0, capped: true });
  });

  it("is not capped when the cap equals the request", () => {
    expect(resolveRange(7, 7)).toEqual({ requested: 7, days: 7, capped: false });
  });
});

describe("lastFigureDay", () => {
  const now = new Date("2026-05-10T09:00:00.000Z");

  it("is yesterday (UTC) when the rollup has reached it", () => {
    expect(lastFigureDay(now, "2026-05-09")).toBe("2026-05-09");
  });

  it("is the rolled-through day when the rollup is behind", () => {
    expect(lastFigureDay(now, "2026-05-06")).toBe("2026-05-06");
  });

  it("never includes today, even if the rollup is somehow ahead", () => {
    expect(lastFigureDay(now, "2026-05-10")).toBe("2026-05-09");
  });

  it("is null when the rollup has never run", () => {
    expect(lastFigureDay(now, null)).toBeNull();
  });
});
