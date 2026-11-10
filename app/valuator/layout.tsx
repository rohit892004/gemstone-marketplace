import Link from "next/link";
import { Suspense, type ReactNode } from "react";
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
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-300 pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-600">Valuer workspace</p>
          <p className="font-semibold">Gemstone valuations</p>
        </div>
        <nav aria-label="Valuer" className="flex flex-wrap gap-3 text-sm">
          <Link href="/valuator/queue" className="underline">
            My queue
          </Link>
          <Link href="/logout" className="underline">
            Sign out
          </Link>
        </nav>
      </header>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
