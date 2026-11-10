import Link from "next/link";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { AuthCard } from "@/components/auth/fields";

export default function CheckEmailPage() {
  return (
    <AuthCard title="Check your inbox">
      <p className="text-sm text-ink-soft">
        We have sent a verification link to the email address you entered. Open it to activate your account.
        The link works once and expires after 24 hours. Check your spam folder if you do not see it.
      </p>

      <div className="space-y-3 border-t border-line pt-6">
        <h2 className="text-sm font-medium text-ink">Did not get the email?</h2>
        <ResendVerificationForm />
      </div>

      <p className="text-center text-sm text-ink-soft">
        <Link href="/login" className="font-medium text-brand hover:text-brand-strong">
          Back to log in
        </Link>
      </p>
    </AuthCard>
  );
}
