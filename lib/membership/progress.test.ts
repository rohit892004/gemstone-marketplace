import { describe, expect, it } from "vitest";
import { criterionFormat, progressLabel, progressPercent } from "./progress";

describe("progressPercent", () => {
  it("returns the share of the requirement reached", () => {
    expect(progressPercent(0, 5)).toBe(0);
    expect(progressPercent(2, 5)).toBe(40);
    expect(progressPercent(4, 5)).toBe(80);
  });

  it("caps at 100 and never goes below 0", () => {
    expect(progressPercent(9, 5)).toBe(100);
    expect(progressPercent(-3, 5)).toBe(0);
  });

  it("treats a zero or negative requirement as complete", () => {
    expect(progressPercent(0, 0)).toBe(100);
  });

  it("rounds down so 99.5 percent never shows as complete", () => {
    expect(progressPercent(199, 200)).toBe(99);
  });

  it("returns 0 for non-finite input", () => {
    expect(progressPercent(Number.NaN, 5)).toBe(0);
    expect(progressPercent(3, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("progressLabel", () => {
  it("states current, required and the met state in words", () => {
    expect(progressLabel({ label: "Qualified referrals", current: 3, required: 5, met: false })).toBe(
      "3 of 5 Qualified referrals, not yet met",
    );
    expect(progressLabel({ label: "Followers", current: 60, required: 50, met: true })).toBe("60 of 50 Followers, met");
  });

  it("formats percentages and ratings", () => {
    expect(progressLabel({ label: "Response rate", current: 72, required: 70, met: true, format: "percent" })).toBe(
      "72% of 70% Response rate, met",
    );
    expect(progressLabel({ label: "Average rating", current: 4.2, required: 4.5, met: false, format: "rating" })).toBe(
      "4.2 of 4.5 Average rating, not yet met",
    );
  });
});

describe("criterionFormat", () => {
  it("uses percent for response rate and one decimal for rating", () => {
    expect(criterionFormat("response")).toBe("percent");
    expect(criterionFormat("rating")).toBe("rating");
    expect(criterionFormat("referrals")).toBe("count");
    expect(criterionFormat("followers")).toBe("count");
  });
});
