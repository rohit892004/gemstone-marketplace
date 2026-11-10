import { describe, expect, it } from "vitest";
import { rollupRows, seriesFor, sellerDailyCsvRows, SELLER_CSV_HEADER, sellerKpis, topListings, type RollupRow } from "./seller-summary";
import { comparisonDays } from "./seller-trends";

const row = (day: string, kind: string, count: number, gemstoneId: string | null = null, isDemo = false): RollupRow => ({
  day,
  kind,
  gemstoneId,
  count,
  isDemo,
});

const { current, previous } = comparisonDays("2026-05-10", 3);
// current: 05-08..05-10, previous: 05-05..05-07

describe("sellerKpis", () => {
  const rows: RollupRow[] = [
    row("2026-05-08", "PROFILE_VIEW", 10),
    row("2026-05-09", "PROFILE_VIEW", 5),
    row("2026-05-05", "PROFILE_VIEW", 10),
    row("2026-05-08", "LISTING_VIEW", 40, "g1"),
    row("2026-05-05", "LISTING_VIEW", 20, "g1"),
    row("2026-05-09", "ENQUIRY_STARTED", 2, "g1"),
    row("2026-05-06", "ENQUIRY_STARTED", 1, "g1"),
    row("2026-05-08", "QUOTATION_SENT", 4),
    row("2026-05-08", "QUOTATION_ACCEPTED", 1),
  ];

  it("sums each kind over the current window and compares with the previous window", () => {
    const kpis = sellerKpis(rows, current, previous);
    expect(kpis.profileViews).toEqual({ value: 15, previous: 10, change: 50 });
    expect(kpis.listingViews).toEqual({ value: 40, previous: 20, change: 100 });
    expect(kpis.enquiries).toEqual({ value: 2, previous: 1, change: 100 });
  });

  it("reports a null change when the previous window had nothing", () => {
    const kpis = sellerKpis(rows, current, previous);
    expect(kpis.wishlistAdds).toEqual({ value: 0, previous: 0, change: 0 });
    expect(kpis.valuationRequests.change).toBe(0);
    const onlyNow = sellerKpis([row("2026-05-08", "WISHLIST_ADD", 3)], current, previous);
    expect(onlyNow.wishlistAdds).toEqual({ value: 3, previous: 0, change: null });
  });

  it("computes conversion as enquiries over listing views", () => {
    expect(sellerKpis(rows, current, previous).conversion).toBe(5);
  });

  it("leaves conversion null with no listing views", () => {
    expect(sellerKpis([row("2026-05-08", "ENQUIRY_STARTED", 2)], current, previous).conversion).toBeNull();
  });

  it("computes quotation acceptance as accepted over sent, and null with none sent", () => {
    expect(sellerKpis(rows, current, previous).quotationAcceptance).toBe(25);
    expect(sellerKpis([], current, previous).quotationAcceptance).toBeNull();
  });

  it("reports no activity for an empty seller, so the page shows an empty state", () => {
    const kpis = sellerKpis([], current, previous);
    expect(kpis.hasActivity).toBe(false);
    expect(kpis.profileViews.value).toBe(0);
  });

  it("flags demo data in the current window only", () => {
    expect(sellerKpis([row("2026-05-08", "PROFILE_VIEW", 1, null, true)], current, previous).hasDemo).toBe(true);
    expect(sellerKpis([row("2026-05-05", "PROFILE_VIEW", 1, null, true)], current, previous).hasDemo).toBe(false);
  });

  it("ignores rows outside both windows", () => {
    const kpis = sellerKpis([row("2026-04-01", "PROFILE_VIEW", 99)], current, previous);
    expect(kpis.profileViews.value).toBe(0);
    expect(kpis.hasActivity).toBe(false);
  });
});

describe("seriesFor", () => {
  it("is a zero-filled daily series for one kind", () => {
    const rows = [row("2026-05-08", "LISTING_VIEW", 4, "g1"), row("2026-05-10", "LISTING_VIEW", 2, "g2"), row("2026-05-10", "PROFILE_VIEW", 9)];
    expect(seriesFor(rows, "LISTING_VIEW", current)).toEqual([4, 0, 2]);
  });
});

describe("topListings", () => {
  const titles = new Map([
    ["g1", "Blue sapphire"],
    ["g2", "Ruby pair"],
    ["g3", "Emerald"],
  ]);

  it("ranks the window's listings by views and sums each figure", () => {
    const rows = [
      row("2026-05-08", "LISTING_VIEW", 5, "g1"),
      row("2026-05-09", "LISTING_VIEW", 9, "g2"),
      row("2026-05-09", "LISTING_IMPRESSION", 30, "g2"),
      row("2026-05-10", "ENQUIRY_STARTED", 1, "g2"),
      row("2026-05-05", "LISTING_VIEW", 100, "g3"),
    ];
    const list = topListings(rows, current, titles);
    expect(list.map((r) => r.gemstoneId)).toEqual(["g2", "g1"]);
    expect(list[0]).toEqual({ gemstoneId: "g2", title: "Ruby pair", views: 9, impressions: 30, enquiries: 1, valuationRequests: 0 });
  });

  it("leaves out listings the caller did not load (not the seller's own)", () => {
    const rows = [row("2026-05-08", "LISTING_VIEW", 5, "other-seller-listing")];
    expect(topListings(rows, current, titles)).toEqual([]);
  });

  it("ignores seller-level rows with no listing", () => {
    expect(topListings([row("2026-05-08", "PROFILE_VIEW", 5)], current, titles)).toEqual([]);
  });
});

describe("rollupRows", () => {
  it("turns rollup dates into YYYY-MM-DD days", () => {
    const out = rollupRows([{ day: new Date("2026-05-08T00:00:00.000Z"), kind: "PROFILE_VIEW", gemstoneId: null, count: 2, isDemo: true }]);
    expect(out).toEqual([{ day: "2026-05-08", kind: "PROFILE_VIEW", gemstoneId: null, count: 2, isDemo: true }]);
  });
});

describe("sellerDailyCsvRows", () => {
  it("gives one row per day with zeros for quiet days and the demo flag", () => {
    const rows = [row("2026-05-08", "PROFILE_VIEW", 3, null, true), row("2026-05-08", "LISTING_VIEW", 2, "g1")];
    const out = sellerDailyCsvRows(rows, ["2026-05-08", "2026-05-09"]);
    expect(out).toEqual([
      ["2026-05-08", 3, 2, 0, 0, 0, 0, 0, 0, 0, "yes"],
      ["2026-05-09", 0, 0, 0, 0, 0, 0, 0, 0, 0, "no"],
    ]);
    expect(SELLER_CSV_HEADER).toHaveLength(out[0].length);
  });
});
