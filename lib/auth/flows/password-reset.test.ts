import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  },
  consumeToken: vi.fn(),
  issueToken: vi.fn(),
  consumeRateLimit: vi.fn(),
  send: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: mocks.db }));
vi.mock("@/lib/auth/tokens", () => ({ consumeToken: mocks.consumeToken, issueToken: mocks.issueToken }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn(async () => "scrypt$hash") }));
vi.mock("@/lib/security/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock("@/lib/notify/email", () => ({ getEmailProvider: () => ({ send: mocks.send }) }));
vi.mock("@/lib/audit/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/config/app-url", () => ({ appUrl: (path: string) => `https://app.test${path}` }));

import { completePasswordReset, requestPasswordReset } from "./password-reset";

const verifiedUser = {
  id: "u1",
  name: "Asha",
  email: "asha@example.com",
  emailVerifiedAt: new Date("2026-01-01"),
  status: "ACTIVE",
};

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 3600 });
    mocks.issueToken.mockResolvedValue("raw-token-value-0123456789");
  });

  it("returns the same result for an unknown email and a known email", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(null);
    const unknown = await requestPasswordReset("nobody@example.com", "203.0.113.5");

    mocks.db.user.findUnique.mockResolvedValueOnce(verifiedUser);
    const known = await requestPasswordReset("asha@example.com", "203.0.113.5");

    expect(unknown).toBe("sent");
    expect(known).toBe(unknown);
  });

  it("sends a reset link only for a verified, active account", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(verifiedUser);
    await requestPasswordReset("asha@example.com", "203.0.113.5");

    expect(mocks.issueToken).toHaveBeenCalledWith("u1", "PASSWORD_RESET");
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0].text).toContain("https://app.test/reset-password?token=raw-token-value-0123456789");
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.password.reset_requested" }));
  });

  it("does not send anything for an unknown email", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(null);
    await requestPasswordReset("nobody@example.com", "203.0.113.5");

    expect(mocks.issueToken).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not send for an unverified account", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce({ ...verifiedUser, emailVerifiedAt: null });
    await requestPasswordReset("asha@example.com", "203.0.113.5");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("uses the per-IP and per-email limits", async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);
    await requestPasswordReset("asha@example.com", "203.0.113.5");

    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({ key: "forgot:ip:203.0.113.5", limit: 10, windowSeconds: 3600 });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
      key: "forgot:email:asha@example.com",
      limit: 5,
      windowSeconds: 3600,
    });
  });

  it("reports limited when the per-email limit is exceeded, without touching the account", async () => {
    mocks.consumeRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 9, retryAfterSeconds: 3600 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 3600 });

    const result = await requestPasswordReset("asha@example.com", "203.0.113.5");

    expect(result).toBe("limited");
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("completePasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the new hash and passwordChangedAt, and fills emailVerifiedAt when empty", async () => {
    mocks.consumeToken.mockResolvedValueOnce("u1");
    const before = Date.now();

    const ok = await completePasswordReset("raw-token-value-0123456789", "new-password-1", "203.0.113.5");

    expect(ok).toBe(true);
    const update = mocks.db.user.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "u1" });
    expect(update.data.passwordHash).toBe("scrypt$hash");
    expect(update.data.passwordChangedAt).toBeInstanceOf(Date);
    expect(update.data.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(before);

    expect(mocks.db.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", emailVerifiedAt: null },
      data: { emailVerifiedAt: expect.any(Date) },
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.password.reset_completed" }));
  });

  it("rejects a reused or expired token and changes nothing", async () => {
    // First use succeeds, second use of the same link is refused (consumeToken returns null).
    mocks.consumeToken.mockResolvedValueOnce("u1").mockResolvedValueOnce(null);

    expect(await completePasswordReset("raw-token-value-0123456789", "new-password-1")).toBe(true);
    expect(await completePasswordReset("raw-token-value-0123456789", "another-pass-2")).toBe(false);

    // Only the first call changed anything.
    expect(mocks.db.user.update).toHaveBeenCalledTimes(1);
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid token without writing", async () => {
    mocks.consumeToken.mockResolvedValueOnce(null);
    expect(await completePasswordReset("unknown-token-value-000000", "new-password-1")).toBe(false);
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
