import Link from "next/link";
import { AuthCard } from "@/components/auth/fields";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password">
      <p className="text-sm text-ink-soft">
        Enter the email address on your account. If it matches an account, we will send a link to set a new password.
      </p>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-ink-soft">
        <Link href="/login" className="font-medium text-brand hover:text-brand-strong">
          Back to log in
        </Link>
      </p>
    </AuthCard>
  );
}
