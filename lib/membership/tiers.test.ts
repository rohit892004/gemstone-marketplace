import { describe, expect, it } from "vitest";
import { DEFAULT_TIER_RULES } from "./defaults";
import {
  analyticsWindow,
  canExportCsv,
  canPublishNewListing,
  evaluateTier,
  featuredAvailable,
  GRACE_DAYS,
  highestEligibleTier,
  ruleFor,
  unlockReport,
  type SellerMetrics,
  type TierState,
} from "./tiers";

const rules = DEFAULT_TIER_RULES;
const now = new Date("2026-11-10T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const none: SellerMetrics = { qualifiedReferrals: 0, followerCount: 0, responseRate: 100, averageRating: 5 };
const free: TierState = { tier: "FREE", graceUntil: null, graceTier: null, manualOverride: false };

describe("unlock rules", () => {
  it("Free is always eligible", () => {
    expect(unlockReport(ruleFor(rules, "FREE"), none).eligible).toBe(true);
  });

  it("Premium unlocks at 5 referrals and a 70% response rate", () => {
    const r = ruleFor(rules, "PREMIUM");
    expect(unlockReport(r, { ...none, qualifiedReferrals: 5, responseRate: 70 }).eligible).toBe(true);
    expect(unlockReport(r, { ...none, qualifiedReferrals: 4, responseRate: 100 }).eligible).toBe(false);
  });

  it("Premium also unlocks at 50 followers instead of referrals", () => {
    const r = ruleFor(rules, "PREMIUM");
    expect(unlockReport(r, { ...none, followerCount: 50, responseRate: 70 }).eligible).toBe(true);
  });

  it("Premium is refused when the response rate is below 70%, however many referrals", () => {
    const r = ruleFor(rules, "PREMIUM");
    expect(unlockReport(r, { ...none, qualifiedReferrals: 50, responseRate: 69 }).eligible).toBe(false);
  });

  it("a seller with no conversations (null response rate) does not meet a response requirement", () => {
    const r = ruleFor(rules, "PREMIUM");
    expect(unlockReport(r, { ...none, qualifiedReferrals: 5, responseRate: null }).eligible).toBe(false);
  });

  it("Elite needs 20 referrals or 250 followers, 85% response and an average rating of 4.5", () => {
    const r = ruleFor(rules, "ELITE");
    expect(unlockReport(r, { ...none, followerCount: 250, responseRate: 85, averageRating: 4.5 }).eligible).toBe(true);
    expect(unlockReport(r, { ...none, followerCount: 250, responseRate: 85, averageRating: 4.4 }).eligible).toBe(false);
    expect(unlockReport(r, { ...none, followerCount: 250, responseRate: 85, averageRating: null }).eligible).toBe(false);
    expect(unlockReport(r, { ...none, qualifiedReferrals: 20, responseRate: 84, averageRating: 5 }).eligible).toBe(false);
  });

  it("reports progress per criterion, so the page can show a bar for each", () => {
    const report = unlockReport(ruleFor(rules, "PREMIUM"), { ...none, qualifiedReferrals: 2, followerCount: 10, responseRate: 40 });
    expect(report.reachCriteria.map((c) => [c.key, c.current, c.required, c.met])).toEqual([
      ["referrals", 2, 5, false],
      ["followers", 10, 50, false],
    ]);
    expect(report.qualityCriteria[0]).toMatchObject({ key: "response", current: 40, required: 70, met: false });
  });
});

describe("highestEligibleTier", () => {
  it("returns the highest tier met", () => {
    expect(highestEligibleTier(rules, { ...none, followerCount: 300, responseRate: 90, averageRating: 4.8 })).toBe("ELITE");
    expect(highestEligibleTier(rules, none)).toBe("FREE");
  });
});

describe("evaluateTier", () => {
  it("upgrades immediately and clears any grace", () => {
    const decision = evaluateTier({
      rules,
      metrics: { ...none, qualifiedReferrals: 5, responseRate: 80 },
      state: free,
      now,
    });
    expect(decision).toMatchObject({ tier: "PREMIUM", change: "UPGRADED", graceUntil: null });
  });

  it("starts a 14-day grace period on a downgrade, and keeps the tier during it", () => {
    const premium: TierState = { tier: "PREMIUM", graceUntil: null, graceTier: null, manualOverride: false };
    const decision = evaluateTier({ rules, metrics: none, state: premium, now });
    expect(decision.change).toBe("GRACE_STARTED");
    expect(decision.tier).toBe("PREMIUM");
    expect(decision.graceTier).toBe("FREE");
    expect(decision.graceUntil?.getTime()).toBe(now.getTime() + GRACE_DAYS * DAY);
  });

  it("drops the tier once the grace has passed", () => {
    const graceUntil = new Date(now.getTime() - 1000);
    const state: TierState = { tier: "PREMIUM", graceUntil, graceTier: "FREE", manualOverride: false };
    const decision = evaluateTier({ rules, metrics: none, state, now });
    expect(decision).toMatchObject({ tier: "FREE", change: "DOWNGRADED", graceUntil: null });
  });

  it("keeps the tier during the grace, even on a later run", () => {
    const graceUntil = new Date(now.getTime() + 5 * DAY);
    const state: TierState = { tier: "PREMIUM", graceUntil, graceTier: "FREE", manualOverride: false };
    const decision = evaluateTier({ rules, metrics: none, state, now });
    expect(decision).toMatchObject({ tier: "PREMIUM", change: "NONE", graceUntil });
  });

  it("cancels the grace when the seller qualifies again", () => {
    const state: TierState = { tier: "PREMIUM", graceUntil: new Date(now.getTime() + DAY), graceTier: "FREE", manualOverride: false };
    const decision = evaluateTier({ rules, metrics: { ...none, qualifiedReferrals: 5, responseRate: 75 }, state, now });
    expect(decision).toMatchObject({ tier: "PREMIUM", change: "GRACE_CANCELLED", graceUntil: null });
  });

  it("never changes an admin override", () => {
    const state: TierState = { tier: "ELITE", graceUntil: null, graceTier: null, manualOverride: true };
    const decision = evaluateTier({ rules, metrics: none, state, now });
    expect(decision).toMatchObject({ tier: "ELITE", change: "NONE", manualOverride: true });
  });
});

describe("listing limits and features", () => {
  it("Free stops new publishes at 25 active listings, and keeps the existing ones", () => {
    const free25 = ruleFor(rules, "FREE");
    expect(canPublishNewListing(free25, 24)).toEqual({ ok: true });
    expect(canPublishNewListing(free25, 25)).toEqual({ ok: false, limit: 25 });
    // A seller already over a lower limit can still hold listings; only a new publish is refused.
    expect(canPublishNewListing(free25, 40)).toEqual({ ok: false, limit: 25 });
  });

  it("Elite has no listing limit", () => {
    expect(canPublishNewListing(ruleFor(rules, "ELITE"), 10000)).toEqual({ ok: true });
  });

  it("featured slots are free up to the tier's count", () => {
    expect(featuredAvailable(ruleFor(rules, "PREMIUM"), 0)).toBe(true);
    expect(featuredAvailable(ruleFor(rules, "PREMIUM"), 1)).toBe(false);
    expect(featuredAvailable(ruleFor(rules, "FREE"), 0)).toBe(false);
  });

  it("analytics history is capped at the tier's window", () => {
    expect(analyticsWindow(ruleFor(rules, "FREE"), 90)).toBe(30);
    expect(analyticsWindow(ruleFor(rules, "PREMIUM"), 90)).toBe(90);
    expect(analyticsWindow(ruleFor(rules, "ELITE"), 90)).toBe(90);
  });

  it("CSV export is an Elite benefit only", () => {
    expect(canExportCsv("ELITE")).toBe(true);
    expect(canExportCsv("PREMIUM")).toBe(false);
    expect(canExportCsv("FREE")).toBe(false);
  });
});
