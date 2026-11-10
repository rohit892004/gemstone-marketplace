import Link from "next/link";
import { Suspense } from "react";
import { AuthLayout, authLinkClass } from "@/components/auth/auth-layout";
import { Notice } from "@/components/auth/fields";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { MESSAGES } from "@/lib/auth/flows/messages";
import { firstParam, type SearchParams } from "@/lib/auth/flows/params";

const PHOTO = "/design-preview/luxury/stone-4.webp";
const CAPTION = "Passwords are hashed and never stored in plain text.";

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
      <AuthLayout eyebrow="Account access" title="Link not valid" photo={PHOTO} caption={CAPTION}>
        <Notice tone="error">{MESSAGES.invalidLink}</Notice>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className={authLinkClass}>
            Request a new reset link
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Account access" title="Choose a new password" photo={PHOTO} caption={CAPTION}>
      <ResetPasswordForm token={token} />
    </AuthLayout>
  );
}
