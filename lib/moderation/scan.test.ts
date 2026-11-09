import { describe, expect, it } from "vitest";
import { MASK } from "@/lib/messaging/moderation";
import { publicTextBlockedMessage, scanPublicText } from "./scan";

describe("scanPublicText", () => {
  it("passes ordinary public text", () => {
    const scan = scanPublicText([
      { field: "description", label: "About", value: "Certified Ceylon sapphires, cut in Jaipur for over twenty years." },
    ]);
    expect(scan).toEqual({ flagged: false, flaggedFields: [], flaggedLabels: [], kinds: [] });
  });

  it("ignores empty, null and whitespace-only fields", () => {
    const scan = scanPublicText([
      { field: "tagline", label: "Tagline", value: null },
      { field: "description", label: "About", value: undefined },
      { field: "specialties", label: "Specialties", value: "   " },
    ]);
    expect(scan.flagged).toBe(false);
  });

  it("flags a phone number in the about text and names the field", () => {
    const scan = scanPublicText([
      { field: "tagline", label: "Tagline", value: "Fine gems" },
      { field: "description", label: "About", value: "Call us on 98765 43210 any evening." },
    ]);
    expect(scan.flagged).toBe(true);
    expect(scan.flaggedFields).toEqual(["description"]);
    expect(scan.flaggedLabels).toEqual(["About"]);
    expect(scan.kinds).toContain("PHONE");
  });

  it("catches obfuscated phone numbers, emails, links and app handles", () => {
    const cases: [string, string][] = [
      ["spelled digits", "call nine eight seven six five four three two one zero"],
      ["spaced digits", "9 8 7 6 5 4 3 2 1 0"],
      ["email", "write to jane@example.com"],
      ["email with at and dot", "write to jane at example dot com"],
      ["link", "see www.gemhouse.example"],
      ["app handle", "message me on whatsapp gemdealer"],
    ];
    for (const [label, text] of cases) {
      const scan = scanPublicText([{ field: "description", label: "About", value: text }]);
      expect(scan.flagged, label).toBe(true);
    }
  });

  it("reports every flagged field, in order, and the union of kinds", () => {
    const scan = scanPublicText([
      { field: "title", label: "Title", value: "Email jane@x.com" },
      { field: "description", label: "Description", value: "Clean text" },
      { field: "specialties", label: "Specialties", value: "call 98765 43210" },
    ]);
    expect(scan.flaggedFields).toEqual(["title", "specialties"]);
    expect(scan.flaggedLabels).toEqual(["Title", "Specialties"]);
    expect(scan.kinds.sort()).toEqual(["EMAIL", "PHONE"]);
  });

  it("never returns the detected value", () => {
    const scan = scanPublicText([{ field: "description", label: "About", value: "98765 43210" }]);
    expect(JSON.stringify(scan)).not.toContain("98765");
    expect(JSON.stringify(scan)).not.toContain(MASK);
  });

  it("does not flag prices, carats or years", () => {
    const scan = scanPublicText([
      { field: "description", label: "About", value: "Rubies from 1.5 carats, priced INR 25,000, mined in 1998." },
    ]);
    expect(scan.flagged).toBe(false);
  });
});

describe("publicTextBlockedMessage", () => {
  it("names the fields and says what is not allowed", () => {
    const message = publicTextBlockedMessage(["Tagline", "About"]);
    expect(message).toContain("Tagline, About");
    expect(message).toContain("can't appear in public text");
  });

  it("falls back to a generic phrase when no label is given", () => {
    expect(publicTextBlockedMessage([])).toContain("this text");
  });
});
