import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ NODE_ENV: "production" as "development" | "test" | "production" }));

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ NODE_ENV: env.NODE_ENV }),
}));

import type { PrismaClient } from "@/app/generated/prisma/client";
import { seedDemo } from "@/prisma/seed-demo";

describe("demo seed guard", () => {
  it("refuses to run when NODE_ENV is production, before touching the database", async () => {
    env.NODE_ENV = "production";
    const touched = vi.fn();
    const fakePrisma = new Proxy({} as Record<string, unknown>, {
      get: () => {
        touched();
        return undefined;
      },
    }) as unknown as PrismaClient;

    await expect(seedDemo(fakePrisma, { put: touched, get: touched, delete: touched } as never)).rejects.toThrow(
      "Demo data is not allowed in production",
    );
    expect(touched).not.toHaveBeenCalled();
  });
});
