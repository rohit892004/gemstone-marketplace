import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/client";

/**
 * Single-use, expiring tokens (email verification, password reset) and
 * short numeric codes (mobile OTP). Only hashes are stored, never the raw value.
 *
 * Rules:
 * - Issuing a new token/code invalidates older unused ones for the same user and purpose.
 * - Consuming is atomic: a token works once, even under concurrent requests.
 * - Codes lock after MAX_CODE_ATTEMPTS wrong guesses.
 */

export const MAX_CODE_ATTEMPTS = 5;

type LinkPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";
type CodePurpose = "MOBILE_OTP";

const TTL_MINUTES: Record<LinkPurpose | CodePurpose, number> = {
  EMAIL_VERIFICATION: 60 * 24,
  PASSWORD_RESET: 30,
  MOBILE_OTP: 10,
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function linkHash(purpose: LinkPurpose, raw: string): string {
  return sha256(`link:${purpose}:${raw}`);
}

function codeHash(userId: string, purpose: CodePurpose, code: string): string {
  return sha256(`code:${purpose}:${userId}:${code}`);
}

/** Issues a URL-safe random token for an email link. Returns the raw token once. */
export async function issueToken(userId: string, purpose: LinkPurpose): Promise<string> {
  const now = new Date();
  const raw = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // Close older open tokens for this user+purpose.
    prisma.authToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash: linkHash(purpose, raw),
        expiresAt: new Date(now.getTime() + TTL_MINUTES[purpose] * 60_000),
      },
    }),
  ]);
  return raw;
}

/**
 * Consumes a link token. Returns the user id, or null if the token is unknown,
 * expired, already used, or was issued for a different purpose.
 */
export async function consumeToken(raw: string, purpose: LinkPurpose): Promise<string | null> {
  const now = new Date();
  const tokenHash = linkHash(purpose, raw);
  const claimed = await prisma.authToken.updateMany({
    where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return null;
  const row = await prisma.authToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  return row?.userId ?? null;
}

/** Issues a numeric code (default 6 digits). Returns the raw code once; send it, don't store it. */
export async function issueCode(userId: string, purpose: CodePurpose, digits = 6): Promise<string> {
  const now = new Date();
  const code = String(randomInt(0, 10 ** digits)).padStart(digits, "0");
  await prisma.$transaction([
    // Old rows: mark used AND randomise their hash so they can never match again.
    // This also avoids unique-hash collisions when the same code is issued twice.
    prisma.$executeRaw`
      UPDATE "AuthToken"
      SET "usedAt" = COALESCE("usedAt", ${now}),
          "tokenHash" = md5(random()::text || clock_timestamp()::text || "id")
      WHERE "userId" = ${userId} AND "purpose" = ${purpose}::"AuthTokenPurpose"
    `,
    prisma.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash: codeHash(userId, purpose, code),
        expiresAt: new Date(now.getTime() + TTL_MINUTES[purpose] * 60_000),
      },
    }),
  ]);
  return code;
}

/**
 * Verifies a code. Counts wrong attempts and locks after MAX_CODE_ATTEMPTS.
 * Returns true at most once per issued code.
 */
export async function verifyCode(userId: string, purpose: CodePurpose, code: string): Promise<boolean> {
  const now = new Date();
  const active = await prisma.authToken.findFirst({
    where: { userId, purpose, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!active) return false;

  // Reserve one attempt atomically BEFORE comparing. Parallel guesses cannot all pass the
  // limit check: each one either gets a reserved attempt or is refused.
  const reserved = await prisma.authToken.updateMany({
    where: { id: active.id, usedAt: null, attempts: { lt: MAX_CODE_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (reserved.count !== 1) return false;

  const expected = Buffer.from(active.tokenHash, "hex");
  const actual = Buffer.from(codeHash(userId, purpose, code), "hex");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) return false;

  const claimed = await prisma.authToken.updateMany({
    where: { id: active.id, usedAt: null },
    data: { usedAt: now },
  });
  return claimed.count === 1;
}
