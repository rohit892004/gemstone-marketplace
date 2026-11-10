import { describe, expect, it } from "vitest";
import { rankScore, rankSellers } from "./directory";

type Row = { id: string; ratingAverage: number | null; reviewCount: number; rankingBoost: number; isDemo: boolean; name: string };

const row = (over: Partial<Row> & { id: string }): Row => ({
  ratingAverage: null,
  reviewCount: 0,
  rankingBoost: 0,
  isDemo: false,
  name: over.id,
  ...over,
});

describe("rankScore", () => {
  it("scores a rating on a 100-point scale and adds the boost", () => {
    expect(rankScore({ ratingAverage: 4.5, rankingBoost: 10 })).toBe(100);
    expect(rankScore({ ratingAverage: null, rankingBoost: 20 })).toBe(20);
  });
});

describe("rankSellers", () => {
  it("orders by rating when no seller has a boost", () => {
    const sorted = rankSellers([row({ id: "a", ratingAverage: 4 }), row({ id: "b", ratingAverage: 4.8 }), row({ id: "c", ratingAverage: 3 })]);
    expect(sorted.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("lets a boost lift a seller above a slightly higher rating", () => {
    // 4.6 with no boost = 92. 4.2 with a Premium boost of 10 = 94.
    const sorted = rankSellers([row({ id: "plain", ratingAverage: 4.6 }), row({ id: "premium", ratingAverage: 4.2, rankingBoost: 10 })]);
    expect(sorted.map((s) => s.id)).toEqual(["premium", "plain"]);
  });

  it("does not let a boost beat a clearly better rating by a whole tier", () => {
    // 4.9 = 98 beats 4.2 + 10 = 94.
    const sorted = rankSellers([row({ id: "premium", ratingAverage: 4.2, rankingBoost: 10 }), row({ id: "top", ratingAverage: 4.9 })]);
    expect(sorted.map((s) => s.id)).toEqual(["top", "premium"]);
  });

  it("breaks ties by review count, then id", () => {
    const sorted = rankSellers([
      row({ id: "b", ratingAverage: 4, reviewCount: 2 }),
      row({ id: "a", ratingAverage: 4, reviewCount: 9 }),
      row({ id: "c", ratingAverage: 4, reviewCount: 2 }),
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps the isDemo label on a demo seller wherever the boost moves it", () => {
    const input = [
      row({ id: "demo-premium", ratingAverage: 4.0, rankingBoost: 20, isDemo: true, name: "Demo Elite" }),
      row({ id: "real", ratingAverage: 4.7, isDemo: false, name: "Real" }),
      row({ id: "demo-free", ratingAverage: 3.5, isDemo: true, name: "Demo Free" }),
    ];
    const sorted = rankSellers(input);
    const demo = sorted.find((s) => s.id === "demo-premium");
    expect(demo?.isDemo).toBe(true);
    expect(demo?.name).toBe("Demo Elite");
    expect(sorted.filter((s) => s.isDemo).map((s) => s.id).sort()).toEqual(["demo-free", "demo-premium"]);
    expect(sorted).toHaveLength(input.length);
  });

  it("does not change the input array", () => {
    const input = [row({ id: "a", ratingAverage: 1 }), row({ id: "b", ratingAverage: 5 })];
    rankSellers(input);
    expect(input.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
