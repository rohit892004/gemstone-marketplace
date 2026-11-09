import { describe, expect, it } from "vitest";
import { MASK, moderateContactDetails, normaliseForModeration } from "./moderation";

function kinds(input: string) {
  return moderateContactDetails(input).kinds;
}

describe("contact-detail moderation: phone numbers", () => {
  it.each([
    ["call me on 98765 43210", ["PHONE"]],
    ["my number is 9876543210", ["PHONE"]],
    ["+91 98765-43210", ["PHONE"]],
    ["98.76.54.32.10", ["PHONE"]],
    ["(987) 654-3210", ["PHONE"]],
    ["9 8 7 6 5 4 3 2 1 0", ["PHONE"]],
    ["ring 98 76 54 32 10 after 6", ["PHONE"]],
    ["nine eight seven six five four three two one zero", ["PHONE"]],
    ["ninety eight seven six five four three two one zero", ["PHONE"]],
    ["９８７６５４３２１０", ["PHONE"]], // fullwidth digits
    ["٩٨٧٦٥٤٣٢١٠", ["PHONE"]], // Arabic-Indic digits
    ["9​8‌7‍6 5 4 3 2 1 0", ["PHONE"]], // zero-width characters
    ["98765432 1O", ["PHONE"]], // letter O for zero
    ["9876543 2l0", ["PHONE"]], // letter l for one
    ["9️⃣8️⃣7️⃣6️⃣5️⃣4️⃣3️⃣2️⃣1️⃣0️⃣", ["PHONE"]], // keycap digits
  ])("flags %j", (input, expected) => {
    const result = moderateContactDetails(input);
    expect(result.flagged).toBe(true);
    expect(result.kinds).toEqual(expect.arrayContaining(expected));
    expect(result.text).toContain(MASK);
    expect(result.text).not.toMatch(/9\D?8\D?7\D?6\D?5/);
  });

  it("does not flag prices, carats, years or dates", () => {
    for (const text of [
      "Price is INR 45,000 per carat",
      "Price 450 000 INR for the pair",
      "Carat 5.25 and 7.5 x 5.2 mm",
      "Certified in 2024 and again in 2025",
      "Available from 2026-11-09 onward",
      "Deadline 09/11/2026",
      "Quantity 12, colour blue, origin Sri Lanka",
    ]) {
      expect(moderateContactDetails(text), text).toMatchObject({ flagged: false, text });
    }
  });

  it("does not turn ordinary number words into digits", () => {
    const result = moderateContactDetails("one of a kind, two tone, three stones");
    expect(result.flagged).toBe(false);
    expect(result.text).toBe("one of a kind, two tone, three stones");
  });
});

describe("contact-detail moderation: email addresses", () => {
  it.each([
    "write to jane.doe@example.com",
    "jane_doe+gems@mail.co.uk",
    "jane at gmail dot com",
    "jane [at] gmail (dot) com",
    "jane(at)gmail(dot)com",
  ])("flags %j as EMAIL", (input) => {
    expect(kinds(input)).toContain("EMAIL");
    expect(moderateContactDetails(input).text).not.toMatch(/gmail|example/);
  });
});

describe("contact-detail moderation: URLs and domains", () => {
  it.each([
    "see https://wa.me/919876543210 now",
    "visit www.gemshop.in",
    "shop at gemshop.com today",
    "my site is gem-shop.io/catalogue",
    "t.me/gemdealer",
    "bit.ly/3xYz",
  ])("flags %j as contact", (input) => {
    const result = moderateContactDetails(input);
    expect(result.flagged).toBe(true);
    expect(result.text).toContain(MASK);
  });

  it("does not flag ordinary sentences with full stops", () => {
    for (const text of ["It is e.g. a sapphire.", "Mr. Singh i.e. the seller.", "Cut: brilliant. Clarity: VS1."]) {
      expect(moderateContactDetails(text), text).toMatchObject({ flagged: false });
    }
  });
});

