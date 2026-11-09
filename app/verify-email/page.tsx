import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, Notice } from "@/components/auth/fields";
import { firstParam, type SearchParams } from "@/lib/auth/flows/params";
import { MESSAGES } from "@/lib/auth/flows/messages";
import { confirmEmailAction } from "./actions";

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
      <AuthCard title="Email verified">
        <Notice tone="success">Your email address is verified. You can now log in.</Notice>
        <p className="text-center">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-strong"
          >
            Go to log in
          </Link>
        </p>
      </AuthCard>
    );
  }

  if (token && status !== "invalid") {
    return (
      <AuthCard title="Confirm your email">
        <p className="text-sm text-ink-soft">Press the button below to confirm your email address.</p>
        <form action={confirmEmailAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-strong"
          >
            Confirm email
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Link not valid">
      <Notice tone="error">{MESSAGES.invalidLink}</Notice>
      <p className="text-center text-sm">
        <Link href="/check-email" className="font-medium text-brand hover:text-brand-strong">
          Request a new verification link
        </Link>
      </p>
    </AuthCard>
  );
}
