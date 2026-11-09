import { describe, expect, it } from "vitest";
import { documentResponseHeaders, safeContentType, safeDownloadName } from "./document-download";

describe("safeDownloadName", () => {
  it("keeps ordinary names", () => {
    expect(safeDownloadName("GIA report 2026.pdf")).toBe("GIA report 2026.pdf");
  });

  it("replaces quotes, slashes, backslashes and control characters", () => {
    expect(safeDownloadName('a"b\\c/d\r\ne.pdf')).toBe("a_b_c_d_e.pdf");
  });

  it("strips leading dots so names cannot look like hidden or parent paths", () => {
    expect(safeDownloadName("../../secret.pdf")).toBe("secret.pdf");
  });

  it("falls back to a generic name when nothing usable remains", () => {
    expect(safeDownloadName("...")).toBe("document");
    expect(safeDownloadName("")).toBe("document");
  });

  it("caps the length", () => {
    expect(safeDownloadName("a".repeat(300)).length).toBeLessThanOrEqual(120);
  });
});

describe("safeContentType", () => {
  it("passes well-formed types through", () => {
    expect(safeContentType("image/jpeg")).toBe("image/jpeg");
  });

  it("replaces malformed values (header injection attempts) with an opaque type", () => {
    expect(safeContentType("text/html\r\nSet-Cookie: x=1")).toBe("application/octet-stream");
    expect(safeContentType("")).toBe("application/octet-stream");
  });
});

describe("documentResponseHeaders", () => {
  it("sets attachment, no-store and nosniff", () => {
    const headers = documentResponseHeaders({ mimeType: "application/pdf", fileName: "a.pdf" }, 12);
    expect(headers.get("content-disposition")).toBe('attachment; filename="a.pdf"');
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("content-length")).toBe("12");
  });
});
