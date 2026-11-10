import Link from "next/link";

export default function RegisterChooserPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-heading text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">Join Gemstone Selections</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">Choose how you want to use the marketplace.</p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Link
          href="/register/buyer"
          className="group border border-line bg-surface-raised p-6 shadow-soft hover:border-brand"
        >
          <h2 className="font-heading text-2xl text-ink group-hover:text-brand-strong">Buy gemstones</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Browse certified stones, save favourites and enquire directly with sellers.
          </p>
          <span className="mt-6 inline-block text-sm font-medium text-brand">Create a buyer account</span>
        </Link>

        <Link
          href="/register/seller"
          className="group border border-line bg-surface-raised p-6 shadow-soft hover:border-brand"
        >
          <h2 className="font-heading text-2xl text-ink group-hover:text-brand-strong">Sell gemstones</h2>
          <p className="mt-2 text-sm text-ink-soft">
            List your inventory and reach buyers. Sellers are reviewed before they can publish listings.
          </p>
          <span className="mt-6 inline-block text-sm font-medium text-brand">Apply as a seller</span>
        </Link>
      </div>

      <p className="mt-10 text-sm text-ink-soft">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-brand hover:text-brand-strong">
          Log in
        </Link>
      </p>
    </section>
  );
}
