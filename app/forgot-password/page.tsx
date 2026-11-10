import Link from "next/link";
import { AuthLayout, authLinkClass } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      eyebrow="Account access"
      title="Reset your password"
      photo="/design-preview/luxury/stone-3.webp"
      caption="Passwords are hashed and never stored in plain text."
    >
      <p className="text-sm leading-relaxed text-ink-soft">
        Enter the email address on your account. If it matches an account, we will send a link to set a new password.
      </p>
      <ForgotPasswordForm />
      <p className="text-center text-sm">
        <Link href="/login" className={authLinkClass}>
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  );
}
