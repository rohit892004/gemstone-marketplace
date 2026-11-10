import { describe, expect, it } from "vitest";
import { attributionSignals, normaliseReferralCode } from "./attribution";

const SECRET = "test-secret";

describe("normaliseReferralCode", () => {
  it("trims and upper-cases a valid code", () => {
    expect(normaliseReferralCode("  ab23cd45 ")).toBe("AB23CD45");
  });

  it("rejects values that are not shaped like a code", () => {
    expect(normaliseReferralCode("")).toBeNull();
    expect(normaliseReferralCode("ab")).toBeNull();
    expect(normaliseReferralCode("<script>")).toBeNull();
    expect(normaliseReferralCode("ABC DEF")).toBeNull();
    expect(normaliseReferralCode(undefined)).toBeNull();
  });
});

describe("attributionSignals", () => {
  it("hashes the IP and device and never returns the raw values", () => {
    const out = attributionSignals({ ip: "203.0.113.7", visitorId: "a".repeat(32), secret: SECRET });
    expect(out.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(out.deviceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(out)).not.toContain("203.0.113.7");
    expect(JSON.stringify(out)).not.toContain("a".repeat(32));
  });

  it("gives the same hash for the same signal, so bulk sign-ups can be matched", () => {
    const a = attributionSignals({ ip: "203.0.113.7", visitorId: "b".repeat(32), secret: SECRET });
    const b = attributionSignals({ ip: "203.0.113.7", visitorId: "b".repeat(32), secret: SECRET });
    expect(a).toEqual(b);
  });

  it("keys the hash with the secret", () => {
    const a = attributionSignals({ ip: "203.0.113.7", visitorId: null, secret: "one" });
    const b = attributionSignals({ ip: "203.0.113.7", visitorId: null, secret: "two" });
    expect(a.ipHash).not.toBe(b.ipHash);
  });

  it("gives null for an unknown IP or a missing visitor", () => {
    expect(attributionSignals({ ip: "unknown", visitorId: null, secret: SECRET })).toEqual({ ipHash: null, deviceHash: null });
    expect(attributionSignals({ ip: "  ", visitorId: "", secret: SECRET })).toEqual({ ipHash: null, deviceHash: null });
  });
});
