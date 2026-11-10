import { describe, expect, it } from "vitest";
import { getClientIp } from "./client-ip";

const xff = (value: string) => new Headers({ "x-forwarded-for": value });

describe("getClientIp with one trusted proxy (default)", () => {
  it("uses the rightmost X-Forwarded-For entry (the one the trusted proxy appended)", () => {
    expect(getClientIp(xff("6.6.6.6, 10.0.0.9"), 1)).toBe("10.0.0.9");
  });

  it("ignores a client-supplied leftmost entry when rotating it", () => {
    expect(getClientIp(xff("1.1.1.1, 10.0.0.9"), 1)).toBe(getClientIp(xff("2.2.2.2, 10.0.0.9"), 1));
  });

  it("returns unknown for an empty X-Forwarded-For header", () => {
    expect(getClientIp(xff(" , "), 1)).toBe("unknown");
  });
});

describe("getClientIp with two trusted proxies", () => {
  it("takes the second entry from the right", () => {
    expect(getClientIp(xff("203.0.113.7, 10.0.0.1, 10.0.0.2"), 2)).toBe("10.0.0.1");
  });

  it("ignores spoofed leading entries", () => {
    expect(getClientIp(xff("9.9.9.9, 203.0.113.7, 10.0.0.1, 10.0.0.2"), 2)).toBe("10.0.0.1");
  });
});

describe("getClientIp with zero trusted proxies", () => {
  it("ignores X-Forwarded-For entirely and uses X-Real-IP", () => {
    const h = new Headers({ "x-forwarded-for": "6.6.6.6", "x-real-ip": " 203.0.113.5 " });
    expect(getClientIp(h, 0)).toBe("203.0.113.5");
  });

  it("returns unknown when only X-Forwarded-For is present", () => {
    expect(getClientIp(xff("6.6.6.6"), 0)).toBe("unknown");
  });
});

describe("getClientIp with short or absent headers", () => {
  it("returns unknown when the header has fewer entries than the trusted count", () => {
    expect(getClientIp(xff("10.0.0.9"), 2)).toBe("unknown");
  });

  it("ignores X-Real-IP when a proxy is expected and X-Forwarded-For is absent", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "203.0.113.5" }), 1)).toBe("unknown");
  });

  it("uses X-Real-IP only when no proxy is expected", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "203.0.113.5" }), 0)).toBe("203.0.113.5");
  });

  it("returns unknown when no IP header is present", () => {
    expect(getClientIp(new Headers(), 1)).toBe("unknown");
  });
});
