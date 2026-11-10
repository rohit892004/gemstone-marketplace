import { describe, expect, it } from "vitest";
import { confirmExpiry, confirmOutcome, mayReceive, topicChangeProblem } from "./state";
import { hashIp, hashToken, normaliseEmail, signManageToken, verifyManageToken } from "./tokens";
import { normaliseTopics, wantsAnyTopic } from "./topics";

const SECRET = "x".repeat(40);
const now = new Date("2026-11-10T06:00:00Z");

describe("manage tokens", () => {
  it("verifies a token it signed", () => {
    const token = signManageToken("clsub123", SECRET);
    expect(verifyManageToken(token, SECRET)).toBe("clsub123");
  });

  it("rejects a token with a changed subscriber id", () => {
    const token = signManageToken("clsub123", SECRET);
    expect(verifyManageToken(token.replace("clsub123", "clsub124"), SECRET)).toBeNull();
  });

  it("rejects a token signed with another secret, and malformed input", () => {
    const token = signManageToken("clsub123", SECRET);
    expect(verifyManageToken(token, "y".repeat(40))).toBeNull();
    expect(verifyManageToken("", SECRET)).toBeNull();
    expect(verifyManageToken("no-dot-here", SECRET)).toBeNull();
    expect(verifyManageToken(".onlysig", SECRET)).toBeNull();
  });
});

describe("confirmation tokens and IP hashes", () => {
  it("stores a hash that is not the token", () => {
    const hash = hashToken("abc");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("abc");
    expect(hashToken("abc")).toBe(hash);
  });

  it("hashes IPs with the secret and never returns the raw address", () => {
    const hashed = hashIp("203.0.113.9", SECRET);
    expect(hashed).not.toContain("203.0.113.9");
    expect(hashIp("203.0.113.9", SECRET)).toBe(hashed);
    expect(hashIp("203.0.113.9", "y".repeat(40))).not.toBe(hashed);
    expect(hashIp("unknown", SECRET)).toBeNull();
  });
});

describe("normaliseEmail", () => {
  it("trims and lowercases a valid address", () => {
    expect(normaliseEmail("  Asha@Example.COM ")).toBe("asha@example.com");
  });

  it("returns null for malformed input", () => {
    expect(normaliseEmail("not an email")).toBeNull();
    expect(normaliseEmail("")).toBeNull();
  });
});

describe("topics", () => {
  it("drops unknown values and duplicates, in canonical order", () => {
    expect(normaliseTopics(["PLATFORM_UPDATES", "EDUCATION", "EDUCATION", "SPAM", "<script>"])).toEqual([
      "EDUCATION",
      "PLATFORM_UPDATES",
    ]);
  });

  it("matches on any shared topic", () => {
    expect(wantsAnyTopic(["EDUCATION"], ["MARKET_NEWS", "EDUCATION"])).toBe(true);
    expect(wantsAnyTopic(["EDUCATION"], ["MARKET_NEWS"])).toBe(false);
  });
});

describe("confirmOutcome", () => {
  it("confirms a pending subscriber inside the window", () => {
    expect(confirmOutcome({ status: "PENDING", confirmExpiresAt: confirmExpiry(now) }, now)).toBe("CONFIRMED");
  });

  it("reports expired links and unknown tokens without detail", () => {
    expect(confirmOutcome({ status: "PENDING", confirmExpiresAt: new Date(now.getTime() - 1) }, now)).toBe("EXPIRED");
    expect(confirmOutcome(null, now)).toBe("INVALID");
  });

  it("treats a second click on a confirmed link as already confirmed", () => {
    expect(confirmOutcome({ status: "CONFIRMED", confirmExpiresAt: null }, now)).toBe("ALREADY_CONFIRMED");
  });

  it("does not confirm an unsubscribed address through an old link", () => {
    expect(confirmOutcome({ status: "UNSUBSCRIBED", confirmExpiresAt: confirmExpiry(now) }, now)).toBe("INVALID");
  });
});

describe("mayReceive", () => {
  const confirmed = { status: "CONFIRMED" as const, topics: ["EDUCATION"] };

  it("allows a confirmed subscriber with a matching topic", () => {
    expect(mayReceive(confirmed, ["EDUCATION"], false)).toEqual({ ok: true });
  });

  it("blocks pending, unsubscribed and suppressed addresses", () => {
    expect(mayReceive({ ...confirmed, status: "PENDING" }, ["EDUCATION"], false)).toEqual({ ok: false, reason: "not_confirmed" });
    expect(mayReceive({ ...confirmed, status: "UNSUBSCRIBED" }, ["EDUCATION"], false)).toEqual({ ok: false, reason: "not_confirmed" });
    expect(mayReceive(confirmed, ["EDUCATION"], true)).toEqual({ ok: false, reason: "suppressed" });
  });

  it("blocks subscribers who did not choose the topic", () => {
    expect(mayReceive(confirmed, ["MARKET_NEWS"], false)).toEqual({ ok: false, reason: "no_matching_topic" });
  });
});

describe("topicChangeProblem", () => {
  it("needs confirmation and at least one topic", () => {
    expect(topicChangeProblem("PENDING", ["EDUCATION"])).not.toBeNull();
    expect(topicChangeProblem("CONFIRMED", [])).not.toBeNull();
    expect(topicChangeProblem("CONFIRMED", ["EDUCATION"])).toBeNull();
  });
});
