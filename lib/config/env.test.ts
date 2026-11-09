import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("accepts a valid DATABASE_URL and applies defaults", () => {
    const env = parseEnv({ DATABASE_URL: "postgresql://user:pw@localhost:5432/db" });
    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_URL).toBe("http://localhost:3000");
  });

  it("throws a readable error when DATABASE_URL is missing", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects an unknown NODE_ENV value", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "postgresql://x@y/z", NODE_ENV: "staging" }),
    ).toThrow(/NODE_ENV/);
  });
});
