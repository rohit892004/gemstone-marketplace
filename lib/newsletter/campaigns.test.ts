import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the tables the send loop touches. Each test resets it.
const store = vi.hoisted(() => ({
  campaigns: new Map<string, { id: string; status: string; subject: string; body: string; topics: string[]; scheduledFor: Date | null; sentAt: Date | null; sentCount: number; failedCount: number; skippedCount: number; recipientCount: number }>(),
  subscribers: [] as { id: string; email: string; status: string; topics: string[] }[],
  suppressed: new Set<string>(),
  sends: [] as { id: string; campaignId: string; subscriberId: string; status: string; attempts: number; lastError: string | null; sentAt: Date | null }[],
  sent: [] as { to: string; subject: string; text: string; headers?: Record<string, string> }[],
  failEmails: new Set<string>(),
  sendSeq: 0,
}));

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ APP_URL: "https://example.test", NODE_ENV: "test", AUTH_SECRET: "x".repeat(40) }),
}));

vi.mock("@/lib/newsletter/service", () => ({
  linkSecret: () => "s".repeat(40),
}));

vi.mock("@/lib/jobs/lock", () => ({
  runExclusive: async (_name: string, fn: () => Promise<unknown>) => ({ ran: true, value: await fn() }),
}));

vi.mock("@/lib/audit/audit", () => ({ recordAudit: vi.fn(async () => undefined) }));

vi.mock("@/lib/notify/email", () => ({
  getEmailProvider: () => ({
    send: async (message: { to: string; subject: string; text: string; headers?: Record<string, string> }) => {
      if (store.failEmails.has(message.to)) throw new Error("provider timeout");
      store.sent.push(message);
    },
  }),
}));

function matchesStatus(value: string, where: { status?: unknown }): boolean {
  if (!where.status) return true;
  if (typeof where.status === "string") return value === where.status;
  const allowed = (where.status as { in?: string[] }).in;
  return allowed ? allowed.includes(value) : true;
}

vi.mock("@/lib/db/client", () => ({
  prisma: {
    newsletterCampaign: {
      findMany: async ({ where }: { where: { status?: unknown; scheduledFor?: { lte: Date } } }) =>
        [...store.campaigns.values()]
          .filter((c) => matchesStatus(c.status, where))
          .filter((c) => !where.scheduledFor || (c.scheduledFor !== null && c.scheduledFor <= where.scheduledFor.lte))
          .map((c) => ({ id: c.id })),
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => store.campaigns.get(where.id),
      updateMany: async ({ where, data }: { where: { id: string; status?: string }; data: Record<string, unknown> }) => {
        const c = store.campaigns.get(where.id);
        if (!c || (where.status && c.status !== where.status)) return { count: 0 };
        Object.assign(c, data);
        return { count: 1 };
      },
    },
    newsletterSubscriber: {
      findMany: async ({ where }: { where: { status: string; topics?: { hasSome: string[] } } }) =>
        store.subscribers.filter(
          (s) => s.status === where.status && (!where.topics || s.topics.some((t) => where.topics!.hasSome.includes(t))),
        ),
    },
    emailSuppression: {
      findMany: async ({ where }: { where: { email: { in: string[] } } }) =>
        where.email.in.filter((e) => store.suppressed.has(e)).map((email) => ({ email })),
    },
    newsletterSend: {
      count: async ({ where }: { where: { campaignId: string; status?: string } }) =>
        store.sends.filter((s) => s.campaignId === where.campaignId && (!where.status || s.status === where.status)).length,
      createMany: async ({ data }: { data: { campaignId: string; subscriberId: string; status: string; lastError: string | null }[] }) => {
        for (const row of data) store.sends.push({ id: `send${++store.sendSeq}`, attempts: 0, sentAt: null, ...row });
        return { count: data.length };
      },
      findMany: async ({ where, take }: { where: { campaignId: string; status: string; id?: { gt: string } }; take: number }) =>
        store.sends
          .filter((s) => s.campaignId === where.campaignId && s.status === where.status && (!where.id || s.id > where.id.gt))
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .slice(0, take)
          .map((s) => {
            const sub = store.subscribers.find((x) => x.id === s.subscriberId)!;
            return { id: s.id, attempts: s.attempts, subscriber: { id: sub.id, email: sub.email, status: sub.status, topics: sub.topics } };
          }),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = store.sends.find((s) => s.id === where.id)!;
        const attempts = data.attempts as number | { increment: number } | undefined;
        if (typeof attempts === "number") row.attempts = attempts;
        else if (attempts) row.attempts += attempts.increment;
        if (data.status) row.status = data.status as string;
        if ("lastError" in data) row.lastError = data.lastError as string | null;
        if (data.sentAt) row.sentAt = data.sentAt as Date;
        return row;
      },
      groupBy: async ({ where }: { where: { campaignId: string } }) => {
        const counts = new Map<string, number>();
        for (const s of store.sends.filter((x) => x.campaignId === where.campaignId)) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
        return [...counts].map(([status, n]) => ({ status, _count: { _all: n } }));
      },
    },
  },
}));

