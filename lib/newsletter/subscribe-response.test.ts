import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryEmailProvider, setEmailProviderForTests } from "@/lib/notify/email";

// The response must not reveal whether an address is subscribed: a new and a confirmed address
// get the same result. A confirmed address gets the preferences email instead of a new confirmation.

const prisma = vi.hoisted(() => ({
  emailSuppression: { findUnique: vi.fn() },
  newsletterSubscriber: { findUnique: vi.fn(), upsert: vi.fn() },
  newsletterConsent: { create: vi.fn() },
}));

vi.mock("@/lib/db/client", () => ({ prisma }));
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5, retryAfterSeconds: 0 })),
}));
vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ AUTH_SECRET: "x".repeat(40), NODE_ENV: "test", APP_URL: "http://localhost:3000" }),
}));
vi.mock("@/lib/audit/audit", () => ({ recordAudit: vi.fn() }));

import { requestSubscription } from "./service";

describe("requestSubscription response", () => {
  let provider: MemoryEmailProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MemoryEmailProvider();
    setEmailProviderForTests(provider);
    prisma.emailSuppression.findUnique.mockResolvedValue(null);
    prisma.newsletterSubscriber.upsert.mockResolvedValue({ id: "clnew1" });
    prisma.newsletterConsent.create.mockResolvedValue({});
  });

  it("gives the same result for a new address and a confirmed one", async () => {
    prisma.newsletterSubscriber.findUnique.mockResolvedValueOnce(null);
    const fresh = await requestSubscription({ email: "new@example.com", topics: ["EDUCATION"], source: "footer", ip: "203.0.113.5" });

    prisma.newsletterSubscriber.findUnique.mockResolvedValueOnce({ id: "clold1", status: "CONFIRMED" });
    const known = await requestSubscription({ email: "old@example.com", topics: ["EDUCATION"], source: "footer", ip: "203.0.113.5" });

    expect(fresh).toEqual({ ok: true });
    expect(known).toEqual(fresh);
  });

  it("sends a confirmation to a new address and a preferences email to a confirmed one", async () => {
    prisma.newsletterSubscriber.findUnique.mockResolvedValueOnce(null);
    await requestSubscription({ email: "new@example.com", topics: ["EDUCATION"], source: "footer", ip: null });
    expect(prisma.newsletterSubscriber.upsert).toHaveBeenCalledTimes(1);
    expect(provider.sent[0]?.subject).toMatch(/Confirm your/);

    provider.sent.length = 0;
    prisma.newsletterSubscriber.findUnique.mockResolvedValueOnce({ id: "clold1", status: "CONFIRMED" });
    await requestSubscription({ email: "old@example.com", topics: ["EDUCATION"], source: "footer", ip: null });
    expect(prisma.newsletterSubscriber.upsert).toHaveBeenCalledTimes(1); // unchanged: no new record written
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.subject).toMatch(/already subscribed/);
    expect(provider.sent[0]?.text).toMatch(/\/newsletter\/preferences\?token=clold1\./);
  });

  it("sends nothing to a suppressed address and still answers the same way", async () => {
    prisma.emailSuppression.findUnique.mockResolvedValueOnce({ email: "bounced@example.com" });
    const result = await requestSubscription({ email: "bounced@example.com", topics: ["EDUCATION"], source: "footer", ip: null });
    expect(result).toEqual({ ok: true });
    expect(provider.sent).toHaveLength(0);
  });
});
