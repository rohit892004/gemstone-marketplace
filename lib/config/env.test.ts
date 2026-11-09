import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("accepts a valid DATABASE_URL and applies defaults", () => {
    const env = parseEnv({ DATABASE_URL: "postgresql://user:pw@localhost:5432/db" });
    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_URL).toBe("http://localhost:3000");
  });

  it("throws a readable error when DATABASE_URL is missing", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects an unknown NODE_ENV value", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "postgresql://x@y/z", NODE_ENV: "staging" }),
    ).toThrow(/NODE_ENV/);
  });
});

describe("parseEnv provider settings", () => {
  const base = { DATABASE_URL: "postgresql://x@y/z" };

  it("keeps the console providers as the defaults", () => {
    const env = parseEnv(base);
    expect(env.EMAIL_PROVIDER).toBe("console");
    expect(env.SMS_PROVIDER).toBe("console");
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.MSG91_AUTH_KEY).toBeUndefined();
  });

  it("accepts resend for email and msg91 for SMS", () => {
    const env = parseEnv({ ...base, EMAIL_PROVIDER: "resend", SMS_PROVIDER: "msg91" });
    expect(env.EMAIL_PROVIDER).toBe("resend");
    expect(env.SMS_PROVIDER).toBe("msg91");
  });

  it("rejects provider names that do not exist", () => {
    expect(() => parseEnv({ ...base, EMAIL_PROVIDER: "smtp" })).toThrow(/EMAIL_PROVIDER/);
    expect(() => parseEnv({ ...base, SMS_PROVIDER: "twilio" })).toThrow(/SMS_PROVIDER/);
  });

  it("treats empty provider variables (copied from .env.example) as unset", () => {
    const env = parseEnv({
      ...base,
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      MSG91_AUTH_KEY: "",
      MSG91_SENDER_ID: "",
      MSG91_TEMPLATE_ID: "",
    });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.EMAIL_FROM).toBeUndefined();
    expect(env.MSG91_AUTH_KEY).toBeUndefined();
    expect(env.MSG91_SENDER_ID).toBeUndefined();
    expect(env.MSG91_TEMPLATE_ID).toBeUndefined();
  });

  it("reads the provider keys when they are set", () => {
    const env = parseEnv({
      ...base,
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: "Gemstone Selections <no-reply@example.com>",
      MSG91_AUTH_KEY: "msg91-test-key",
      MSG91_SENDER_ID: "GEMSEL",
      MSG91_TEMPLATE_ID: "flow-123",
    });
    expect(env.RESEND_API_KEY).toBe("re_test_key");
    expect(env.EMAIL_FROM).toBe("Gemstone Selections <no-reply@example.com>");
    expect(env.MSG91_AUTH_KEY).toBe("msg91-test-key");
    expect(env.MSG91_SENDER_ID).toBe("GEMSEL");
    expect(env.MSG91_TEMPLATE_ID).toBe("flow-123");
  });
});
