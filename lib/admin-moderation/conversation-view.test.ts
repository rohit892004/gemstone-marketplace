import { describe, expect, it } from "vitest";
import {
  decodeViewReason,
  encodeViewReason,
  VIEW_WINDOW_SECONDS,
  viewCookieName,
  viewCookiePath,
} from "./conversation-view";

describe("conversation view cookie", () => {
  it("names the cookie and scopes its path to one conversation", () => {
    expect(viewCookieName("clx123")).toBe("admin_view_clx123");
    expect(viewCookiePath("clx123")).toBe("/admin/conversations/clx123");
  });

  it("lasts thirty minutes", () => {
    expect(VIEW_WINDOW_SECONDS).toBe(1800);
  });

  it("round-trips a reason with commas, semicolons, spaces and non-ASCII text", () => {
    const reason = "Report R-12; buyer says \"price, not quoted\" – check ₹ amount";
    const encoded = encodeViewReason(reason);
    // Cookie values cannot hold raw ; , or spaces, so the encoded form must not contain them.
    expect(encoded).not.toMatch(/[;, ]/);
    expect(decodeViewReason(encoded)).toBe(reason);
  });

  it("trims the reason before storing it", () => {
    expect(decodeViewReason(encodeViewReason("   a reason of some length   "))).toBe("a reason of some length");
  });

  it("returns null for a missing cookie", () => {
    expect(decodeViewReason(undefined)).toBeNull();
    expect(decodeViewReason("")).toBeNull();
  });

  it("returns null for a stored reason that is too short or too long", () => {
    expect(decodeViewReason(encodeViewReason("short"))).toBeNull();
    expect(decodeViewReason(encodeViewReason("x".repeat(501)))).toBeNull();
  });

  it("returns null, without throwing, for a malformed encoding", () => {
    expect(decodeViewReason("%E0%A4%A")).toBeNull();
  });
});
