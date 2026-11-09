import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registerAccount: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/register", () => ({ registerAccount: mocks.registerAccount }));
vi.mock("@/lib/security/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));

import { submitBuyerRegistration } from "./register";

const validInput = {
  name: "Asha Rao",
  email: "Asha@Example.com",
  mobile: "+91 98123 45678",
  password: "correct-horse-1",
  country: "India",
};

describe("submitBuyerRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 3600 });
  });

  it("returns the same success result for a new account and for a duplicate email", async () => {
    mocks.registerAccount.mockResolvedValueOnce({ outcome: "CREATED", userId: "u1" });
    const created = await submitBuyerRegistration({ ...validInput }, "203.0.113.5");

    mocks.registerAccount.mockResolvedValueOnce({ outcome: "EXISTING" });
    const duplicate = await submitBuyerRegistration({ ...validInput }, "203.0.113.5");

    expect(created).toEqual({ ok: true });
    expect(duplicate).toEqual(created);
  });

  it("passes normalised values and creates the BuyerProfile inside the transaction", async () => {
    mocks.registerAccount.mockResolvedValueOnce({ outcome: "CREATED", userId: "u1" });
    await submitBuyerRegistration({ ...validInput }, "203.0.113.5");

    const args = mocks.registerAccount.mock.calls[0][0];
    expect(args).toMatchObject({
      role: "BUYER",
      email: "asha@example.com",
      mobile: "+919812345678",
      name: "Asha Rao",
      country: "India",
      ip: "203.0.113.5",
    });

    const tx = { buyerProfile: { create: vi.fn(async () => ({})) } };
    await args.createProfile(tx, { id: "u1", email: "asha@example.com" });
    expect(tx.buyerProfile.create).toHaveBeenCalledWith({
      data: { userId: "u1", name: "Asha Rao", country: "India" },
    });
  });

  it("returns field errors without creating an account when input is invalid", async () => {
    const result = await submitBuyerRegistration({ ...validInput, email: "not-an-email" }, "203.0.113.5");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.state.fieldErrors?.email).toBeTruthy();
      expect(result.state.values?.email).toBe("not-an-email");
    }
    expect(mocks.registerAccount).not.toHaveBeenCalled();
  });

  it("rejects countries outside the list", async () => {
    const result = await submitBuyerRegistration({ ...validInput, country: "Atlantis" }, "203.0.113.5");
    expect(result.ok).toBe(false);
    expect(mocks.registerAccount).not.toHaveBeenCalled();
  });

  it("blocks after 10 registrations per IP per hour with a generic message", async () => {
    mocks.consumeRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 120 });
    const result = await submitBuyerRegistration({ ...validInput }, "203.0.113.5");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.state.error).toMatch(/too many attempts/i);
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
      key: "register:ip:203.0.113.5",
      limit: 10,
      windowSeconds: 3600,
    });
    expect(mocks.registerAccount).not.toHaveBeenCalled();
  });
});
