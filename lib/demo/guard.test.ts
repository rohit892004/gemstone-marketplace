import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { assertDemoAllowed } from "./guard";

const base = { DATABASE_URL: "postgresql://u:p@localhost:5432/db" };

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetEnvCacheForTests();
}

beforeEach(() => setEnv({ ...base, NODE_ENV: "development", ALLOW_DEMO_SEED: undefined }));
afterEach(() => setEnv({ ALLOW_DEMO_SEED: undefined, NODE_ENV: undefined }));

describe("assertDemoAllowed", () => {
  it("refuses by default, even outside production (explicit opt-in is required)", () => {
    expect(() => assertDemoAllowed()).toThrow(/ALLOW_DEMO_SEED/);
  });

  it("allows development when ALLOW_DEMO_SEED=true", () => {
    setEnv({ ALLOW_DEMO_SEED: "true" });
    expect(() => assertDemoAllowed()).not.toThrow();
  });

  it("refuses in production even when ALLOW_DEMO_SEED=true", () => {
    setEnv({ NODE_ENV: "production", ALLOW_DEMO_SEED: "true" });
    expect(() => assertDemoAllowed()).toThrow(/production/);
  });
});
