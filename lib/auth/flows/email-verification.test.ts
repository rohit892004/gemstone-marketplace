import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
  consumeToken: vi.fn(),
  issueToken: vi.fn(),
  consumeRateLimit: vi.fn(),
  send: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: mocks.db }));
vi.mock("@/lib/auth/tokens", () => ({ consumeToken: mocks.consumeToken, issueToken: mocks.issueToken }));
vi.mock("@/lib/security/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock("@/lib/notify/email", () => ({ getEmailProvider: () => ({ send: mocks.send }) }));
vi.mock("@/lib/audit/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/config/app-url", () => ({ appUrl: (path: string) => `https://app.test${path}` }));

import { resendVerificationLink, verifyEmailToken } from "./email-verification";

const TOKEN = "verify-token-value-0123456789";

describe("verifyEmailToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies the account once, then refuses the same link", async () => {
    mocks.consumeToken.mockResolvedValueOnce("u1").mockResolvedValueOnce(null);

    expect(await verifyEmailToken(TOKEN, "203.0.113.5")).toBe(true);
    expect(await verifyEmailToken(TOKEN, "203.0.113.5")).toBe(false);

    expect(mocks.consumeToken).toHaveBeenCalledWith(TOKEN, "EMAIL_VERIFICATION");
    expect(mocks.db.user.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.db.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", emailVerifiedAt: null },
      data: { emailVerifiedAt: expect.any(Date) },
    });
    expect(mocks.recordAudit).toHaveBeenCalledTimes(1);
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.email.verified", actorId: "u1" }));
  });

  it("rejects malformed tokens without hitting the database", async () => {
    expect(await verifyEmailToken("short")).toBe(false);
    expect(mocks.consumeToken).not.toHaveBeenCalled();
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an expired or unknown token", async () => {
    mocks.consumeToken.mockResolvedValueOnce(null);
    expect(await verifyEmailToken(TOKEN)).toBe(false);
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("resendVerificationLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 3600 });
    mocks.issueToken.mockResolvedValue(TOKEN);
  });

  it("sends a new link only when the account exists and is unverified", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      name: "Asha",
      email: "asha@example.com",
      emailVerifiedAt: null,
    });
    expect(await resendVerificationLink("asha@example.com")).toBe("sent");
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0].text).toContain(`https://app.test/verify-email?token=${TOKEN}`);
  });

  it("answers the same way for unknown and already-verified accounts, without sending", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(null);
    const unknown = await resendVerificationLink("nobody@example.com");

    mocks.db.user.findUnique.mockResolvedValueOnce({
      id: "u2",
      name: null,
      email: "done@example.com",
      emailVerifiedAt: new Date(),
    });
    const verified = await resendVerificationLink("done@example.com");

    expect(unknown).toBe("sent");
    expect(verified).toBe(unknown);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.issueToken).not.toHaveBeenCalled();
  });

  it("reports limited after 5 requests per email per hour, regardless of the account", async () => {
    mocks.consumeRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
    expect(await resendVerificationLink("nobody@example.com")).toBe("limited");
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
  });
});