describe("contact-detail moderation: handles and messaging apps", () => {
  it.each([
    "follow @gem_dealer_99",
    "whatsapp me",
    "WhatsApp: gemdealer",
    "telegram gemdealer",
    "insta gemsfromcolombo",
    "ig: gem.dealer",
    "snap: gemdealer",
  ])("flags %j", (input) => {
    expect(moderateContactDetails(input).flagged).toBe(true);
  });

  it("masks the handle that follows a strong app name", () => {
    expect(moderateContactDetails("message me on telegram gemdealer").text).toBe(`message me on ${MASK}`);
    expect(moderateContactDetails("whatsapp gemdealer").text).toBe(MASK);
  });

  it("does not flag the ordinary word 'line' or 'signal' without a handle", () => {
    expect(moderateContactDetails("a fine line of colour").flagged).toBe(false);
  });
});

describe("contact-detail moderation: clean text and behaviour", () => {
  it("returns text with nothing to mask exactly as typed, so codes keep their letters", () => {
    const text = "GIA report GIA-l2345, stock ref 2l3 and  double  spaces";
    expect(moderateContactDetails(text)).toEqual({ text, kinds: [], flagged: false });
  });

  it("leaves a normal enquiry untouched", () => {
    const text = "Hello, I am interested in the blue sapphire. Could you share the certificate?";
    expect(moderateContactDetails(text)).toEqual({ text, kinds: [], flagged: false });
  });

  it("masks every kind in one message and reports each once", () => {
    const result = moderateContactDetails("Mail jane@x.com, call 98765 43210, or whatsapp 9988776655.");
    expect(result.flagged).toBe(true);
    expect(result.kinds.sort()).toEqual(["EMAIL", "PHONE", "PLATFORM"].sort());
    expect(result.text).not.toMatch(/jane@|98765|9988776655/);
  });

  it("never returns the detected value in kinds", () => {
    const result = moderateContactDetails("98765 43210");
    expect(JSON.stringify(result)).not.toContain("98765");
  });

  it("is idempotent", () => {
    const once = moderateContactDetails("call 98765 43210 or jane@x.com");
    const twice = moderateContactDetails(once.text);
    expect(twice.text).toBe(once.text);
    expect(twice.flagged).toBe(false);
  });

  it("normalises compatibility characters for the stored text", () => {
    expect(normaliseForModeration("ＡＢＣ １２３")).toBe("ABC 123");
  });
});

describe("contact-detail moderation: bypasses found in review", () => {
  it.each([
    "98765    43210",
    "98765,43210",
    "98765_43210",
    "98765｜43210",
    "98765 and 43210",
    "๙๘๗๖๕๔๓๒๑๐", // Thai digits
    "98765\u{E0031}43210", // tag characters inside a number
    "9876-54-3210",
    "9876.54.3210",
    "5551234", // seven digits
  ])("masks phone form %j", (input) => {
    const result = moderateContactDetails(input);
    expect(result.flagged, input).toBe(true);
    expect(result.kinds).toContain("PHONE");
  });

  it("masks spelled digits separated by slashes and underscores", () => {
    expect(moderateContactDetails("nine/eight/seven/six/five/four/three/two").flagged).toBe(true);
    expect(moderateContactDetails("nine_eight_seven_six_five_four_three").flagged).toBe(true);
  });

  it.each([
    "john [at] gmail [.] com",
    "john(at)gmail(.)com",
    "john@gmail[.]com",
    "john at mydomain dot ng",
  ])("masks email form %j", (input) => {
    expect(moderateContactDetails(input).kinds).toContain("EMAIL");
  });

  it.each(["johnsgems.ng", "shop: johnsgems.jp"])("masks domain with an uncommon TLD %j", (input) => {
    expect(moderateContactDetails(input).flagged).toBe(true);
  });

  it.each([
    ["my insta is johnny_gems", "johnny_gems"],
    ["Skype me: john.gems", "john.gems"],
    ["snap me at johnny", "johnny"],
  ])("masks the handle after an app keyword: %j", (input, leaked) => {
    const result = moderateContactDetails(input);
    expect(result.flagged).toBe(true);
    expect(result.text).not.toContain(leaked);
  });

  it("still does not flag dates in either order or a short price", () => {
    for (const text of ["Available 2026-11-09", "Deadline 09-11-2026", "Price 450 000 INR"]) {
      expect(moderateContactDetails(text).flagged, text).toBe(false);
    }
  });
});
