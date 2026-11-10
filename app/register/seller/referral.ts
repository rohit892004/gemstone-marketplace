import { cookies, headers } from "next/headers";
import { validVisitorId, VISITOR_COOKIE } from "@/lib/analytics/tracking";
import { attributionSignals, normaliseReferralCode } from "@/lib/membership/attribution";
import { attributeReferral } from "@/lib/membership/service";
import { referralSignalSecret } from "@/lib/membership/secret";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Referral attribution for a seller account that was just created with ?ref=. Never blocks or fails the registration:
 * every problem is logged and dropped. Unknown codes and self-referrals are refused silently (attributeReferral decides).
 *
 * The caller passes the id of the account the registration created. Attribution never looks an account up by email,
 * so an existing account can never be attributed after the fact.
 */
export async function attributeSellerReferral(input: { userId: string; ref: string | null | undefined }): Promise<void> {
  try {
    const code = normaliseReferralCode(input.ref);
    if (!code) return;

    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, email: true, role: true } });
    if (!user || user.role !== "SELLER") return;

    const requestHeaders = await headers();
    const visitorId = validVisitorId((await cookies()).get(VISITOR_COOKIE)?.value);
    const signals = attributionSignals({
      ip: getClientIp(requestHeaders),
      visitorId,
      secret: referralSignalSecret(),
    });

    await attributeReferral({
      referredUserId: user.id,
      referredEmail: user.email,
      code,
      ipHash: signals.ipHash,
      deviceHash: signals.deviceHash,
    });
  } catch (error) {
    console.error("[referral] attribution failed; registration continues", error);
  }
}
