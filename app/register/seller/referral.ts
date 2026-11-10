import { cookies, headers } from "next/headers";
import { validVisitorId, VISITOR_COOKIE } from "@/lib/analytics/tracking";
import { attributionSignals, normaliseReferralCode } from "@/lib/membership/attribution";
import { attributeReferral } from "@/lib/membership/service";
import { referralSignalSecret } from "@/lib/membership/secret";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Referral attribution for a seller who just registered with ?ref=. Never blocks or fails the registration: every
 * problem is logged and dropped. Unknown codes and self-referrals are refused silently (attributeReferral decides).
 *
 * The account is found by email and must have been created in the last few minutes. An email that already had an
 * account gets the same "check your email" result, and must not be attributed to a referrer after the fact.
 */
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

export async function attributeSellerReferral(input: { email: string; ref: string | null | undefined }): Promise<void> {
  try {
    const code = normaliseReferralCode(input.ref);
    if (!code) return;

    const email = input.email.trim();
    if (!email) return;
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, role: "SELLER" },
      select: { id: true, email: true, createdAt: true },
    });
    if (!user || Date.now() - user.createdAt.getTime() > NEW_ACCOUNT_WINDOW_MS) return;

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
