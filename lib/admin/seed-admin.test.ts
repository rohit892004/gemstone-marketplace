import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/app/generated/prisma/client";

const env = vi.hoisted(() => ({
  values: {} as { ADMIN_EMAIL?: string; ADMIN_PASSWORD?: string },
}));

vi.mock("@/lib/config/env", () => ({
  getEnv: () => env.values,
}));

// Real scrypt is deliberately slow; the seed only needs a hash value.
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(async () => "scrypt$hashed"),
}));

import { seedAdminFromEnv } from "./seed-admin";

function fakePrisma(existing: { id: string; role: string } | null = null) {
  const findUnique = vi.fn(async () => existing);
  const create = vi.fn<(args: { data: Record<string, unknown> }) => Promise<{ id: string }>>(async () => ({
    id: "u_new",
  }));
  const prisma = { user: { findUnique, create } };
  return { prisma: prisma as unknown as Pick<PrismaClient, "user">, findUnique, create };
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  env.values = { ADMIN_EMAIL: "Admin@Example.com", ADMIN_PASSWORD: "correct-horse-battery" };
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  vi.clearAllMocks();
});

describe("seedAdminFromEnv", () => {
  it("skips when ADMIN_EMAIL or ADMIN_PASSWORD is unset", async () => {
    env.values = {};
    const { prisma, findUnique, create } = fakePrisma();

    await seedAdminFromEnv(prisma);

    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Skipping admin seed: ADMIN_EMAIL/ADMIN_PASSWORD not set");
  });

  it("skips when only the password is set", async () => {
    env.values = { ADMIN_EMAIL: "admin@example.com" };
    const { prisma, create } = fakePrisma();

    await seedAdminFromEnv(prisma);

    expect(create).not.toHaveBeenCalled();
  });

  it("creates an ADMIN with a lowercase email when none exists", async () => {
    const { prisma, findUnique, create } = fakePrisma(null);

    await seedAdminFromEnv(prisma);

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "admin@example.com" },
      select: { id: true, role: true },
    });
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      email: "admin@example.com",
      name: "Platform Admin",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: "scrypt$hashed",
    });
    expect(data.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("does nothing when an ADMIN with that email already exists", async () => {
    const { prisma, create } = fakePrisma({ id: "u_admin", role: "ADMIN" });

    await seedAdminFromEnv(prisma);

    expect(create).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("already exists as ADMIN"));
  });

  it("throws instead of promoting an existing non-admin account", async () => {
    const { prisma, create } = fakePrisma({ id: "u_buyer", role: "BUYER" });

    await expect(seedAdminFromEnv(prisma)).rejects.toThrow(
      "email is in use by a non-admin account; refusing to promote",
    );
    expect(create).not.toHaveBeenCalled();
  });
});
