import type { PrismaClient } from "@/app/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { getEnv } from "@/lib/config/env";

/**
 * Creates the platform admin from ADMIN_EMAIL / ADMIN_PASSWORD. Idempotent:
 * - unset env vars: skipped
 * - email missing: created as ADMIN (ACTIVE, email already verified)
 * - email exists as ADMIN: left untouched (password is NOT reset)
 * - email exists with another role: throws, never promotes an existing account
 *
 * No audit entry is written: there is no seed action in AuditAction.
 */
export async function seedAdminFromEnv(prisma: Pick<PrismaClient, "user">): Promise<void> {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = getEnv();
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log("Skipping admin seed: ADMIN_EMAIL/ADMIN_PASSWORD not set");
    return;
  }

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (existing) {
    if (existing.role === "ADMIN") {
      console.log(`Admin seed: ${email} already exists as ADMIN; leaving it unchanged.`);
      return;
    }
    throw new Error("email is in use by a non-admin account; refusing to promote");
  }

  await prisma.user.create({
    data: {
      email,
      name: "Platform Admin",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(ADMIN_PASSWORD),
    },
  });
  console.log(`Admin seed: created ADMIN account ${email}.`);
}
