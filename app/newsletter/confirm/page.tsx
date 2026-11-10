import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TokenActionForm } from "@/components/newsletter/token-action-form";
import { CONFIRM_OUTCOME_COPY } from "@/lib/newsletter/messages";
import { pendingConfirmation } from "@/lib/newsletter/service";
import { confirmSubscriptionAction } from "./actions";

export const metadata: Metadata = {
  title: "Confirm your subscription",
  robots: { index: false, follow: false },
};

/**
 * GET never changes state. It reports whether the link can still be used and offers a button.
 * The button posts to the confirmation action.
 */
export default function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={null}>
      <ConfirmView searchParams={searchParams} />
    </Suspense>
  );
}

async function ConfirmView({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const outcome = token ? await pendingConfirmation(token) : "INVALID";

  return (
    <section className="mx-auto max-w-xl space-y-6 px-4 py-16 sm:px-6">
      <h1 className="font-heading text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">Confirm your subscription</h1>
      {token && outcome === "CONFIRMED" ? (
        <>
          <p className="text-ink-soft">Select the button below to confirm your address and start receiving the newsletter.</p>
          <TokenActionForm action={confirmSubscriptionAction} token={token} label="Confirm my subscription" />
        </>
      ) : (
        <p role="status" className={CONFIRM_OUTCOME_COPY[outcome].ok ? "text-ink-soft" : "text-danger"}>
          {CONFIRM_OUTCOME_COPY[outcome].message}
        </p>
      )}
      <p className="text-sm text-ink-soft">
        <Link href="/newsletter" className="underline underline-offset-4 hover:text-ink">
          Newsletter sign-up
        </Link>
      </p>
    </section>
  );
}
