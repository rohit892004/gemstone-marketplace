import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The session lookup needs Auth.js and the database. The header test only checks the static nav.
vi.mock("@/components/auth/session-links", () => ({
  SessionLinks: () => null,
}));

import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("renders primary navigation with the expected sections", () => {
    const html = renderToStaticMarkup(<SiteHeader />);
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain('href="/gemstones"');
    expect(html).toContain('href="/valuation"');
  });
});
