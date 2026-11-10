import { describe, expect, it } from "vitest";
import {
  canTransition,
  isPubliclyVisible,
  publishProblems,
  scheduleProblem,
  slugify,
  uniqueSlug,
} from "./status";

const now = new Date("2026-11-10T06:00:00Z");

describe("canTransition", () => {
  it("allows the editorial flow", () => {
    expect(canTransition("DRAFT", "SCHEDULED")).toBe(true);
    expect(canTransition("SCHEDULED", "PUBLISHED")).toBe(true);
    expect(canTransition("PUBLISHED", "ARCHIVED")).toBe(true);
    expect(canTransition("ARCHIVED", "DRAFT")).toBe(true);
  });

  it("does not allow archived content to publish directly, or a no-op change", () => {
    expect(canTransition("ARCHIVED", "PUBLISHED")).toBe(false);
    expect(canTransition("PUBLISHED", "PUBLISHED")).toBe(false);
  });
});

describe("publishProblems", () => {
  const base = { type: "GUIDE" as const, title: "Care for sapphire", body: "Clean gently." };

  it("passes a complete guide", () => {
    expect(publishProblems(base)).toEqual([]);
  });

  it("requires a title and a body", () => {
    const fields = publishProblems({ ...base, title: "  ", body: "" }).map((p) => p.field);
    expect(fields).toEqual(["title", "body"]);
  });

  it("requires a source name and an https source link for news", () => {
    const fields = publishProblems({ ...base, type: "NEWS" }).map((p) => p.field);
    expect(fields).toEqual(["sourceName", "sourceUrl"]);
  });

  it("refuses an http source link for news", () => {
    const problems = publishProblems({ ...base, type: "NEWS", sourceName: "Reuters", sourceUrl: "http://example.com/a" });
    expect(problems.map((p) => p.field)).toEqual(["sourceUrl"]);
  });

  it("accepts news with a named https source", () => {
    expect(publishProblems({ ...base, type: "NEWS", sourceName: "Mint", sourceUrl: "https://www.livemint.com/x" })).toEqual([]);
  });

  it("limits summary and search description length", () => {
    const fields = publishProblems({ ...base, summary: "x".repeat(301), metaDescription: "y".repeat(161) }).map((p) => p.field);
    expect(fields).toEqual(["summary", "metaDescription"]);
  });
});

describe("scheduleProblem", () => {
  it("needs a time", () => {
    expect(scheduleProblem(null, now)?.field).toBe("scheduledFor");
  });

  it("refuses a time in the past or now", () => {
    expect(scheduleProblem(new Date("2026-11-10T05:00:00Z"), now)).not.toBeNull();
    expect(scheduleProblem(now, now)).not.toBeNull();
  });

  it("accepts a future time", () => {
    expect(scheduleProblem(new Date("2026-11-11T00:00:00Z"), now)).toBeNull();
  });
});

describe("isPubliclyVisible", () => {
  it("shows published content once its time has passed", () => {
    expect(isPubliclyVisible("PUBLISHED", new Date("2026-11-09T00:00:00Z"), now)).toBe(true);
  });

  it("hides drafts, scheduled and archived content, and future publish times", () => {
    expect(isPubliclyVisible("DRAFT", now, now)).toBe(false);
    expect(isPubliclyVisible("SCHEDULED", now, now)).toBe(false);
    expect(isPubliclyVisible("ARCHIVED", now, now)).toBe(false);
    expect(isPubliclyVisible("PUBLISHED", new Date("2026-11-11T00:00:00Z"), now)).toBe(false);
    expect(isPubliclyVisible("PUBLISHED", null, now)).toBe(false);
  });
});

describe("slugify and uniqueSlug", () => {
  it("makes lowercase hyphenated ASCII slugs", () => {
    expect(slugify("  Sapphire: Colour & Clarity!  ")).toBe("sapphire-colour-clarity");
    expect(slugify("Émeraude d'Afrique")).toBe("emeraude-d-afrique");
  });

  it("falls back when nothing usable is left", () => {
    expect(slugify("!!!", "news")).toBe("news");
  });

  it("adds a counter to a taken slug", () => {
    expect(uniqueSlug("ruby", new Set(["ruby"]))).toBe("ruby-2");
    expect(uniqueSlug("ruby", new Set(["ruby", "ruby-2"]))).toBe("ruby-3");
    expect(uniqueSlug("ruby", new Set())).toBe("ruby");
  });
});
