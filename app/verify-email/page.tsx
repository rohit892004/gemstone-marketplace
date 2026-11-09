import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AuthCard, Notice } from "@/components/auth/fields";
import { verifyEmailToken } from "@/lib/auth/flows/email-verification";
import { firstParam, type SearchParams } from "@/lib/auth/flows/params";
import { MESSAGES } from "@/lib/auth/flows/messages";
import { getClientIp } from "@/lib/security/client-ip";

export default function VerifyEmailPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={null}>
      <VerifyEmailResult searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyEmailResult({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const token = firstParam((await searchParams).token);
  const ip = getClientIp(await headers());
  const verified = token ? await verifyEmailToken(token, ip) : false;

  if (verified) {
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
