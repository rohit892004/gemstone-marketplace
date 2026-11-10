import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Photo } from "@/components/ui/photo";
import { SellerRegisterForm } from "@/components/seller/seller-register-form";
import { normaliseReferralCode } from "@/lib/membership/attribution";
import { loadSellerCategories } from "@/lib/seller/categories";
import { loadActiveCertificateLabs } from "@/lib/seller/labs";

export const metadata: Metadata = {
  title: "Become a seller",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const BENEFITS = [
  { title: "List your inventory", body: "Publish stones with photographs, specifications and certificates." },
  { title: "Reach buyers directly", body: "Buyers enquire, request quotations and save the stones they like." },
  { title: "Reviewed before you go live", body: "Our team checks your documents before your listings are published." },
] as const;

/** Form sections, in the order they appear in the application. Shown as a thin numbered summary. */
const SECTIONS = ["Account", "Business", "Documents"] as const;

export default function SellerRegisterPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <section className="bg-night text-ivory">
        <div className="mx-auto grid max-w-6xl items-end gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-champagne">Sellers</p>
            <h1 className="mt-4 font-heading text-4xl font-medium leading-[1.1] sm:text-5xl">Apply to sell on Gemstone Selections</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ivory/75">
              Create your account and business profile. Our team reviews your documents before your listings go live.
              Already registered?{" "}
              <Link href="/login" className="font-medium text-ivory underline underline-offset-4 hover:text-champagne">
                Sign in
              </Link>
              .
            </p>

            <ul className="mt-10 grid gap-8 border-t border-ivory/20 pt-8 sm:grid-cols-3">
              {BENEFITS.map((benefit, index) => (
                <li key={benefit.title} className="space-y-2">
                  <span className="block font-heading text-sm tabular-nums text-champagne">{String(index + 1).padStart(2, "0")}</span>
                  <h2 className="font-heading text-xl text-ivory">{benefit.title}</h2>
                  <p className="text-sm leading-relaxed text-ivory/70">{benefit.body}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden lg:block">
            <Photo src="/design-preview/luxury/seller-banner-1.webp" alt="" ratio="aspect-[4/3]" className="w-full" zoomOnHover={false} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-16">
        <Card className="min-w-0 p-6 sm:p-10">
          <Suspense fallback={null}>
            <SellerRegisterFormLoader searchParams={searchParams} />
          </Suspense>
        </Card>

        <aside aria-labelledby="application-sections" className="lg:sticky lg:top-28 lg:self-start">
          <p id="application-sections" className="text-[11px] uppercase tracking-[0.28em] text-accent-text">
            Application
          </p>
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {SECTIONS.map((section, index) => (
              <li key={section} className="flex items-baseline gap-4 py-4">
                <span className="font-heading text-sm tabular-nums text-accent-text">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-sm text-ink">{section}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm leading-relaxed text-ink-soft">
            Sellers are reviewed before they can publish listings. Identity and business documents are stored privately.
          </p>
        </aside>
      </div>
    </>
  );
}

async function SellerRegisterFormLoader({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).ref;
  const referralCode = normaliseReferralCode(Array.isArray(raw) ? raw[0] : raw) ?? undefined;
  const [labs, categories] = await Promise.all([loadActiveCertificateLabs(), loadSellerCategories()]);
  return <SellerRegisterForm labs={labs} categories={categories} referralCode={referralCode} />;
}
