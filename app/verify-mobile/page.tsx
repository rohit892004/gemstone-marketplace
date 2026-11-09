import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, Notice } from "@/components/auth/fields";
import { SendMobileCodeForm, VerifyMobileCodeForm } from "@/components/auth/mobile-otp-forms";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";

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
      <AuthCard title="Mobile verified">
        <Notice tone="success">Your mobile number is verified.</Notice>
        <p className="text-center text-sm">
          <Link href="/dashboard" className="font-medium text-brand hover:text-brand-strong">
            Back to your dashboard
          </Link>
        </p>
      </AuthCard>
    );
  }

  if (!record?.mobile) {
    return (
      <AuthCard title="Verify your mobile">
        <Notice tone="error">Your account has no mobile number. Contact support to add one.</Notice>
      </AuthCard>
    );
  }

  const masked = `${"*".repeat(Math.max(0, record.mobile.length - 4))}${record.mobile.slice(-4)}`;

  return (
    <AuthCard title="Verify your mobile">
      <p className="text-sm text-ink-soft">
        We will text a 6-digit code to <span className="font-medium text-ink">{masked}</span>. The code expires in 10
        minutes.
      </p>

      <SendMobileCodeForm label="Send code" />

      <div className="space-y-4 border-t border-line pt-6">
        <VerifyMobileCodeForm />
        <p className="text-sm text-ink-soft">Did not receive it?</p>
        <SendMobileCodeForm label="Resend code" />
      </div>
    </AuthCard>
  );
}
