"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/report-client-error";

/**
 * Route-level error boundary. The message and stack are never shown: Next.js strips them in production and
 * only the digest is available. The digest is sent to the server log (and Sentry when configured), and the
 * visitor sees a neutral message.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void reportClientError(error.digest);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-accent">Something went wrong</p>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">We hit a problem loading this page</h1>
      <p className="text-ink-soft">Please try again. If it keeps happening, come back later.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm font-medium">
        <button type="button" onClick={() => reset()} className="rounded-md bg-brand px-4 py-2 text-surface-raised hover:bg-brand-strong">
          Try again
        </button>
        <Link href="/" className="rounded-md border border-line px-4 py-2 text-brand-strong hover:bg-surface">
          Back to home
        </Link>
      </div>
    </section>
  );
}
