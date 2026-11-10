import Link from "next/link";
import { Suspense } from "react";
import { Notice } from "@/components/auth/fields";
import { AuthLayout, authLinkClass } from "@/components/auth/auth-layout";
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
    <AuthLayout
      eyebrow="Your account"
      title="Log in"
      lead="Sign in to manage your listings, enquiries and saved stones."
      photo="/design-preview/luxury/hero-stone-closeup.webp"
      caption="Passwords are hashed and never stored in plain text."
    >
      {resetDone ? <Notice tone="success">Your password has been reset. Log in with your new password.</Notice> : null}

      <LoginForm next={next} initialError={initialError} />

      {code === "email_not_verified" ? (
        <p className="text-center text-sm text-ink-soft">
          <Link href="/check-email" className={authLinkClass}>
            Resend the verification email
          </Link>
        </p>
      ) : null}

      <p className="text-center text-sm text-ink-soft">
        New to Gemstone Selections?{" "}
        <Link href="/register" className="font-medium text-brand underline-offset-4 hover:text-brand-strong hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
