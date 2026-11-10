import Link from "next/link";
import { Suspense } from "react";
import { AuthLayout, authLinkClass } from "@/components/auth/auth-layout";
import { Notice } from "@/components/auth/fields";
import { SendMobileCodeForm, VerifyMobileCodeForm } from "@/components/auth/mobile-otp-forms";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";

const PHOTO = "/design-preview/luxury/stone-6.webp";
const CAPTION = "We text a code only to the number on your account.";

export default function VerifyMobilePage() {
  return (
    <Suspense fallback={null}>
      <VerifyMobileContent />
    </Suspense>
  );
}

async function VerifyMobileContent() {
  const user = await requirePageRole(["BUYER", "SELLER", "ADMIN"]);
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mobile: true, mobileVerifiedAt: true },
  });

  if (record?.mobileVerifiedAt) {
    return (
      <AuthLayout eyebrow="Mobile" title="Mobile verified" photo={PHOTO} caption={CAPTION}>
        <Notice tone="success">Your mobile number is verified.</Notice>
        <p className="text-center text-sm">
          <Link href="/dashboard" className={authLinkClass}>
            Back to your dashboard
          </Link>
        </p>
      </AuthLayout>
    );
  }

  if (!record?.mobile) {
    return (
      <AuthLayout eyebrow="Mobile" title="Verify your mobile" photo={PHOTO} caption={CAPTION}>
        <Notice tone="error">Your account has no mobile number. Contact support to add one.</Notice>
      </AuthLayout>
    );
  }

  const masked = `${"*".repeat(Math.max(0, record.mobile.length - 4))}${record.mobile.slice(-4)}`;

  return (
    <AuthLayout eyebrow="Mobile" title="Verify your mobile" photo={PHOTO} caption={CAPTION}>
      <p className="text-sm leading-relaxed text-ink-soft">
        We will text a 6-digit code to <span className="font-medium text-ink">{masked}</span>. The code expires in 10
        minutes.
      </p>

      <SendMobileCodeForm label="Send code" />

      <div className="space-y-4 border-t border-line pt-6">
        <VerifyMobileCodeForm />
        <p className="text-sm text-ink-soft">Did not receive it?</p>
        <SendMobileCodeForm label="Resend code" />
      </div>
    </AuthLayout>
  );
}