import {
  campaignText,
  parseCampaignInput,
  processDueCampaigns,
  recipientDecision,
  scheduleProblem,
  selectRecipients,
  MAX_SEND_ATTEMPTS,
} from "./campaigns";

const NOW = new Date("2026-11-10T06:00:00Z");

beforeEach(() => {
  store.campaigns.clear();
  store.subscribers = [];
  store.suppressed = new Set();
  store.sends = [];
  store.sent = [];
  store.failEmails = new Set();
  store.sendSeq = 0;
});

describe("parseCampaignInput", () => {
  it("keeps known topics only and requires one", () => {
    const ok = parseCampaignInput({ subject: " Hello ", preheader: "", body: "Body", topics: ["EDUCATION", "NOPE"] });
    expect(ok).toEqual({ ok: true, value: { subject: "Hello", preheader: null, body: "Body", topics: ["EDUCATION"] } });
    const none = parseCampaignInput({ subject: "Hello", preheader: "", body: "Body", topics: ["NOPE"] });
    expect(none.ok).toBe(false);
  });

  it("refuses an empty subject or body", () => {
    expect(parseCampaignInput({ subject: "", preheader: "", body: "x", topics: ["EDUCATION"] }).ok).toBe(false);
    expect(parseCampaignInput({ subject: "x", preheader: "", body: "  ", topics: ["EDUCATION"] }).ok).toBe(false);
  });
});

describe("scheduleProblem", () => {
  it("needs a valid time in the future", () => {
    expect(scheduleProblem(null, NOW)).not.toBeNull();
    expect(scheduleProblem(new Date("not a date"), NOW)).not.toBeNull();
    expect(scheduleProblem(new Date("2026-11-10T05:59:00Z"), NOW)).not.toBeNull();
    expect(scheduleProblem(new Date("2026-11-10T06:00:00Z"), NOW)).not.toBeNull();
    expect(scheduleProblem(new Date("2026-11-10T06:01:00Z"), NOW)).toBeNull();
  });
});

describe("recipient filtering", () => {
  const confirmed = { status: "CONFIRMED" as const, topics: ["EDUCATION"] };

  it("sends only to confirmed, unsuppressed subscribers with a matching topic", () => {
    expect(recipientDecision(confirmed, ["EDUCATION"], false)).toEqual({ send: true });
    expect(recipientDecision(confirmed, ["EDUCATION"], true)).toEqual({ send: false, reason: "suppressed" });
    expect(recipientDecision(confirmed, ["MARKET_NEWS"], false)).toEqual({ send: false, reason: "no_matching_topic" });
    expect(recipientDecision({ status: "PENDING", topics: ["EDUCATION"] }, ["EDUCATION"], false)).toEqual({
      send: false,
      reason: "not_confirmed",
    });
  });

  it("selects recipient ids and drops suppressed addresses", () => {
    const candidates = [
      { id: "a", email: "a@x.test", status: "CONFIRMED" as const, topics: ["EDUCATION"] },
      { id: "b", email: "b@x.test", status: "CONFIRMED" as const, topics: ["EDUCATION"] },
      { id: "c", email: "c@x.test", status: "UNSUBSCRIBED" as const, topics: ["EDUCATION"] },
    ];
    expect(selectRecipients(candidates, ["EDUCATION"], new Set(["b@x.test"]))).toEqual(["a"]);
  });
});

