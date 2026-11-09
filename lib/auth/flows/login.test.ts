import { describe, expect, it } from "vitest";
import { INVALID_LOGIN_MESSAGE, loginMessageForCode, safeNextPath } from "./login";

describe("loginMessageForCode", () => {
  it("maps email_not_verified to a verify-your-email message", () => {
    expect(loginMessageForCode("email_not_verified")).toMatch(/verify your email/i);
  });

  it("maps account_suspended to a suspended message", () => {
    expect(loginMessageForCode("account_suspended")).toMatch(/suspended/i);
  });

  it("maps rate_limited to a try-later message", () => {
    expect(loginMessageForCode("rate_limited")).toMatch(/too many attempts/i);
  });

  it("falls back to the generic message for wrong credentials and unknown codes", () => {
    expect(loginMessageForCode(undefined)).toBe(INVALID_LOGIN_MESSAGE);
    expect(loginMessageForCode("CredentialsSignin")).toBe(INVALID_LOGIN_MESSAGE);
    expect(loginMessageForCode("__proto__")).toBe(INVALID_LOGIN_MESSAGE);
    expect(loginMessageForCode(42)).toBe(INVALID_LOGIN_MESSAGE);
  });
});

describe("safeNextPath (open redirect guard)", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/buyer")).toBe("/buyer");
    expect(safeNextPath("/gemstones?shape=oval&page=2")).toBe("/gemstones?shape=oval&page=2");
  });

  it("falls back to /dashboard for missing or empty values", () => {
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
    expect(safeNextPath(["/a", "/b"])).toBe("/dashboard");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.example/steal")).toBe("/dashboard");
    expect(safeNextPath("http://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example/steal")).toBe("/dashboard");
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects backslash tricks that browsers treat as protocol-relative", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("\\\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("/%5Cevil.example")).toBe("/%5Cevil.example");
  });

  it("rejects control characters and oversized values", () => {
    expect(safeNextPath("/ok\r\nLocation: https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("/" + "a".repeat(3000))).toBe("/dashboard");
  });

  it("honours a custom fallback", () => {
    expect(safeNextPath("//evil.example", "/buyer")).toBe("/buyer");
  });
});
