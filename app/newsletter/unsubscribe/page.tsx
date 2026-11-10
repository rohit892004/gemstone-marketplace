import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TokenActionForm } from "@/components/newsletter/token-action-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { INVALID_PREFERENCES_LINK } from "@/lib/newsletter/messages";
import { subscriberForManageToken } from "@/lib/newsletter/service";
import { unsubscribeAction } from "./actions";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Stop receiving the Gemstone Selections newsletter.",
  robots: { index: false, follow: false },
};

/** GET shows a button. The unsubscribe happens on POST, so link scanners cannot unsubscribe people. */
export default function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={null}>
      <UnsubscribeView searchParams={searchParams} />
    </Suspense>
  );
}

async function UnsubscribeView({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const subscriber = token ? await subscriberForManageToken(token) : null;
  const canUnsubscribe = Boolean(token && subscriber && subscriber.status !== "UNSUBSCRIBED");

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:py-20">
      <PageHeader
        eyebrow="Newsletter"
        title="Unsubscribe"
        lead={
          canUnsubscribe
            ? "Select the button below to stop receiving the Gemstone Selections newsletter. You can sign up again at any time."
            : undefined
        }
      />
      <Card className="space-y-6 p-6 sm:p-8">
        {!token || !subscriber ? (
          <p role="status" className="text-ink-soft">{INVALID_PREFERENCES_LINK}</p>
        ) : subscriber.status === "UNSUBSCRIBED" ? (
          <p className="text-ink-soft">You are already unsubscribed from the Gemstone Selections newsletter.</p>
        ) : (
          <TokenActionForm action={unsubscribeAction} token={token} label="Unsubscribe from the newsletter" tone="danger" />
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
