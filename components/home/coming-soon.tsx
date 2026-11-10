import Link from "next/link";

/** Placeholder page for areas arriving in later milestones. Static, so it prerenders. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-20 text-center sm:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-accent-text">Coming soon</p>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="text-ink-soft">{description}</p>
      <div>
        <Link href="/" className="text-sm font-medium text-brand-strong underline">
          Back to home
        </Link>
      </div>
    </section>
  );
}
