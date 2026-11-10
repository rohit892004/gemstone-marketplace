import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { logout } from "@/app/logout/actions";
import { requirePageRole } from "@/lib/auth/require-role";

/** Valuator pages are internal staff pages and are never indexed. */
export const metadata = { robots: { index: false, follow: false } };

/**
 * Valuator shell. The session check lives in an async child inside <Suspense> (Cache Components pattern).
 * Only VALUATOR accounts get past requirePageRole; admins and buyers are sent elsewhere.
 */
export default function ValuatorLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ValuatorShell>{children}</ValuatorShell>
    </Suspense>
  );
}

async function ValuatorShell({ children }: { children: ReactNode }) {
  await requirePageRole(["VALUATOR"]);
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent-text">Valuer workspace</p>
          <p className="font-heading text-2xl text-ink">Gemstone valuations</p>
        </div>
        <nav aria-label="Valuer" className="flex flex-wrap items-center gap-6 text-sm">
          <Link href="/valuator/queue" className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:text-accent-text">
            My queue
          </Link>
          {/* /logout is a server action, not a page: a form posts to it (a plain link would 404). */}
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
