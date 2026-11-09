import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { appUrl } from "@/lib/config/app-url";
import { prisma } from "@/lib/db/client";
import { emailTemplates } from "@/lib/notify/templates";
import { verifyEmailSchema } from "@/lib/validation/schemas";
import { consumeToken, issueToken } from "@/lib/auth/tokens";
import { sendMailSafely } from "./send";
import { LIMITS, withinHourlyLimit } from "./limits";

/**
 * Consumes a verification link (single use, expiring) and marks the email verified.
 * Returns false for unknown, expired, reused or malformed tokens alike.
 */
export async function verifyEmailToken(raw: string, ip: string | null = null): Promise<boolean> {
  const parsed = verifyEmailSchema.safeParse({ token: raw });
  if (!parsed.success) return false;

  const userId = await consumeToken(parsed.data.token, "EMAIL_VERIFICATION");
  if (!userId) return false;

  // updateMany keeps the original timestamp if the account was already verified.
  await prisma.user.updateMany({
    where: { id: userId, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  await recordAudit({
    action: AuditAction.EMAIL_VERIFIED,
    actorId: userId,
    entityType: "User",
    entityId: userId,
    ip,
  });
  return true;
}

/**
 * Sends a fresh verification link if the account exists and is still unverified.
 * Always resolves to "sent" unless the limit is hit. The limit is keyed by email, not
 * user id, so the "too many attempts" answer does not depend on whether the account exists.
 */
export async function resendVerificationLink(email: string): Promise<"sent" | "limited"> {
  if (!(await withinHourlyLimit(`verify-resend:email:${email}`, LIMITS.verifyResend.email))) {
    return "limited";
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });
  if (user && !user.emailVerifiedAt) {
    const token = await issueToken(user.id, "EMAIL_VERIFICATION");
    const mail = emailTemplates.verifyEmail(user.name, appUrl(`/verify-email?token=${encodeURIComponent(token)}`));
    await sendMailSafely(user.email, mail);
  }
  return "sent";
}
