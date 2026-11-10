import { describe, expect, it } from "vitest";
import { emailDomain, isSelfReferral, referralFlagReasons, referralOutcome, signalHash } from "./referrals";

describe("referralFlagReasons", () => {
  it("flags nothing for a clean sign-up", () => {
    expect(referralFlagReasons({ sameIpOthers: 0, sameDeviceOthers: 0, sameDomainInWindow: 1 })).toEqual([]);
  });

  it("flags a shared IP, a shared device, and a bulk email domain", () => {
    const reasons = referralFlagReasons({ sameIpOthers: 1, sameDeviceOthers: 2, sameDomainInWindow: 3 });
    expect(reasons).toHaveLength(3);
    expect(reasons[0]).toContain("IP");
    expect(reasons[1]).toContain("device");
    expect(reasons[2]).toContain("3 sign-ups");
  });

  it("needs three or more from one domain before it flags on domain", () => {
    expect(referralFlagReasons({ sameIpOthers: 0, sameDeviceOthers: 0, sameDomainInWindow: 2 })).toEqual([]);
  });
});

describe("isSelfReferral", () => {
  it("blocks the same account", () => {
    expect(isSelfReferral({ referrerUserId: "u1", referredUserId: "u1", referrerEmail: "a@x.com", referredEmail: "b@x.com" })).toBe(true);
  });
  it("blocks the same email address, ignoring case and spaces", () => {
    expect(isSelfReferral({ referrerUserId: "u1", referredUserId: "u2", referrerEmail: "Ann@X.com", referredEmail: " ann@x.com " })).toBe(true);
  });
  it("allows two different people", () => {
    expect(isSelfReferral({ referrerUserId: "u1", referredUserId: "u2", referrerEmail: "a@x.com", referredEmail: "b@x.com" })).toBe(false);
  });
});

describe("referralOutcome", () => {
  const base = { status: "PENDING" as const, flagged: false, referredApproved: true, referredPublishedListings: 1 };

  it("qualifies an approved seller with a published listing", () => {
    expect(referralOutcome(base)).toBe("QUALIFY");
  });
  it("waits for an approved seller with no published listing yet", () => {
    expect(referralOutcome({ ...base, referredPublishedListings: 0 })).toBe("WAIT");
  });
  it("waits for a seller who is not approved", () => {
    expect(referralOutcome({ ...base, referredApproved: false })).toBe("WAIT");
  });
  it("never qualifies a flagged referral; it waits for an admin", () => {
    expect(referralOutcome({ ...base, flagged: true })).toBe("WAIT");
  });
  it("does nothing to a voided or already qualified referral", () => {
    expect(referralOutcome({ ...base, status: "VOIDED" })).toBe("NONE");
    expect(referralOutcome({ ...base, status: "QUALIFIED" })).toBe("NONE");
  });
});

describe("emailDomain and signalHash", () => {
  it("returns the lower-cased domain", () => {
    expect(emailDomain("Someone@Example.COM")).toBe("example.com");
    expect(emailDomain("no-at-sign")).toBe("");
  });
  it("hashes deterministically with the secret, and never returns the raw value", () => {
    const a = signalHash("203.0.113.9", "secret-one");
    expect(a).toBe(signalHash("203.0.113.9", "secret-one"));
    expect(a).not.toContain("203.0.113.9");
    expect(a).not.toBe(signalHash("203.0.113.9", "secret-two"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