describe("campaignText", () => {
  it("adds the footer with preference and unsubscribe links and no HTML", () => {
    const text = campaignText("## Heading\n\nHello **there**", "tok123");
    expect(text).toContain("Hello there");
    expect(text).not.toContain("<");
    expect(text).toContain("https://example.test/newsletter/preferences?token=tok123");
    expect(text).toContain("https://example.test/newsletter/unsubscribe?token=tok123");
  });
});

describe("processDueCampaigns send loop", () => {
  function seed(): void {
    store.campaigns.set("camp00000000000001", {
      id: "camp00000000000001",
      status: "SCHEDULED",
      subject: "Market note",
      body: "Hello **there**",
      topics: ["EDUCATION"],
      scheduledFor: new Date("2026-11-10T05:00:00Z"),
      sentAt: null,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      recipientCount: 0,
    });
    store.subscribers = [
      { id: "sub1", email: "a@x.test", status: "CONFIRMED", topics: ["EDUCATION"] },
      { id: "sub2", email: "b@x.test", status: "CONFIRMED", topics: ["EDUCATION"] },
      { id: "sub3", email: "c@x.test", status: "PENDING", topics: ["EDUCATION"] },
      { id: "sub4", email: "d@x.test", status: "CONFIRMED", topics: ["MARKET_NEWS"] },
      { id: "sub5", email: "f@x.test", status: "CONFIRMED", topics: ["EDUCATION"] },
    ];
    store.suppressed = new Set(["b@x.test"]);
  }

  it("claims a due campaign, skips suppressed, retries a failure, then finishes", async () => {
    seed();
    store.failEmails = new Set(["f@x.test"]);

    const first = await processDueCampaigns(NOW);
    // Suppressed recipients are marked SKIPPED at snapshot time, so the loop itself reports no skips.
    expect(first).toMatchObject({ ran: true, value: { campaigns: 1, sent: 1, skipped: 0, retrying: 1, failed: 0 } });
    expect(store.campaigns.get("camp00000000000001")!.status).toBe("SENDING");
    const failed = store.sends.find((s) => s.subscriberId === "sub5")!;
    expect(failed).toMatchObject({ status: "QUEUED", attempts: 1, lastError: "provider timeout" });
    expect(store.sends.find((s) => s.subscriberId === "sub2")).toMatchObject({ status: "SKIPPED", lastError: "suppressed" });
    expect(store.sends.find((s) => s.subscriberId === "sub3")).toBeUndefined();
    expect(store.sends.find((s) => s.subscriberId === "sub4")).toBeUndefined();

    store.failEmails = new Set();
    const second = await processDueCampaigns(NOW);
    expect(second).toMatchObject({ ran: true, value: { sent: 1, retrying: 0 } });

    const campaign = store.campaigns.get("camp00000000000001")!;
    expect(campaign).toMatchObject({ status: "SENT", sentCount: 2, skippedCount: 1, failedCount: 0, recipientCount: 3 });
    expect(store.sent.map((m) => m.to).sort()).toEqual(["a@x.test", "f@x.test"]);
  });

  it("sends with one-click unsubscribe headers and the footer", async () => {
    seed();
    await processDueCampaigns(NOW);
    const message = store.sent.find((m) => m.to === "a@x.test")!;
    expect(message.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(message.headers?.["List-Unsubscribe"]).toContain("/api/newsletter/unsubscribe?token=");
    expect(message.text).toContain("Unsubscribe: https://example.test/newsletter/unsubscribe?token=");
  });

  it("does not touch campaigns that are not due yet", async () => {
    seed();
    store.campaigns.get("camp00000000000001")!.scheduledFor = new Date("2026-11-11T05:00:00Z");
    const result = await processDueCampaigns(NOW);
    expect(result).toMatchObject({ ran: true, value: { campaigns: 0 } });
    expect(store.campaigns.get("camp00000000000001")!.status).toBe("SCHEDULED");
  });

  it("marks a row FAILED after the last attempt", async () => {
    seed();
    store.failEmails = new Set(["f@x.test"]);
    for (let i = 0; i < MAX_SEND_ATTEMPTS; i += 1) await processDueCampaigns(NOW);
    expect(store.sends.find((s) => s.subscriberId === "sub5")).toMatchObject({ status: "FAILED", attempts: MAX_SEND_ATTEMPTS });
    expect(store.campaigns.get("camp00000000000001")!.status).toBe("SENT");
    expect(store.campaigns.get("camp00000000000001")!.failedCount).toBe(1);
  });
});
