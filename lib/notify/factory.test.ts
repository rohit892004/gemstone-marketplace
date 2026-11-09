import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ value: {} as Record<string, string | undefined> }));

vi.mock("@/lib/config/env", () => ({
  getEnv: () => env.value,
}));

/**
 * Each test loads a fresh module graph, because the factories cache their instance.
 * Every class is taken from the same graph, so instanceof checks compare like with like.
 */
async function load() {
  vi.resetModules();
  const email = await import("./email");
  const sms = await import("./sms");
  const resend = await import("./resend");
  const msg91 = await import("./msg91");
  return { email, sms, resend, msg91 };
}

describe("provider factories", () => {
  beforeEach(() => {
    env.value = { NODE_ENV: "development", EMAIL_PROVIDER: "console", SMS_PROVIDER: "console" };
  });

  it("keeps console providers in development", async () => {
    const { email, sms } = await load();
    expect(email.getEmailProvider()).toBeInstanceOf(email.ConsoleEmailProvider);
    expect(sms.getSmsProvider()).toBeInstanceOf(sms.ConsoleSmsProvider);
  });

  it("still refuses the console providers in production", async () => {
    env.value = { NODE_ENV: "production", EMAIL_PROVIDER: "console", SMS_PROVIDER: "console", ALLOW_NON_DELIVERING_PROVIDERS: "false" };
    const { email, sms } = await load();
    expect(() => email.getEmailProvider()).toThrow(/not allowed in production/);
    expect(() => sms.getSmsProvider()).toThrow(/not allowed in production/);
  });

  it("builds the Resend provider when its key and sender are set", async () => {
    env.value = { NODE_ENV: "production", EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "from@example.com" };
    const { email, resend } = await load();
    expect(email.getEmailProvider()).toBeInstanceOf(resend.ResendEmailProvider);
  });

  it("refuses to build Resend without its key or sender", async () => {
    env.value = { NODE_ENV: "development", EMAIL_PROVIDER: "resend" };
    const { email } = await load();
    expect(() => email.getEmailProvider()).toThrow(/RESEND_API_KEY and EMAIL_FROM/);
  });

  it("builds the MSG91 provider only with all three keys", async () => {
    env.value = { NODE_ENV: "production", SMS_PROVIDER: "msg91", MSG91_AUTH_KEY: "a", MSG91_SENDER_ID: "GEMSEL", MSG91_TEMPLATE_ID: "t" };
    const { sms, msg91 } = await load();
    expect(sms.getSmsProvider()).toBeInstanceOf(msg91.Msg91SmsProvider);
  });

  it("refuses to build MSG91 when a key is missing", async () => {
    env.value = { NODE_ENV: "development", SMS_PROVIDER: "msg91", MSG91_AUTH_KEY: "a", MSG91_SENDER_ID: "GEMSEL" };
    const { sms } = await load();
    expect(() => sms.getSmsProvider()).toThrow(/MSG91_TEMPLATE_ID/);
  });
});
