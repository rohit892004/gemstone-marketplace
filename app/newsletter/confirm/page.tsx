import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TokenActionForm } from "@/components/newsletter/token-action-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
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
  const canConfirm = Boolean(token) && outcome === "CONFIRMED";

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:py-20">
      <PageHeader
        eyebrow="Newsletter"
        title="Confirm your subscription"
        lead={canConfirm ? "Select the button below to confirm your address and start receiving the newsletter." : undefined}
      />
      <Card className="space-y-6 p-6 sm:p-8">
        {token && canConfirm ? (
          <TokenActionForm action={confirmSubscriptionAction} token={token} label="Confirm my subscription" />
        ) : (
          <p role="status" className={CONFIRM_OUTCOME_COPY[outcome].ok ? "text-ink-soft" : "text-danger"}>
            {CONFIRM_OUTCOME_COPY[outcome].message}
          </p>
        )}
      </Card>
      <p className="mt-8 text-sm text-ink-soft">
        <Link href="/newsletter" className="underline underline-offset-4 hover:text-ink">
          Newsletter sign-up
        </Link>
      </p>
    </section>
  );
}
