import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryEmailProvider, setEmailProviderForTests } from "@/lib/notify/email";
import { CONSENT_TEXT, FOOTER_CONSENT_TEXT, consentTextFor } from "./messages";
import { NEWSLETTER_TOPICS, parseConsentScope, preferenceState } from "./topics";

// Consent record: the footer Subscribe stores scope ALL_TOPICS with the exact footer text; topic ticks store
// SELECTED_TOPICS. Confirmation copies the scope and text of the sign-up it confirms. No topic is ever defaulted.

const prisma = vi.hoisted(() => ({
  emailSuppression: { findUnique: vi.fn() },
  newsletterSubscriber: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  newsletterConsent: { create: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/lib/db/client", () => ({ prisma }));
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5, retryAfterSeconds: 0 })),
}));
vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ AUTH_SECRET: "x".repeat(40), NODE_ENV: "test", APP_URL: "http://localhost:3000" }),
}));
vi.mock("@/lib/audit/audit", () => ({ recordAudit: vi.fn() }));

import { confirmSubscription, requestSubscription } from "./service";

describe("consent record on sign-up", () => {
  let provider: MemoryEmailProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MemoryEmailProvider();
    setEmailProviderForTests(provider);
    prisma.emailSuppression.findUnique.mockResolvedValue(null);
    prisma.newsletterSubscriber.findUnique.mockResolvedValue(null);
    prisma.newsletterSubscriber.upsert.mockResolvedValue({ id: "clnew1" });
    prisma.newsletterConsent.create.mockResolvedValue({});
  });

  it("footer Subscribe records all topics, source footer and the exact footer text", async () => {
    await requestSubscription({ email: "reader@example.com", topics: [], source: "footer", scope: "ALL_TOPICS", consentText: FOOTER_CONSENT_TEXT, ip: "203.0.113.5" });

    const written = prisma.newsletterConsent.create.mock.calls[0]?.[0]?.data;
    expect(written).toMatchObject({ action: "REQUESTED", source: "footer", scope: "ALL_TOPICS", consentText: FOOTER_CONSENT_TEXT });
    expect(written.topics).toEqual([...NEWSLETTER_TOPICS]);
    expect(prisma.newsletterSubscriber.upsert.mock.calls[0]?.[0]?.create.topics).toEqual([...NEWSLETTER_TOPICS]);
    expect(written.ipHash).toEqual(expect.any(String));
    expect(written.ipHash).not.toContain("203.0.113.5");
  });

  it("footer scope ignores any topics sent with it and stores all topics", async () => {
    await requestSubscription({ email: "reader@example.com", topics: ["EDUCATION"], source: "footer", scope: "ALL_TOPICS", ip: null });
    expect(prisma.newsletterConsent.create.mock.calls[0]?.[0]?.data.topics).toEqual([...NEWSLETTER_TOPICS]);
  });

  it("selected topics store the chosen topics only, with the page consent text by default", async () => {
    await requestSubscription({ email: "reader@example.com", topics: ["MARKET_NEWS"], source: "newsletter-page", ip: null });
    const written = prisma.newsletterConsent.create.mock.calls[0]?.[0]?.data;
    expect(written).toMatchObject({ scope: "SELECTED_TOPICS", consentText: CONSENT_TEXT, topics: ["MARKET_NEWS"] });
  });

  it("refuses a selected-topics sign-up with no topic (no default ticks)", async () => {
    const result = await requestSubscription({ email: "reader@example.com", topics: [], source: "newsletter-page", ip: null });
    expect(result).toEqual({ ok: false, reason: "no_topic" });
    expect(prisma.newsletterConsent.create).not.toHaveBeenCalled();
  });

  it("stores null consent text when none was shown (account settings)", async () => {
    await requestSubscription({ email: "reader@example.com", topics: ["EDUCATION"], source: "account", scope: "SELECTED_TOPICS", consentText: null, ip: null });
    expect(prisma.newsletterConsent.create.mock.calls[0]?.[0]?.data).toMatchObject({ scope: "SELECTED_TOPICS", consentText: null });
  });

  it("confirmation copies the scope and consent text of the sign-up it confirms", async () => {
    const now = new Date("2026-11-10T06:00:00Z");
    prisma.newsletterSubscriber.findUnique.mockResolvedValueOnce({
      id: "clnew1",
      status: "PENDING",
      confirmExpiresAt: new Date(now.getTime() + 60_000),
      topics: [...NEWSLETTER_TOPICS],
    });
    prisma.newsletterSubscriber.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.newsletterConsent.findFirst.mockResolvedValueOnce({ scope: "ALL_TOPICS", consentText: FOOTER_CONSENT_TEXT });

    const outcome = await confirmSubscription("some-token", { ip: null, now });
    expect(outcome).toBe("CONFIRMED");
    expect(prisma.newsletterConsent.create.mock.calls[0]?.[0]?.data).toMatchObject({
      action: "CONFIRMED",
      scope: "ALL_TOPICS",
      consentText: FOOTER_CONSENT_TEXT,
    });
  });
});

describe("consent text and scope helpers", () => {
  it("maps each scope to the text shown beside its control", () => {
    expect(consentTextFor("ALL_TOPICS")).toBe(FOOTER_CONSENT_TEXT);
    expect(consentTextFor("SELECTED_TOPICS")).toBe(CONSENT_TEXT);
    expect(FOOTER_CONSENT_TEXT).toBe(
      "Get our newsletter: gemstone guides, market news and new listings. You can choose topics after confirming, and unsubscribe anytime.",
    );
  });

  it("treats anything other than ALL_TOPICS as selected topics", () => {
    expect(parseConsentScope("ALL_TOPICS")).toBe("ALL_TOPICS");
    expect(parseConsentScope("all")).toBe("SELECTED_TOPICS");
    expect(parseConsentScope(undefined)).toBe("SELECTED_TOPICS");
  });
});

describe("preference state", () => {
  it("ticks nothing for a subscriber with no recorded topics", () => {
    const state = preferenceState([]);
    expect(state.checked).toEqual([]);
    expect(state.allSubscribed).toBe(false);
  });

  it("reflects all topics as subscribed, with the all-topics sentence", () => {
    const state = preferenceState([...NEWSLETTER_TOPICS]);
    expect(state.checked).toEqual([...NEWSLETTER_TOPICS]);
    expect(state.allSubscribed).toBe(true);
    expect(state.explanation).toBe("You're subscribed to all topics. Untick any you don't want.");
  });

  it("ticks only the saved topics and uses a different sentence when some are unticked", () => {
    const state = preferenceState(["MARKET_NEWS", "EDUCATION"]);
    expect(state.checked).toEqual(["EDUCATION", "MARKET_NEWS"]);
    expect(state.allSubscribed).toBe(false);
    expect(state.explanation).not.toBe("You're subscribed to all topics. Untick any you don't want.");
  });
});
