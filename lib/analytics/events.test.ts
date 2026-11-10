import { describe, expect, it } from "vitest";
import {
  dayKey,
  looksLikeContactDetail,
  dedupeKeyFor,
  isBotUserAgent,
  normaliseTerm,
  retentionCutoff,
  shouldRecord,
  visitorHash,
} from "./events";

const browser = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

describe("visitorHash", () => {
  it("changes every day for the same visitor", () => {
    expect(visitorHash("abc", "2026-11-10", "s")).not.toBe(visitorHash("abc", "2026-11-11", "s"));
  });
  it("does not contain the raw cookie and depends on the secret", () => {
    const h = visitorHash("visitor-cookie-123", "2026-11-10", "s");
    expect(h).not.toContain("visitor-cookie-123");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(visitorHash("visitor-cookie-123", "2026-11-10", "other"));
  });
});

describe("dedupeKeyFor", () => {
  it("is set for views, so a repeat view in the same day is a no-op", () => {
    expect(dedupeKeyFor("LISTING_VIEW", "2026-11-10", "h", "g1")).toBe("LISTING_VIEW:2026-11-10:h:g1");
    expect(dedupeKeyFor("PROFILE_VIEW", "2026-11-10", "h", "s1")).not.toBeNull();
  });
  it("is set for impressions and wishlist adds, and null for other actions", () => {
    expect(dedupeKeyFor("WISHLIST_ADD", "2026-11-10", "h", "g1")).not.toBeNull();
    expect(dedupeKeyFor("LISTING_IMPRESSION", "2026-11-10", "h", "g1")).not.toBeNull();
    expect(dedupeKeyFor("ENQUIRY_STARTED", "2026-11-10", "h", "g1")).toBeNull();
  });
  it("is null with no visitor", () => {
    expect(dedupeKeyFor("LISTING_VIEW", "2026-11-10", null, "g1")).toBeNull();
  });
});

describe("normaliseTerm", () => {
  it("trims, lower-cases and collapses spaces", () => {
    expect(normaliseTerm("  Blue   SAPPHIRE ")).toBe("blue sapphire");
  });
  it("drops single characters and empty input", () => {
    expect(normaliseTerm("a")).toBeNull();
    expect(normaliseTerm("   ")).toBeNull();
    expect(normaliseTerm(null)).toBeNull();
  });
  it("caps the length", () => {
    expect(normaliseTerm("x".repeat(200))?.length).toBe(80);
  });
});

describe("isBotUserAgent", () => {
  it("treats a browser as a person", () => {
    expect(isBotUserAgent(browser)).toBe(false);
  });
  it("treats crawlers, headless browsers and empty agents as bots", () => {
    expect(isBotUserAgent("Googlebot/2.1")).toBe(true);
    expect(isBotUserAgent("HeadlessChrome/120")).toBe(true);
    expect(isBotUserAgent("curl/8.0")).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
  });
});

describe("shouldRecord", () => {
  const base = { actorRole: null, actorUserId: null, ownerUserId: "seller-user", userAgent: browser };

  it("records a visitor's view", () => {
    expect(shouldRecord(base)).toEqual({ record: true, reason: "ok" });
  });
  it("does not record admins or valuators", () => {
    expect(shouldRecord({ ...base, actorRole: "ADMIN", actorUserId: "a" }).reason).toBe("staff");
    expect(shouldRecord({ ...base, actorRole: "VALUATOR", actorUserId: "v" }).reason).toBe("staff");
  });
  it("does not record a seller viewing their own page", () => {
    expect(shouldRecord({ ...base, actorRole: "SELLER", actorUserId: "seller-user" })).toEqual({ record: false, reason: "own-page" });
  });
  it("records a different seller viewing the page", () => {
    expect(shouldRecord({ ...base, actorRole: "SELLER", actorUserId: "other-seller" }).record).toBe(true);
  });
  it("does not record bots", () => {
    expect(shouldRecord({ ...base, userAgent: "Googlebot" }).reason).toBe("bot");
  });
});

describe("retention and day keys", () => {
  it("keeps 90 days", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(retentionCutoff(now).toISOString()).toBe("2026-08-12T12:00:00.000Z");
  });
  it("uses the UTC day", () => {
    expect(dayKey(new Date("2026-11-10T23:30:00Z"))).toBe("2026-11-10");
  });
});

describe("looksLikeContactDetail", () => {
  it("flags emails, web addresses, bare domains and phone numbers", () => {
    expect(looksLikeContactDetail("ring jane@example.com")).toBe(true);
    expect(looksLikeContactDetail("www.shop-example.in")).toBe(true);
    expect(looksLikeContactDetail("https://x.test/a")).toBe(true);
    expect(looksLikeContactDetail("call 98765 43210")).toBe(true);
  });
  it("lets ordinary gemstone searches through", () => {
    expect(looksLikeContactDetail("blue sapphire 2 ct")).toBe(false);
    expect(looksLikeContactDetail("burmese ruby")).toBe(false);
  });
});
