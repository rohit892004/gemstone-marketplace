import { Suspense, type ReactNode } from "react";
import { BuyerTabs } from "./tabs";

/** Shared shell for /buyer and its tabs. Access is checked inside each page, not here. */
export default function BuyerLayout({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-accent-text">Buyer account</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">My gemstones</h1>
      <Suspense fallback={null}>
        <BuyerTabs />
      </Suspense>
      <div className="mt-8">{children}</div>
    </section>
  );
}
