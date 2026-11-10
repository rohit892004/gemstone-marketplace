import { describe, expect, it } from "vitest";
import { parseEnv, parseStartupEnv } from "./env";

describe("parseStartupEnv", () => {
  it("accepts a valid DATABASE_URL and applies defaults", () => {
    const env = parseStartupEnv({ DATABASE_URL: "postgresql://user:pw@localhost:5432/db" });
    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_URL).toBe("http://localhost:3000");
  });

  it("throws a readable error when DATABASE_URL is missing", () => {
    expect(() => parseStartupEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects an unknown NODE_ENV value", () => {
    expect(() =>
      parseStartupEnv({ DATABASE_URL: "postgresql://x@y/z", NODE_ENV: "staging" }),
    ).toThrow(/NODE_ENV/);
  });
});

describe("parseStartupEnv APP_URL", () => {
  const base = { DATABASE_URL: "postgresql://x@y/z" };

  it("refuses production without APP_URL, with a message that names it", () => {
    expect(() => parseStartupEnv({ ...base, NODE_ENV: "production" })).toThrow(/APP_URL is required in production/);
  });

  it("accepts production with a full APP_URL", () => {
    const env = parseStartupEnv({
      ...base,
      NODE_ENV: "production",
      APP_URL: "https://gemstones.example",
      AUTH_SECRET: "x".repeat(40),
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_live",
      EMAIL_FROM: "Gemstone Selections <no-reply@example.com>",
      SMS_PROVIDER: "msg91",
      MSG91_AUTH_KEY: "key",
      MSG91_SENDER_ID: "GEMSEL",
      MSG91_TEMPLATE_ID: "flow-1",
    });
    expect(env.APP_URL).toBe("https://gemstones.example");
  });

  it("keeps the localhost default outside production", () => {
    expect(parseStartupEnv({ ...base, NODE_ENV: "test" }).APP_URL).toBe("http://localhost:3000");
  });
});

describe("parseStartupEnv provider settings", () => {
  const base = { DATABASE_URL: "postgresql://x@y/z" };

  it("keeps the console providers as the defaults", () => {
    const env = parseStartupEnv(base);
    expect(env.EMAIL_PROVIDER).toBe("console");
    expect(env.SMS_PROVIDER).toBe("console");
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.MSG91_AUTH_KEY).toBeUndefined();
  });

  it("accepts resend for email and msg91 for SMS", () => {
    const env = parseStartupEnv({ ...base, EMAIL_PROVIDER: "resend", SMS_PROVIDER: "msg91" });
    expect(env.EMAIL_PROVIDER).toBe("resend");
    expect(env.SMS_PROVIDER).toBe("msg91");
  });

  it("rejects provider names that do not exist", () => {
    expect(() => parseStartupEnv({ ...base, EMAIL_PROVIDER: "smtp" })).toThrow(/EMAIL_PROVIDER/);
    expect(() => parseStartupEnv({ ...base, SMS_PROVIDER: "twilio" })).toThrow(/SMS_PROVIDER/);
  });

  it("treats empty provider variables (copied from .env.example) as unset", () => {
    const env = parseStartupEnv({
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
    const env = parseStartupEnv({
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

describe("production rule set", () => {
  const secret = "x".repeat(40);
  const good = {
    DATABASE_URL: "postgresql://x@y/z",
    NODE_ENV: "production",
    APP_URL: "https://gemstones.example",
    AUTH_SECRET: secret,
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "re_live",
    EMAIL_FROM: "Gemstone Selections <no-reply@example.com>",
    SMS_PROVIDER: "msg91",
    MSG91_AUTH_KEY: "key",
    MSG91_SENDER_ID: "GEMSEL",
    MSG91_TEMPLATE_ID: "flow-1",
  };

  it("accepts a complete production configuration", () => {
    expect(() => parseStartupEnv(good)).not.toThrow();
  });

  it("refuses console email and SMS providers in production", () => {
    expect(() => parseStartupEnv({ ...good, EMAIL_PROVIDER: "console" })).toThrow(/EMAIL_PROVIDER=console/);
    expect(() => parseStartupEnv({ ...good, SMS_PROVIDER: "console" })).toThrow(/SMS_PROVIDER=console/);
  });

  it("allows console providers only with the e2e opt-in flag", () => {
    const env = parseStartupEnv({
      ...good,
      EMAIL_PROVIDER: "console",
      SMS_PROVIDER: "console",
      ALLOW_NON_DELIVERING_PROVIDERS: "true",
      APP_URL: "http://localhost:3200",
      AUTH_SECRET: secret,
    });
    expect(env.EMAIL_PROVIDER).toBe("console");
  });

  it("refuses ALLOW_DEMO_SEED=true in production", () => {
    expect(() => parseStartupEnv({ ...good, ALLOW_DEMO_SEED: "true" })).toThrow(/ALLOW_DEMO_SEED=true/);
  });

  it("requires AUTH_SECRET of at least 32 characters in production", () => {
    expect(() => parseStartupEnv({ ...good, AUTH_SECRET: undefined })).toThrow(/AUTH_SECRET is required in production/);
    expect(() => parseStartupEnv({ ...good, AUTH_SECRET: "short" })).toThrow(/AUTH_SECRET/);
  });

  it("requires an https APP_URL in production", () => {
    expect(() => parseStartupEnv({ ...good, APP_URL: "http://gemstones.example" })).toThrow(/https/);
  });

  it("validates RESEND_WEBHOOK_SECRET prefix when set", () => {
    expect(() => parseStartupEnv({ ...good, RESEND_WEBHOOK_SECRET: "abc" })).toThrow(/whsec_/);
    expect(parseStartupEnv({ ...good, RESEND_WEBHOOK_SECRET: "whsec_abc" }).RESEND_WEBHOOK_SECRET).toBe("whsec_abc");
    expect(parseStartupEnv(good).RESEND_WEBHOOK_SECRET).toBeUndefined();
  });

  it("refuses s3 storage without bucket and keys in production", () => {
    expect(() => parseStartupEnv({ ...good, STORAGE_PROVIDER: "s3" })).toThrow(/S3_BUCKET/);
  });

  it("lists every problem in one error", () => {
    let message = "";
    try {
      parseStartupEnv({ DATABASE_URL: "postgresql://x@y/z", NODE_ENV: "production" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/APP_URL is required/);
    expect(message).toMatch(/AUTH_SECRET is required/);
    expect(message).toMatch(/EMAIL_PROVIDER=console/);
    expect(message).toMatch(/SMS_PROVIDER=console/);
  });

  it("does not apply production rules outside production", () => {
    expect(() => parseStartupEnv({ DATABASE_URL: "postgresql://x@y/z", NODE_ENV: "development" })).not.toThrow();
  });
});

describe("build safety", () => {
  it("base parseEnv does not apply production rules (so next build can collect pages)", () => {
    expect(() => parseEnv({ DATABASE_URL: "postgresql://x@y/z", NODE_ENV: "production" })).not.toThrow();
  });
});
