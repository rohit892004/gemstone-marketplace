import Link from "next/link";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-sm font-medium uppercase tracking-widest text-accent">Gemstone marketplace</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        Discover, compare and value gemstones from verified sellers.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-soft">
        Browse listings by category, speak directly with sellers on the platform, and request an
        indicative valuation for your stone.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/gemstones" className="rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand-strong">
          Browse gemstones
        </Link>
        <Link href="/valuation" className="rounded-md border border-line bg-surface-raised px-5 py-3 text-sm font-medium text-ink hover:border-ink-soft">
          Get a valuation
        </Link>
      </div>
    </section>
  );
}
