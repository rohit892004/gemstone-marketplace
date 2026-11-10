import Link from "next/link";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { AuthLayout, authLinkClass } from "@/components/auth/auth-layout";

export default function CheckEmailPage() {
  return (
    <AuthLayout
      eyebrow="Email"
      title="Check your inbox"
      photo="/design-preview/luxury/stone-7.webp"
      caption="Links work once and expire after 24 hours."
    >
      <p className="text-sm leading-relaxed text-ink-soft">
        We have sent a verification link to the email address you entered. Open it to activate your account.
        The link works once and expires after 24 hours. Check your spam folder if you do not see it.
      </p>

      <div className="space-y-4 border-t border-line pt-6">
        <h2 className="font-heading text-2xl text-ink">Did not get the email?</h2>
        <ResendVerificationForm />
      </div>

      <p className="text-center text-sm">
        <Link href="/login" className={authLinkClass}>
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  );
}
