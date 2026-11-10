import Link from "next/link";
import { Suspense } from "react";
import { AuthLayout, authLinkClass } from "@/components/auth/auth-layout";
import { Notice } from "@/components/auth/fields";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { firstParam, type SearchParams } from "@/lib/auth/flows/params";
import { MESSAGES } from "@/lib/auth/flows/messages";
import { confirmEmailAction } from "./actions";

const PHOTO = "/design-preview/luxury/stone-5.webp";
const CAPTION = "Each verification link works once.";

/**
 * GET never consumes the token. It shows a confirm button; the POST action consumes it.
 * Result is shown via ?status=ok|invalid after the redirect, so the token leaves the URL.
 */
export default function VerifyEmailPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={null}>
      <VerifyEmailResult searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyEmailResult({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const status = firstParam(params.status);
  const token = firstParam(params.token);

  if (status === "ok") {
    return (
      <AuthLayout eyebrow="Email" title="Email verified" photo={PHOTO} caption={CAPTION}>
        <Notice tone="success">Your email address is verified. You can now log in.</Notice>
        <ButtonLink href="/login" block className="min-h-11">
          Go to log in
        </ButtonLink>
      </AuthLayout>
    );
  }

  if (token && status !== "invalid") {
    return (
      <AuthLayout eyebrow="Email" title="Confirm your email" photo={PHOTO} caption={CAPTION}>
        <p className="text-sm leading-relaxed text-ink-soft">Press the button below to confirm your email address.</p>
        <form action={confirmEmailAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={buttonClasses({ block: true, size: "lg", className: "min-h-11" })}>
            Confirm email
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Email" title="Link not valid" photo={PHOTO} caption={CAPTION}>
      <Notice tone="error">{MESSAGES.invalidLink}</Notice>
      <p className="text-center text-sm">
        <Link href="/check-email" className={authLinkClass}>
          Request a new verification link
        </Link>
      </p>
    </AuthLayout>
  );
}
