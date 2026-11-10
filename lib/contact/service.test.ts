import { beforeEach, describe, expect, it, vi } from "vitest";
import { contactSchema } from "./schema";

const mocks = vi.hoisted(() => ({
  recordAudit: vi.fn(async (entry: { action: string; actorId: string | null; ip: string | null; meta?: Record<string, unknown>; [key: string]: unknown }) => {
    void entry;
  }),
  consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 4, retryAfterSeconds: 3600 })),
  send: vi.fn(async () => undefined),
  env: { ADMIN_EMAIL: "admin@example.test" as string | undefined },
}));

vi.mock("@/lib/audit/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/security/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock("@/lib/notify/email", () => ({ getEmailProvider: () => ({ send: mocks.send }) }));
vi.mock("@/lib/config/env", () => ({ getEnv: () => mocks.env }));
vi.mock("@/lib/newsletter/service", () => ({ linkSecret: () => "test-link-secret" }));

const { submitContactMessage, contactDetailErrors, CONTACT_MESSAGE_REFUSAL, CONTACT_NAME_REFUSAL, contactRateKey } =
  await import("./service");

const input = contactSchema.parse({
  name: "Asha Rao",
  email: "asha@example.com",
  topic: "buying",
  message: "I would like to know more about the sapphire listing.",
  website: "",
});

const withMessage = (message: string) => contactSchema.parse({ ...input, message });

describe("contact-detail refusal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.ADMIN_EMAIL = "admin@example.test";
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 3600 });
  });

  it("refuses a message with a phone number and does not send, limit or audit it", async () => {
    const outcome = await submitContactMessage(withMessage("Call me on 98765 43210 about the sapphire."), "203.0.113.9", null);

    expect(outcome).toEqual({ status: "refused", fieldErrors: { message: CONTACT_MESSAGE_REFUSAL } });
    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("refuses an email address, a link and a messaging app name", async () => {
    for (const message of ["Write to jane@example.com for details.", "See https://shop.example.test/x for stones.", "Message me on whatsapp gemdealer"]) {
      const outcome = await submitContactMessage(withMessage(message), "203.0.113.9", null);
      expect(outcome.status, message).toBe("refused");
    }
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("never echoes the detected value in the refusal text", () => {
    const errors = contactDetailErrors({ name: "Asha", message: "Call 98765 43210 or jane@example.com" });
    expect(errors.message).toBe(CONTACT_MESSAGE_REFUSAL);
    expect(JSON.stringify(errors)).not.toMatch(/98765|jane@|example\.com/);
  });

  it("checks the name as well as the message", () => {
    expect(contactDetailErrors({ name: "Asha jane@example.com", message: "A clean message here." })).toEqual({ name: CONTACT_NAME_REFUSAL });
  });

  it("returns no errors for a clean name and message", () => {
    expect(contactDetailErrors(input)).toEqual({});
  });
});

describe("submitContactMessage: sent path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.ADMIN_EMAIL = "admin@example.test";
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 3600 });
  });

  it("checks the rate limit before sending, then sends and audits", async () => {
    const outcome = await submitContactMessage(input, "203.0.113.9", "user_1");
    expect(outcome).toEqual({ status: "sent" });
    expect(mocks.consumeRateLimit.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "admin@example.test", subject: "[Contact form] Buying a stone" }));
  });

  it("records a CONTACT_SUBMITTED row with topic, hashed IP and actor, and no body, name or email", async () => {
    await submitContactMessage(input, "203.0.113.9", "user_1");

    expect(mocks.recordAudit).toHaveBeenCalledTimes(1);
    const entry = mocks.recordAudit.mock.calls[0][0];
    expect(entry).toMatchObject({
      action: "contact.submitted",
      actorId: "user_1",
      entityType: "ContactMessage",
      entityId: null,
      meta: { topic: "buying" },
    });
    expect(entry.ip).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.ip).not.toContain("203.0.113.9");

    const serialised = JSON.stringify(entry);
    expect(serialised).not.toContain("Asha");
    expect(serialised).not.toContain("asha@example.com");
    expect(serialised).not.toContain("sapphire");
  });

  it("records a null actor for an anonymous visitor", async () => {
    await submitContactMessage(input, "203.0.113.9");
    expect(mocks.recordAudit.mock.calls[0][0]).toMatchObject({ actorId: null });
  });

  it("does not audit when the email provider fails", async () => {
    mocks.send.mockRejectedValueOnce(new Error("provider down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const outcome = await submitContactMessage(input, "203.0.113.9", null);
    expect(outcome).toEqual({ status: "unavailable" });
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("returns rate_limited without sending when the hourly limit is reached", async () => {
    mocks.consumeRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
    expect(await submitContactMessage(input, "203.0.113.9", null)).toEqual({ status: "rate_limited" });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("keys the rate limit by a hash of the IP", () => {
    expect(contactRateKey("203.0.113.9")).toMatch(/^contact:ip:[0-9a-f]{64}$/);
  });
});
