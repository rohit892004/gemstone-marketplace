import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
}));

// Lightweight stand-ins for the Auth.js error classes, so the real package is not loaded.
vi.mock("next-auth", () => {
  class AuthError extends Error {
    type = "AuthError";
  }
  class CredentialsSignin extends AuthError {
    code?: string;
  }
  return { AuthError, CredentialsSignin };
});

vi.mock("@/lib/auth/auth", () => ({ signIn: mocks.signIn }));

import { AuthError, CredentialsSignin } from "next-auth";
import { loginWithPassword } from "./actions";

/** Stands in for Next's redirect error, which is thrown on successful sign-in. */
class FakeRedirect extends Error {}

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function credentialsError(code = ""): CredentialsSignin {
  const error = new CredentialsSignin();
  error.code = code;
  return error;
}

describe("loginWithPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps email_not_verified to the verify-email message and keeps the email", async () => {
    mocks.signIn.mockRejectedValueOnce(credentialsError("email_not_verified"));
    const state = await loginWithPassword({}, formData({ email: "Asha@Example.com", password: "pw-123456", next: "/buyer" }));

    expect(state.error).toMatch(/verify your email/i);
    expect(state.values?.email).toBe("asha@example.com");
  });

  it("maps account_suspended and rate_limited", async () => {
    mocks.signIn.mockRejectedValueOnce(credentialsError("account_suspended"));
    const suspended = await loginWithPassword({}, formData({ email: "a@example.com", password: "x" }));
    expect(suspended.error).toMatch(/suspended/i);

    mocks.signIn.mockRejectedValueOnce(credentialsError("rate_limited"));
    const limited = await loginWithPassword({}, formData({ email: "a@example.com", password: "x" }));
    expect(limited.error).toMatch(/too many attempts/i);
  });

  it("uses the generic message for wrong credentials", async () => {
    mocks.signIn.mockRejectedValueOnce(credentialsError(undefined));
    const state = await loginWithPassword({}, formData({ email: "a@example.com", password: "wrong" }));
    expect(state.error).toBe("Invalid email or password.");
  });

  it("uses the generic message for other Auth.js errors", async () => {
    mocks.signIn.mockRejectedValueOnce(new AuthError("boom"));
    const state = await loginWithPassword({}, formData({ email: "a@example.com", password: "wrong" }));
    expect(state.error).toBe("Invalid email or password.");
  });

  it("rethrows the success redirect so Next can navigate", async () => {
    mocks.signIn.mockRejectedValueOnce(new FakeRedirect("NEXT_REDIRECT"));
    await expect(loginWithPassword({}, formData({ email: "a@example.com", password: "pw-123456" }))).rejects.toBeInstanceOf(
      FakeRedirect,
    );
  });

  it("never passes an off-site next value to Auth.js (open redirect)", async () => {
    mocks.signIn.mockRejectedValueOnce(new FakeRedirect("NEXT_REDIRECT"));
    await expect(
      loginWithPassword({}, formData({ email: "a@example.com", password: "pw-123456", next: "//evil.example" })),
    ).rejects.toBeInstanceOf(FakeRedirect);

    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "a@example.com",
      password: "pw-123456",
      redirectTo: "/dashboard",
    });
  });

  it("passes a safe relative next value through", async () => {
    mocks.signIn.mockRejectedValueOnce(new FakeRedirect("NEXT_REDIRECT"));
    await expect(
      loginWithPassword({}, formData({ email: "a@example.com", password: "pw-123456", next: "/gemstones?page=2" })),
    ).rejects.toBeInstanceOf(FakeRedirect);

    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "a@example.com",
      password: "pw-123456",
      redirectTo: "/gemstones?page=2",
    });
  });

  it("rejects empty input without calling Auth.js", async () => {
    const state = await loginWithPassword({}, formData({ email: "", password: "" }));
    expect(state.error).toBeTruthy();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
});
