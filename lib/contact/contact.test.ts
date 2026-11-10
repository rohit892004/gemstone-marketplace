import { describe, expect, it } from "vitest";
import { renderContactEmail } from "./email";
import { contactSchema, CONTACT_MESSAGE_MAX } from "./schema";
import { CONTACT_TOPICS, topicLabel } from "./topics";

const valid = {
  name: "Asha Rao",
  email: "Asha@Example.com",
  topic: "buying",
  message: "I would like to know more about the sapphire listing.",
  website: "",
};

describe("contactSchema", () => {
  it("accepts a complete, valid submission and normalises the email", () => {
    const parsed = contactSchema.parse(valid);
    expect(parsed.email).toBe("asha@example.com");
    expect(parsed.name).toBe("Asha Rao");
  });

  it("requires name, email, topic and message", () => {
    for (const key of ["name", "email", "topic", "message"] as const) {
      const input = { ...valid, [key]: "" };
      expect(contactSchema.safeParse(input).success, key).toBe(false);
    }
  });

  it("rejects an invalid email address", () => {
    expect(contactSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a topic that is not in the list", () => {
    expect(contactSchema.safeParse({ ...valid, topic: "press" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, topic: "" }).success).toBe(false);
  });

  it("enforces a minimum message length of 10 characters after trimming", () => {
    expect(contactSchema.safeParse({ ...valid, message: "123456789" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: "         " }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: "1234567890" }).success).toBe(true);
  });

  it("enforces a maximum message length of 2000 characters", () => {
    expect(contactSchema.safeParse({ ...valid, message: "a".repeat(CONTACT_MESSAGE_MAX) }).success).toBe(true);
    expect(contactSchema.safeParse({ ...valid, message: "a".repeat(CONTACT_MESSAGE_MAX + 1) }).success).toBe(false);
  });

  it("rejects the honeypot when it has any content", () => {
    const result = contactSchema.safeParse({ ...valid, website: "http://spam.example" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toContain("website");
  });

  it("rejects a name with line breaks, which could forge email headers or lines", () => {
    expect(contactSchema.safeParse({ ...valid, name: "Asha\nBcc: someone@example.com" }).success).toBe(false);
  });
});

describe("contact topics", () => {
  it("offers the five agreed topics in order", () => {
    expect(CONTACT_TOPICS.map((topic) => topic.label)).toEqual([
      "Buying a stone",
      "Selling on the platform",
      "Valuation",
      "Account or technical problem",
      "Something else",
    ]);
  });

  it("maps each value to its label and falls back to 'Something else'", () => {
    expect(topicLabel("valuation")).toBe("Valuation");
    expect(topicLabel("unknown" as never)).toBe("Something else");
  });
});

describe("renderContactEmail", () => {
  const input = contactSchema.parse(valid);

  it("builds the subject from the fixed topic label only", () => {
    const { subject } = renderContactEmail({ ...input, name: "Mallory\r\nBcc: x@example.com" as never });
    expect(subject).toBe("[Contact form] Buying a stone");
  });

  it("includes the sender details and the message in the body, with the reply address", () => {
    const { text } = renderContactEmail(input);
    expect(text).toContain("Name: Asha Rao");
    expect(text).toContain("Email: asha@example.com");
    expect(text).toContain("Topic: Buying a stone");
    expect(text).toContain(valid.message);
    expect(text).toContain("Reply to the sender at asha@example.com");
  });
});
