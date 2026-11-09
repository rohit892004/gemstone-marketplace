import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { appUrl } from "@/lib/config/app-url";
import { prisma } from "@/lib/db/client";
import { emailTemplates } from "@/lib/notify/templates";
import { hashPassword } from "@/lib/auth/password";
import { consumeToken, issueToken } from "@/lib/auth/tokens";
import { sendMailSafely } from "./send";
import { LIMITS, withinHourlyLimit } from "./limits";

/**
 * Starts a reset. The caller shows the same message for every outcome except "limited".
 * A link is only issued for verified, active accounts. Other cases do nothing visible.
 */
export async function requestPasswordReset(email: string, ip: string): Promise<"sent" | "limited"> {
  if (!(await withinHourlyLimit(`forgot:ip:${ip}`, LIMITS.forgot.ip))) return "limited";
  if (!(await withinHourlyLimit(`forgot:email:${email}`, LIMITS.forgot.email))) return "limited";

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, emailVerifiedAt: true, status: true },
  });
  if (user?.emailVerifiedAt && user.status === "ACTIVE") {
    const token = await issueToken(user.id, "PASSWORD_RESET");
    const mail = emailTemplates.passwordReset(user.name, appUrl(`/reset-password?token=${encodeURIComponent(token)}`));
    await sendMailSafely(user.email, mail);
    await recordAudit({
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      entityType: "User",
      entityId: user.id,
      ip,
    });
  }
  return "sent";
}

/**
 * Consumes a reset token and sets the new password. Sets passwordChangedAt, which revokes
 * sessions issued before the reset (see requireRole). A reset link also proves the email
 * address, so emailVerifiedAt is filled in if it was empty.
 * Returns false for invalid, expired or already-used tokens.
 */
export async function completePasswordReset(token: string, password: string, ip: string | null = null): Promise<boolean> {
  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) return false;

  const passwordHash = await hashPassword(password);
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: now },
    }),
    prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: now },
    }),
  ]);

  await recordAudit({
    action: AuditAction.PASSWORD_RESET_COMPLETED,
    actorId: userId,
    entityType: "User",
    entityId: userId,
    ip,
  });
  return true;
}
