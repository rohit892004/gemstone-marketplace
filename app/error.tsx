"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
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
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-28 text-center sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.28em] text-accent-text">Something went wrong</p>
      <h1 className="font-heading text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">We hit a problem loading this page</h1>
      <p className="max-w-prose text-[15px] leading-relaxed text-ink-soft">Please try again. If it keeps happening, come back later.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-4">
        <Button onClick={() => reset()} size="lg">
          Try again
        </Button>
        <Link
          href="/"
          className={buttonClasses({ variant: "secondary", size: "lg" })}
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}
