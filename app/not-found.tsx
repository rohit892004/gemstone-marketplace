import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-accent">Error 404</p>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">We could not find that page</h1>
      <p className="text-ink-soft">The link may be out of date, or the page may have moved. Try one of these instead.</p>
      <nav aria-label="Helpful links" className="mt-2 flex flex-wrap justify-center gap-4 text-sm font-medium text-brand-strong">
        <Link href="/" className="underline">Home</Link>
        <Link href="/gemstones" className="underline">Gemstones</Link>
        <Link href="/valuation" className="underline">Valuation</Link>
        <Link href="/learn" className="underline">Learn</Link>
      </nav>
    </section>
  );
}
