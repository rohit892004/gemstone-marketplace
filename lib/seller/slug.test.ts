import { describe, expect, it } from "vitest";
import { generateSellerSlug } from "./slug";
import { sanitizeFileName } from "./sanitize-filename";

const URL_SAFE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("generateSellerSlug", () => {
  it("produces a lowercase, hyphenated, URL-safe slug", () => {
    const slug = generateSellerSlug("  Rajesh Gems & Co. (Pvt) Ltd!  ");
    expect(slug).toMatch(URL_SAFE);
    expect(slug.startsWith("rajesh-gems-co-pvt-ltd-")).toBe(true);
  });

  it("transliterates accents and strips unsafe characters", () => {
    expect(generateSellerSlug("Émeraude/../<script>")).toMatch(URL_SAFE);
    expect(generateSellerSlug("Émeraude")).toMatch(/^emeraude-[0-9a-f]{6}$/);
  });

  it("falls back to 'seller' when the name has no usable characters", () => {
    expect(generateSellerSlug("!!!")).toMatch(/^seller-[0-9a-f]{6}$/);
  });

  it("keeps slugs short even for long business names", () => {
    const slug = generateSellerSlug("A".repeat(300));
    expect(slug.length).toBeLessThanOrEqual(60 + 1 + 6);
    expect(slug).toMatch(URL_SAFE);
  });

  it("is unique across two calls for the same business name", () => {
    const first = generateSellerSlug("Rao Gems");
    const second = generateSellerSlug("Rao Gems");
    expect(first).not.toBe(second);
    expect(first).toMatch(URL_SAFE);
    expect(second).toMatch(URL_SAFE);
  });
});

describe("sanitizeFileName", () => {
  it("drops path parts and keeps only safe characters", () => {
    expect(sanitizeFileName("..\\..\\secret/GIA report (final)*.pdf")).toBe("GIA report final.pdf");
  });

  it("caps the length at 120 characters", () => {
    expect(sanitizeFileName(`${"a".repeat(200)}.pdf`)).toHaveLength(120);
  });

  it("returns a default name when nothing usable remains", () => {
    expect(sanitizeFileName("<<<>>>")).toBe("document");
  });
});
