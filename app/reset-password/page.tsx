import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, Notice } from "@/components/auth/fields";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { MESSAGES } from "@/lib/auth/flows/messages";
import { firstParam, type SearchParams } from "@/lib/auth/flows/params";

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}

/** The token is checked and consumed when the form is submitted (see actions.ts). */
async function ResetPasswordContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const token = firstParam((await searchParams).token);

  if (!token) {
    return (
      <AuthCard title="Link not valid">
        <Notice tone="error">{MESSAGES.invalidLink}</Notice>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-brand hover:text-brand-strong">
            Request a new reset link
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
