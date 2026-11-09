import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  NODE_ENV: "production" as "development" | "test" | "production",
  ALLOW_DEMO_SEED: "false" as "true" | "false",
}));

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ NODE_ENV: env.NODE_ENV, ALLOW_DEMO_SEED: env.ALLOW_DEMO_SEED }),
}));

import type { PrismaClient } from "@/app/generated/prisma/client";
import { seedM3Demo } from "@/prisma/seed-m3-demo";

/** A client whose every property access is recorded, so any database touch fails the test. */
function touchRecorder() {
  const touched = vi.fn();
  const client = new Proxy({} as Record<string, unknown>, {
    get: () => {
      touched();
      return undefined;
    },
  }) as unknown as PrismaClient;
  return { client, touched };
}

describe("M3 demo seed guard", () => {
  it("refuses to run in production, before touching the database", async () => {
    env.NODE_ENV = "production";
    env.ALLOW_DEMO_SEED = "true";
    const { client, touched } = touchRecorder();
    await expect(seedM3Demo(client)).rejects.toThrow("Demo data is not allowed in production");
    expect(touched).not.toHaveBeenCalled();
  });

  it("refuses to run without ALLOW_DEMO_SEED=true, before touching the database", async () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEMO_SEED = "false";
    const { client, touched } = touchRecorder();
    await expect(seedM3Demo(client)).rejects.toThrow("ALLOW_DEMO_SEED=true");
    expect(touched).not.toHaveBeenCalled();
  });
});
