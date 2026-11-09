import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, Notice } from "@/components/auth/fields";
import { LoginForm } from "@/components/auth/login-form";
import { loginMessageForCode, safeNextPath } from "@/lib/auth/flows/login";
import { firstParam, type SearchParams } from "@/lib/auth/flows/params";

export default function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={null}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next));
  // Auth.js puts the detail in `code`; the proxy and requirePageRole put the code in `error`.
  const code = firstParam(params.code) ?? firstParam(params.error);
  const initialError = code ? loginMessageForCode(code) : undefined;
  const resetDone = firstParam(params.reset) === "1";

  return (
    <AuthCard title="Log in">
      {resetDone ? <Notice tone="success">Your password has been reset. Log in with your new password.</Notice> : null}

      <LoginForm next={next} initialError={initialError} />

      {code === "email_not_verified" ? (
        <p className="text-center text-sm text-ink-soft">
          <Link href="/check-email" className="font-medium text-brand hover:text-brand-strong">
            Resend the verification email
          </Link>
        </p>
      ) : null}

      <p className="text-center text-sm text-ink-soft">
        New to Gemstone Selections?{" "}
        <Link href="/register" className="font-medium text-brand hover:text-brand-strong">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
