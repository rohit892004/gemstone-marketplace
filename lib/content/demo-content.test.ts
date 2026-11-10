import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ NODE_ENV: "production" as "development" | "test" | "production", ALLOW_DEMO_SEED: "false" }));

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ NODE_ENV: env.NODE_ENV, ALLOW_DEMO_SEED: env.ALLOW_DEMO_SEED }),
}));

import type { PrismaClient } from "@/app/generated/prisma/client";
import { seedM6Content } from "@/prisma/seed-m6-content";
import { M6_DEMO_ARTICLES, M6_DEMO_REFERENCE, M6_DEMO_REFERENCE_CATEGORY_SLUGS } from "@/prisma/seed-m6-content-data";
import { renderMarkdown } from "./markdown";
import { REFERENCE_SECTIONS, referencePublishProblems } from "./reference-sections";
import { NEWS_CATEGORIES } from "./listing";
import { isHttpsUrl } from "./status";

describe("M6 demo content", () => {
  it("has eight education, guide and research items and five news items", () => {
    const byType = (type: string) => M6_DEMO_ARTICLES.filter((a) => a.type === type).length;
    expect(M6_DEMO_ARTICLES.filter((a) => a.type !== "NEWS")).toHaveLength(8);
    expect(byType("NEWS")).toBe(5);
    expect(byType("EDUCATION")).toBeGreaterThan(0);
    expect(byType("GUIDE")).toBeGreaterThan(0);
    expect(byType("RESEARCH")).toBeGreaterThan(0);
  });

  it("labels every title and summary as demo", () => {
    for (const item of M6_DEMO_ARTICLES) {
      expect(item.title.startsWith("Demo")).toBe(true);
      expect(item.summary.toLowerCase()).toContain("demo");
    }
    for (const entry of M6_DEMO_REFERENCE) expect(entry.summary.startsWith("Demo")).toBe(true);
  });

  it("uses fictional news sources only", () => {
    for (const item of M6_DEMO_ARTICLES.filter((a) => a.type === "NEWS")) {
      expect(item.sourceName?.startsWith("Demo source:")).toBe(true);
      expect(item.sourceUrl).toMatch(/^https:\/\/example\.com\/demo-news-\d+$/);
      expect(isHttpsUrl(item.sourceUrl!)).toBe(true);
      expect(NEWS_CATEGORIES).toContain(item.category);
    }
  });

  it("has exactly one scheduled item, in the future, and the rest published in the past", () => {
    const scheduled = M6_DEMO_ARTICLES.filter((a) => a.status === "SCHEDULED");
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.scheduledInDays).toBeGreaterThan(0);
    for (const item of M6_DEMO_ARTICLES.filter((a) => a.status === "PUBLISHED")) {
      expect(item.publishedDaysAgo).toBeGreaterThan(0);
    }
  });

  it("gives every category a reference page, and every reference page is publishable", () => {
    expect(M6_DEMO_REFERENCE).toHaveLength(7);
    expect(new Set(M6_DEMO_REFERENCE_CATEGORY_SLUGS)).toEqual(
      new Set(["diamond", "ruby", "sapphire", "emerald", "spinel", "tourmaline", "other-coloured-stones"]),
    );
    for (const entry of M6_DEMO_REFERENCE) {
      expect(referencePublishProblems({ ...entry })).toEqual([]);
      for (const section of REFERENCE_SECTIONS) expect(renderMarkdown(entry[section.key]).trim()).not.toBe("");
    }
  });

  it("refuses to seed in production or without ALLOW_DEMO_SEED, before touching the database", async () => {
    const touched = vi.fn();
    const client = new Proxy({} as Record<string, unknown>, { get: () => (touched(), undefined) }) as unknown as PrismaClient;

    env.NODE_ENV = "production";
    env.ALLOW_DEMO_SEED = "true";
    await expect(seedM6Content(client)).rejects.toThrow(/not allowed in production/);

    env.NODE_ENV = "development";
    env.ALLOW_DEMO_SEED = "false";
    await expect(seedM6Content(client)).rejects.toThrow(/ALLOW_DEMO_SEED/);
    expect(touched).not.toHaveBeenCalled();
  });

  it("renders every demo body through the safe renderer", () => {
    for (const item of M6_DEMO_ARTICLES) expect(renderMarkdown(item.body)).toContain("<");
  });
});
