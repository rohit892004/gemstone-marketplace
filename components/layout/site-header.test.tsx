import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("renders primary navigation with the expected sections", () => {
    const html = renderToStaticMarkup(<SiteHeader />);
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain('href="/gemstones"');
    expect(html).toContain('href="/valuation"');
  });
});
