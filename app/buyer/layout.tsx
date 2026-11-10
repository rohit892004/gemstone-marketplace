import { Suspense, type ReactNode } from "react";
import { BuyerTabs } from "./tabs";

/** Shared shell for /buyer and its sections. Access is checked inside each page, not here. */
export default function BuyerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
        <Suspense fallback={null}>
          <BuyerTabs />
        </Suspense>
        <div className="min-w-0 space-y-10 pt-10 lg:pt-0">
          <header className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-accent-text">Buyer account</p>
            <h1 className="font-heading text-4xl font-medium leading-tight text-ink sm:text-5xl">My gemstones</h1>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
