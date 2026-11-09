import { describe, expect, it } from "vitest";
import { getClientIp } from "./client-ip";

describe("getClientIp", () => {
  it("uses the rightmost X-Forwarded-For entry (the one the trusted proxy appended)", () => {
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.9" });
    expect(getClientIp(h)).toBe("10.0.0.9");
  });

  it("ignores a client-supplied leftmost entry when rotating it", () => {
    const a = new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.9" });
    const b = new Headers({ "x-forwarded-for": "2.2.2.2, 10.0.0.9" });
    expect(getClientIp(a)).toBe(getClientIp(b));
  });

  it("falls back to X-Real-IP, then 'unknown'", () => {
    expect(getClientIp(new Headers({ "x-real-ip": " 203.0.113.5 " }))).toBe("203.0.113.5");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
