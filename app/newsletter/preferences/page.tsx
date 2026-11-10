import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { INVALID_PREFERENCES_LINK } from "@/lib/newsletter/messages";
import { subscriberForManageToken } from "@/lib/newsletter/service";
import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = {
  title: "Newsletter preferences",
  description: "Change the topics you receive from Gemstone Selections.",
  robots: { index: false, follow: false },
};

/** Reached from the newsletter email. Works without a login: the signed token identifies the subscriber. */
export default function PreferencesPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={null}>
      <PreferencesView searchParams={searchParams} />
    </Suspense>
  );
}

async function PreferencesView({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const subscriber = token ? await subscriberForManageToken(token) : null;

  return (
    <section className="mx-auto max-w-2xl space-y-6 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Newsletter preferences</h1>
      {!token || !subscriber ? (
        <p role="status" className="text-ink-soft">{INVALID_PREFERENCES_LINK}</p>
      ) : subscriber.status !== "CONFIRMED" ? (
        <p className="text-ink-soft">
          You are not receiving the newsletter at the moment.{" "}
          <Link href="/newsletter" className="underline underline-offset-4 hover:text-ink">Sign up again</Link> to restart it.
        </p>
      ) : (
        <PreferencesForm token={token} topics={subscriber.topics} />
      )}
    </section>
  );
}
