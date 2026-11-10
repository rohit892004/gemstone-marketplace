import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  runFound: null as null | { id: string },
  createError: null as null | { code: string },
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

vi.mock("@/lib/notify/email", () => ({
  getEmailProvider: () => ({ send: vi.fn(async () => undefined) }),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    newsletterDigestRun: {
      findUnique: vi.fn(async () => db.runFound),
      create: vi.fn(async () => {
        if (db.createError) throw db.createError;
        return { id: "run1" };
      }),
      update: vi.fn(async () => ({})),
    },
    article: { findMany: vi.fn(async () => []) },
    gemstone: { findMany: vi.fn(async () => []) },
    newsletterSubscriber: { findMany: vi.fn(async () => []) },
    emailSuppression: { findMany: vi.fn(async () => []) },
  },
}));

import {
  digestDue,
  digestDueAt,
  digestItemsFromSource,
  digestText,
  isoWeekKey,
  itemsForSubscriber,
  sendWeeklyDigestIfDue,
  type DigestItem,
} from "./digest";

const SOURCE = {
  articles: [
    { title: "Sapphire guide", slug: "sapphire-guide", type: "GUIDE" as const },
    { title: "Ruby research", slug: "ruby-research", type: "RESEARCH" as const },
    { title: "Mine opens", slug: "mine-opens", type: "NEWS" as const },
  ],
  gemstones: [{ title: "Blue sapphire 2 ct", slug: "blue-sapphire-2ct" }],
};

describe("ISO week key", () => {
  it("names the ISO week, including the year boundary", () => {
    expect(isoWeekKey(new Date("2026-11-10T06:00:00Z"))).toBe("2026-W46");
    expect(isoWeekKey(new Date("2026-11-08T23:59:00Z"))).toBe("2026-W45"); // Sunday is still the previous week
    expect(isoWeekKey(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
    expect(isoWeekKey(new Date("2026-01-01T12:00:00Z"))).toBe("2026-W01");
  });
});

describe("digest due time", () => {
  it("is due from Monday 03:30 UTC of the same ISO week", () => {
    expect(digestDueAt(new Date("2026-11-10T06:00:00Z")).toISOString()).toBe("2026-11-09T03:30:00.000Z");
    expect(digestDue(new Date("2026-11-09T03:29:59Z"))).toBe(false);
    expect(digestDue(new Date("2026-11-09T03:30:00Z"))).toBe(true);
    // Sunday evening belongs to the week whose Monday already passed.
    expect(digestDue(new Date("2026-11-08T23:00:00Z"))).toBe(true);
  });
});

describe("digest content", () => {
  it("groups items by topic: education types, news, and new listings. Platform updates get nothing", () => {
    const items = digestItemsFromSource(SOURCE);
    expect(items.map((i) => [i.topic, i.kind])).toEqual([
      ["EDUCATION", "GUIDE"],
      ["EDUCATION", "RESEARCH"],
      ["MARKET_NEWS", "NEWS"],
      ["NEW_LISTINGS", "LISTING"],
    ]);
    expect(items.some((i) => i.topic === "PLATFORM_UPDATES")).toBe(false);
    expect(items.find((i) => i.kind === "LISTING")?.url).toBe("/gemstones/blue-sapphire-2ct");
    expect(items.find((i) => i.kind === "NEWS")?.url).toBe("/news/mine-opens");
  });

  it("gives each subscriber only the topics they chose that have items", () => {
    const items = digestItemsFromSource(SOURCE);
    const sections = itemsForSubscriber(items, ["NEW_LISTINGS", "PLATFORM_UPDATES"]);
    expect([...sections.keys()]).toEqual(["NEW_LISTINGS"]);
    expect(sections.get("NEW_LISTINGS")).toHaveLength(1);
  });

  it("returns no text when nothing matches, so nothing is sent", () => {
    const items: DigestItem[] = digestItemsFromSource({ articles: [], gemstones: [] });
    expect(digestText(itemsForSubscriber(items, ["EDUCATION"]), "tok")).toBeNull();
  });

  it("builds a plain-text body with links and the footer", () => {
    const sections = itemsForSubscriber(digestItemsFromSource(SOURCE), ["EDUCATION", "MARKET_NEWS"]);
    const text = digestText(sections, "tok123")!;
    expect(text).toContain("Sapphire guide: https://example.test/learn/sapphire-guide");
    expect(text).toContain("Mine opens: https://example.test/news/mine-opens");
    expect(text).not.toContain("Blue sapphire");
    expect(text).toContain("Unsubscribe: https://example.test/newsletter/unsubscribe?token=tok123");
  });
});

describe("sendWeeklyDigestIfDue", () => {
  beforeEach(() => {
    db.runFound = null;
    db.createError = null;
  });

  it("does nothing before the week's due time", async () => {
    const result = await sendWeeklyDigestIfDue(new Date("2026-11-09T02:00:00Z"));
    expect(result).toEqual({ ran: true, value: { status: "not_due" } });
  });

  it("does nothing when the period already has a run", async () => {
    db.runFound = { id: "run0" };
    const result = await sendWeeklyDigestIfDue(new Date("2026-11-10T06:00:00Z"));
    expect(result).toEqual({ ran: true, value: { status: "already_sent" } });
  });

  it("treats a unique-key conflict on create as already sent", async () => {
    db.createError = { code: "P2002" };
    const result = await sendWeeklyDigestIfDue(new Date("2026-11-10T06:00:00Z"));
    expect(result).toEqual({ ran: true, value: { status: "already_sent" } });
  });
});
