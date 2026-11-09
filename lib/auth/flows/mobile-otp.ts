import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/client";
import { getSmsProvider } from "@/lib/notify/sms";
import { issueCode, verifyCode } from "@/lib/auth/tokens";
import { LIMITS, withinHourlyLimit } from "./limits";

/** Issues a fresh code and texts it. Invalidates any earlier code for this user. */
export async function sendMobileOtp(userId: string, mobile: string, ip: string | null = null): Promise<"sent" | "limited"> {
  if (!(await withinHourlyLimit(`otp:user:${userId}`, LIMITS.otpSend.user))) return "limited";

  const code = await issueCode(userId, "MOBILE_OTP");
  await getSmsProvider().send({
    to: mobile,
    body: `Your Gemstone Selections code is ${code}. It expires in 10 minutes.`,
  });
  await recordAudit({
    action: AuditAction.OTP_SENT,
    actorId: userId,
    entityType: "User",
    entityId: userId,
    ip,
  });
  return "sent";
}

/**
 * Checks a code. Wrong guesses are counted by verifyCode and lock the code after 5 tries.
 * Returns "verified" at most once per issued code.
 */
export async function confirmMobileOtp(
  userId: string,
  code: string,
  ip: string | null = null,
): Promise<"verified" | "invalid" | "limited"> {
  if (!(await withinHourlyLimit(`otp-verify:user:${userId}`, LIMITS.otpVerify.user))) return "limited";

  const ok = await verifyCode(userId, "MOBILE_OTP", code);
  if (!ok) return "invalid";

  await prisma.user.update({ where: { id: userId }, data: { mobileVerifiedAt: new Date() } });
  await recordAudit({
    action: AuditAction.MOBILE_VERIFIED,
    actorId: userId,
    entityType: "User",
    entityId: userId,
    ip,
  });
  return "verified";
}
