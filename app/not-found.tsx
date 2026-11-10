import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

const navLink =
  "inline-flex min-h-11 items-center underline underline-offset-4 hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-28 text-center sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.28em] text-accent-text">Error 404</p>
      <h1 className="font-heading text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">We could not find that page</h1>
      <p className="max-w-prose text-[15px] leading-relaxed text-ink-soft">
        The link may be out of date, or the page may have moved. Try one of these instead.
      </p>
      <ButtonLink href="/gemstones" variant="primary" size="lg" className="mt-2">
        Browse gemstones
      </ButtonLink>
      <nav aria-label="Helpful links" className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14px] text-ink">
        <Link href="/" className={navLink}>
          Home
        </Link>
        <Link href="/gemstones" className={navLink}>
          Gemstones
        </Link>
        <Link href="/valuation" className={navLink}>
          Valuation
        </Link>
        <Link href="/education" className={navLink}>
          Learn
        </Link>
      </nav>
    </section>
  );
}
