import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    user: { update: vi.fn() },
  },
  issueCode: vi.fn(),
  verifyCode: vi.fn(),
  consumeRateLimit: vi.fn(),
  smsSend: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: mocks.db }));
vi.mock("@/lib/auth/tokens", () => ({ issueCode: mocks.issueCode, verifyCode: mocks.verifyCode }));
vi.mock("@/lib/security/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock("@/lib/notify/sms", () => ({ getSmsProvider: () => ({ send: mocks.smsSend }) }));
vi.mock("@/lib/audit/audit", () => ({ recordAudit: mocks.recordAudit }));

import { confirmMobileOtp, sendMobileOtp } from "./mobile-otp";

const allowed = { allowed: true, remaining: 1, retryAfterSeconds: 3600 };
const blocked = { allowed: false, remaining: 0, retryAfterSeconds: 3600 };

describe("sendMobileOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeRateLimit.mockResolvedValue(allowed);
    mocks.issueCode.mockResolvedValue("123456");
  });

  it("issues a code, texts it with the agreed wording and audits OTP_SENT", async () => {
    expect(await sendMobileOtp("u1", "+919812345678", "203.0.113.5")).toBe("sent");

    expect(mocks.issueCode).toHaveBeenCalledWith("u1", "MOBILE_OTP");
    expect(mocks.smsSend).toHaveBeenCalledWith({
      to: "+919812345678",
      body: "Your Gemstone Selections code is 123456. It expires in 10 minutes.",
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.mobile.otp_sent", actorId: "u1" }));
  });

  it("limits sends to 5 per user per hour", async () => {
    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    mocks.consumeRateLimit.mockResolvedValueOnce(blocked);
    expect(await sendMobileOtp("u1", "+919812345678")).toBe("limited");
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({ key: "otp:user:u1", limit: 5, windowSeconds: 3600 });
    expect(mocks.issueCode).not.toHaveBeenCalled();
    expect(mocks.smsSend).not.toHaveBeenCalled();
  });
});

describe("confirmMobileOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeRateLimit.mockResolvedValue(allowed);
  });

  it("marks the mobile verified once the code matches", async () => {
    mocks.verifyCode.mockResolvedValueOnce(true);
    expect(await confirmMobileOtp("u1", "123456", "203.0.113.5")).toBe("verified");

    expect(mocks.verifyCode).toHaveBeenCalledWith("u1", "MOBILE_OTP", "123456");
    expect(mocks.db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { mobileVerifiedAt: expect.any(Date) },
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.mobile.verified" }));
  });

  it("does not verify on a wrong code, and stays unverified after the lock", async () => {
    // verifyCode returns false for a wrong guess and for every guess after 5 wrong tries (locked).
    mocks.verifyCode.mockResolvedValue(false);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      expect(await confirmMobileOtp("u1", "000000")).toBe("invalid");
    }
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("limits verification attempts to 20 per user per hour", async () => {
    mocks.consumeRateLimit.mockResolvedValueOnce(blocked);
    expect(await confirmMobileOtp("u1", "123456")).toBe("limited");
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({ key: "otp-verify:user:u1", limit: 20, windowSeconds: 3600 });
    expect(mocks.verifyCode).not.toHaveBeenCalled();
  });
});
