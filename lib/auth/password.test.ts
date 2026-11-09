import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct-horse-1");
    await expect(verifyPassword("correct-horse-1", hash)).resolves.toBe(true);
    await expect(verifyPassword("correct-horse-2", hash)).resolves.toBe(false);
  });

  it("produces a different hash for the same password (random salt)", async () => {
    const a = await hashPassword("same-password-1");
    const b = await hashPassword("same-password-1");
    expect(a).not.toBe(b);
  });

  it("returns false for malformed stored values instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "bcrypt$x$y$z$a$b")).resolves.toBe(false);
  });
});
