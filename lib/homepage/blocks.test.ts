import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ prisma: {} }));

import { HOMEPAGE_DEFAULTS, homepageBlockSchemas, isHomepageBlockKey, parseHomepageBlock } from "./blocks";

const validHero = {
  headline: "Find your stone",
  subheadline: "Verified sellers.",
  primaryCtaLabel: "Browse",
  primaryCtaHref: "/gemstones",
  secondaryCtaLabel: "Value",
  secondaryCtaHref: "/valuation",
};

describe("homepage block schemas", () => {
  it("accepts a valid hero", () => {
    expect(homepageBlockSchemas.hero.safeParse(validHero).success).toBe(true);
  });

  it("rejects unknown fields inside a block", () => {
    const result = homepageBlockSchemas.hero.safeParse({ ...validHero, html: "<b>x</b>" });
    expect(result.success).toBe(false);
  });

  it("rejects absolute and protocol-relative hrefs", () => {
    for (const href of ["https://evil.example", "//evil.example", "javascript:alert(1)", "gemstones", "/\\evil"]) {
      const result = homepageBlockSchemas.hero.safeParse({ ...validHero, primaryCtaHref: href });
      expect(result.success, href).toBe(false);
    }
  });

  it("caps text fields at 300 characters", () => {
    const result = homepageBlockSchemas.hero.safeParse({ ...validHero, headline: "a".repeat(301) });
    expect(result.success).toBe(false);
  });

  it("only knows the six homepage keys", () => {
    expect(Object.keys(homepageBlockSchemas).sort()).toEqual(
      ["categoriesHeading", "educationTeaser", "hero", "newsTeaser", "newsletterTeaser", "valuationTeaser"].sort(),
    );
    expect(isHomepageBlockKey("hero")).toBe(true);
    expect(isHomepageBlockKey("adminBanner")).toBe(false);
    expect(isHomepageBlockKey("__proto__")).toBe(false);
  });

  it("does not allow a CTA on the newsletter teaser", () => {
    const result = homepageBlockSchemas.newsletterTeaser.safeParse({
      heading: "News",
      body: "Body",
      ctaHref: "/x",
    });
    expect(result.success).toBe(false);
  });

  it("falls back to defaults for invalid stored content", () => {
    expect(parseHomepageBlock("hero", { headline: "x" })).toEqual(HOMEPAGE_DEFAULTS.hero);
  });

  it("returns valid stored content as parsed", () => {
    expect(parseHomepageBlock("hero", validHero)).toEqual(validHero);
  });
});
