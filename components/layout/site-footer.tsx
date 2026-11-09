import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface-raised">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-semibold text-brand-strong">Gemstone Selections</p>
          <p className="mt-2 text-sm text-ink-soft">
            Indicative valuations and marketplace listings. Not a certified appraisal.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          <Link href="/register/seller" className="text-ink-soft hover:text-ink">Become a Seller</Link>
          <Link href="/about" className="text-ink-soft hover:text-ink">About</Link>
          <Link href="/contact" className="text-ink-soft hover:text-ink">Contact</Link>
          <Link href="/privacy" className="text-ink-soft hover:text-ink">Privacy</Link>
          <Link href="/terms" className="text-ink-soft hover:text-ink">Terms</Link>
        </nav>
        <p className="text-sm text-ink-soft">Gemstone Selections. All rights reserved.</p>
      </div>
    </footer>
  );
}
