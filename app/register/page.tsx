import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";

const choiceClass =
  "group block border border-line bg-surface-raised p-6 shadow-soft transition duration-300 ease-[var(--ease-lux)] " +
  "hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-8";

export default function RegisterChooserPage() {
  return (
    <AuthLayout
      eyebrow="Join"
      title="Join Gemstone Selections"
      lead="Choose how you want to use the marketplace."
      photo="/design-preview/luxury/stone-detail-3.webp"
      caption="Stones from sellers who are reviewed before they list."
    >
      <div className="grid gap-4">
        <Link href="/register/buyer" className={choiceClass}>
          <h2 className="font-heading text-2xl text-ink group-hover:text-brand-strong">Buy gemstones</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Browse certified stones, save favourites and enquire directly with sellers.
          </p>
          <span className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-brand">Create a buyer account</span>
        </Link>

        <Link href="/register/seller" className={choiceClass}>
          <h2 className="font-heading text-2xl text-ink group-hover:text-brand-strong">Sell gemstones</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            List your inventory and reach buyers. Sellers are reviewed before they can publish listings.
          </p>
          <span className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-brand">Apply as a seller</span>
        </Link>
      </div>

      <p className="text-center text-sm text-ink-soft">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-brand underline-offset-4 hover:text-brand-strong hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
