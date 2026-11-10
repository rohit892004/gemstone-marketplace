import { describe, expect, it, vi } from "vitest";
import { buildCoverKey, coverContentType, coverExtensionFor, isCoverKey } from "./cover";
import { orderRelated, relatedScore } from "./related";
import {
  cleanSearch,
  cleanTag,
  educationTabFilter,
  pageCount,
  parseEducationTab,
  parseNewsCategory,
  parsePageNumber,
  NEWS_CATEGORIES,
} from "./listing";
import { buildReferenceSections, referencePublishProblems, REFERENCE_SECTIONS, type ReferenceMarkdown } from "./reference-sections";
import { renderMarkdown } from "./markdown";

const HEX = "0123456789abcdef";

describe("cover keys", () => {
  it("accepts keys under content/ with a jpg or png extension", () => {
    expect(isCoverKey(`content/cm3abc123/cover-${HEX}.jpg`)).toBe(true);
    expect(isCoverKey(`content/cm3abc123/cover-${HEX}.png`)).toBe(true);
  });

  it("refuses other storage keys, traversal, uppercase and other extensions", () => {
    expect(isCoverKey(`sellers/abc/cover-${HEX}.jpg`)).toBe(false);
    expect(isCoverKey(`content/../sellers/cover-${HEX}.jpg`)).toBe(false);
    expect(isCoverKey(`content/abc/cover-${HEX}.gif`)).toBe(false);
    expect(isCoverKey(`content/abc/cover-${HEX}.pdf`)).toBe(false);
    expect(isCoverKey(`content/ABC/cover-${HEX}.jpg`)).toBe(false);
    expect(isCoverKey(`content/abc/cover-zz.jpg`)).toBe(false);
  });

  it("builds a valid key and refuses an invalid one", () => {
    expect(buildCoverKey("cm3abc", "png", HEX.slice(0, 16))).toBe(`content/cm3abc/cover-${HEX.slice(0, 16)}.png`);
    expect(() => buildCoverKey("../x", "jpg", HEX)).toThrow();
  });

  it("maps keys to content types and sniffed MIME types to extensions", () => {
    expect(coverContentType(`content/a/cover-${HEX}.png`)).toBe("image/png");
    expect(coverContentType(`content/a/cover-${HEX}.jpg`)).toBe("image/jpeg");
    expect(coverContentType("sellers/a/doc.pdf")).toBeNull();
    expect(coverExtensionFor("image/jpeg")).toBe("jpg");
    expect(coverExtensionFor("application/pdf")).toBeNull();
  });
});

describe("listing helpers", () => {
  it("falls back to the all tab and never includes NEWS", () => {
    expect(parseEducationTab("nope").id).toBe("all");
    expect(educationTabFilter(parseEducationTab("all"))).toEqual({ types: ["EDUCATION", "GUIDE", "RESEARCH"] });
    expect(educationTabFilter(parseEducationTab("guides"))).toEqual({ type: "GUIDE" });
  });

  it("accepts only the fixed news categories", () => {
    expect(NEWS_CATEGORIES).toContain("Market");
    expect(parseNewsCategory("Market")).toBe("Market");
    expect(parseNewsCategory("market")).toBeNull();
    expect(parseNewsCategory("Market OR 1=1")).toBeNull();
    expect(parseNewsCategory(undefined)).toBeNull();
  });

  it("normalises search text and tags", () => {
    expect(cleanSearch("  ruby\u0000  heat ")).toBe("ruby   heat");
    expect(cleanSearch("x".repeat(500))).toHaveLength(120);
    expect(cleanTag("  Heat Treatment!! ")).toBe("heat-treatment");
    expect(cleanTag("!!!")).toBeNull();
  });

  it("parses page numbers defensively", () => {
    expect(parsePageNumber("3")).toBe(3);
    expect(parsePageNumber("-4")).toBe(1);
    expect(parsePageNumber("abc")).toBe(1);
    expect(parsePageNumber("999999")).toBe(1000);
    expect(pageCount(0, 12)).toBe(1);
    expect(pageCount(25, 12)).toBe(3);
  });
});

describe("related content ordering", () => {
  const article = { id: "a", type: "GUIDE", tags: ["ruby", "heat"] };
  const at = (day: number) => new Date(Date.UTC(2026, 0, day));

  it("scores shared tags above the same type", () => {
    expect(relatedScore(article, { id: "b", type: "GUIDE", tags: [], publishedAt: null })).toBe(1);
    expect(relatedScore(article, { id: "b", type: "NEWS", tags: ["heat"], publishedAt: null })).toBe(2);
  });

  it("orders by score, then newest, excludes itself and unrelated items", () => {
    const ordered = orderRelated(
      article,
      [
        { id: "a", type: "GUIDE", tags: ["ruby"], publishedAt: at(9) },
        { id: "c", type: "EDUCATION", tags: [], publishedAt: at(9) },
        { id: "d", type: "GUIDE", tags: [], publishedAt: at(8) },
        { id: "e", type: "EDUCATION", tags: ["ruby"], publishedAt: at(1) },
        { id: "f", type: "EDUCATION", tags: ["ruby", "heat"], publishedAt: at(2) },
      ],
      10,
    );
    expect(ordered.map((r) => r.id)).toEqual(["f", "e", "d"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `x${i}`, type: "GUIDE", tags: [], publishedAt: at(i + 1) }));
    expect(orderRelated(article, many, 3)).toHaveLength(3);
  });
});

describe("reference page builder", () => {
  const source: ReferenceMarkdown = {
    properties: "**Hardness** 9 on Mohs.",
    origins: "Mined in *Myanmar* and Sri Lanka.",
    treatments: "Heat treatment is common.",
    qualityGuide: "Look at colour first.",
    care: "Avoid ultrasonic cleaners.",
    priceFactors: "Carat weight and colour.",
  };

  it("renders every section, in order, through renderMarkdown", () => {
    const render = vi.fn((markdown: string) => renderMarkdown(markdown));
    const sections = buildReferenceSections(source, render);

    expect(sections.map((s) => s.key)).toEqual(REFERENCE_SECTIONS.map((s) => s.key));
    expect(render).toHaveBeenCalledTimes(REFERENCE_SECTIONS.length);
    for (const { key } of REFERENCE_SECTIONS) expect(render).toHaveBeenCalledWith(source[key]);
    expect(sections[0]!.html).toContain("<strong>Hardness</strong>");
    expect(sections[1]!.html).toContain("<em>Myanmar</em>");
  });

  it("gives empty html for empty sections without rendering them", () => {
    const render = vi.fn(() => "<p>x</p>");
    const sections = buildReferenceSections({ ...source, care: "   " }, render);
    expect(sections.find((s) => s.key === "care")!.html).toBe("");
    expect(render).toHaveBeenCalledTimes(REFERENCE_SECTIONS.length - 1);
  });

  it("sanitises raw HTML inside a section", () => {
    const [properties] = buildReferenceSections({ ...source, properties: '<script>alert(1)</script>' });
    expect(properties!.html).not.toContain("<script>");
  });

  it("lists what blocks publishing", () => {
    const problems = referencePublishProblems({
      name: "Ruby",
      summary: "",
      categorySlug: "ruby",
      ...source,
      care: "",
    });
    expect(problems.map((p) => p.field)).toEqual(["summary", "care"]);
    expect(referencePublishProblems({ name: "Ruby", summary: "s", categorySlug: "ruby", ...source })).toEqual([]);
  });
});
