import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFS,
  DIGEST_WINDOW_MS,
  FALLBACK_NOTIFICATION,
  NOTIFICATION_TYPES,
  categoryFor,
  digestCopy,
  digestDue,
  isSafeHref,
  safeNotificationText,
  shouldEmail,
  type NotificationPrefs,
} from "./rules";

describe("categoryFor", () => {
  it("maps each notification type to its preference switch", () => {
    expect(categoryFor(NOTIFICATION_TYPES.ENQUIRY_RECEIVED)).toBe("enquiries");
    expect(categoryFor(NOTIFICATION_TYPES.MESSAGE_RECEIVED)).toBe("messages");
    expect(categoryFor(NOTIFICATION_TYPES.OFFER_RECEIVED)).toBe("offersAndQuotes");
    expect(categoryFor(NOTIFICATION_TYPES.OFFER_RESPONDED)).toBe("offersAndQuotes");
    expect(categoryFor(NOTIFICATION_TYPES.QUOTATION_RECEIVED)).toBe("offersAndQuotes");
    expect(categoryFor(NOTIFICATION_TYPES.QUOTATION_RESPONDED)).toBe("offersAndQuotes");
    expect(categoryFor(NOTIFICATION_TYPES.REQUIREMENT_MATCH)).toBe("requirements");
    expect(categoryFor(NOTIFICATION_TYPES.REQUIREMENT_RESPONSE)).toBe("requirements");
  });

  it("returns null for an unknown type", () => {
    expect(categoryFor("something.else")).toBeNull();
  });
});

describe("shouldEmail", () => {
  const off = (overrides: Partial<NotificationPrefs>): NotificationPrefs => ({ ...DEFAULT_PREFS, ...overrides });

  it("emails by default for every type", () => {
    for (const type of Object.values(NOTIFICATION_TYPES)) {
      expect(shouldEmail(DEFAULT_PREFS, type)).toBe(true);
    }
  });

  it("always emails admin alerts, even with email switched off", () => {
    expect(shouldEmail(off({ emailEnabled: false }), NOTIFICATION_TYPES.ADMIN_ALERT)).toBe(true);
  });

  it("turns off all email when emailEnabled is false", () => {
    expect(shouldEmail(off({ emailEnabled: false }), NOTIFICATION_TYPES.ENQUIRY_RECEIVED)).toBe(false);
  });

  it("respects a single category switch", () => {
    const prefs = off({ messages: false });
    expect(shouldEmail(prefs, NOTIFICATION_TYPES.MESSAGE_RECEIVED)).toBe(false);
    expect(shouldEmail(prefs, NOTIFICATION_TYPES.OFFER_RECEIVED)).toBe(true);
  });

  it("never emails an unknown type", () => {
    expect(shouldEmail(DEFAULT_PREFS, "unknown.type")).toBe(false);
  });
});

describe("digestDue", () => {
  const now = new Date("2026-11-09T10:00:00.000Z");

  it("is due when no message email was ever sent", () => {
    expect(digestDue(null, now)).toBe(true);
  });

  it("is not due inside the window", () => {
    const last = new Date(now.getTime() - (DIGEST_WINDOW_MS - 1000));
    expect(digestDue(last, now)).toBe(false);
  });

  it("is due once the window has passed, and exactly at the boundary", () => {
    expect(digestDue(new Date(now.getTime() - DIGEST_WINDOW_MS - 1), now)).toBe(true);
    expect(digestDue(new Date(now.getTime() - DIGEST_WINDOW_MS), now)).toBe(true);
  });

  it("uses a 10 minute window by default", () => {
    expect(DIGEST_WINDOW_MS).toBe(10 * 60 * 1000);
  });
});

describe("digestCopy", () => {
  it("uses the singular for one message and the plural otherwise", () => {
    expect(digestCopy(1, "https://x.test/conversations").text).toContain("You have 1 new message on");
    expect(digestCopy(3, "https://x.test/conversations").text).toContain("You have 3 new messages on");
  });

  it("contains only the count and the link, never message text", () => {
    const copy = digestCopy(2, "https://x.test/conversations");
    expect(copy.subject).toBe("Gemstone Selections: new messages");
    expect(copy.text).toContain("https://x.test/conversations");
    expect(copy.text).not.toMatch(/@|\d{6,}/);
  });
});

describe("safeNotificationText", () => {
  it("leaves fixed template text alone", () => {
    const result = safeNotificationText({
      title: "New enquiry",
      body: "A buyer enquired about Blue Sapphire, 5.20 ct Oval.",
    });
    expect(result).toEqual({
      title: "New enquiry",
      body: "A buyer enquired about Blue Sapphire, 5.20 ct Oval.",
      replaced: false,
    });
  });

  it("replaces text that contains a phone number", () => {
    const result = safeNotificationText({ title: "New message", body: "Call me on 98765 43210 tonight" });
    expect(result.replaced).toBe(true);
    expect(result.body).toBe(FALLBACK_NOTIFICATION.body);
    expect(result.title).toBe(FALLBACK_NOTIFICATION.title);
  });

  it("does not flag the fixed copy the app sends (false positives would hide real notices)", () => {
    const copies = [
      { title: "New enquiry", body: "A buyer enquired about Cornflower blue Sapphire, 0.80 ct Oval." },
      { title: "New enquiry", body: "Someone wrote to you on Gemstone Selections." },
      { title: "New message", body: "You have a new message on Gemstone Selections." },
      {
        title: "New buyer requirement",
        body: "A buyer has posted a requirement in a category you sell in. Open the requirements board to see it and respond.",
      },
      {
        title: "New response to your requirement",
        body: "A seller has responded to your requirement. Open the conversation to read the reply.",
      },
      { title: "Demo: New quotation", body: "A seller sent you a quotation. Open the conversation to see it." },
    ];
    for (const copy of copies) {
      expect(safeNotificationText(copy).replaced, copy.body).toBe(false);
    }
  });

  it("replaces text that contains an email address or a URL", () => {
    expect(safeNotificationText({ title: "x", body: "write to seller@example.com" }).replaced).toBe(true);
    expect(safeNotificationText({ title: "x", body: "see https://example.com/deal" }).replaced).toBe(true);
  });
});

describe("isSafeHref", () => {
  it("accepts app paths", () => {
    expect(isSafeHref("/conversations/abc")).toBe(true);
    expect(isSafeHref("/notifications")).toBe(true);
  });

  it("rejects absolute, protocol-relative and backslash links", () => {
    expect(isSafeHref("https://evil.test")).toBe(false);
    expect(isSafeHref("//evil.test")).toBe(false);
    expect(isSafeHref("/\\evil.test")).toBe(false);
    expect(isSafeHref("conversations/abc")).toBe(false);
  });
});
