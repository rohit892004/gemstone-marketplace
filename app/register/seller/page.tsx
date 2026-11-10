import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SellerRegisterForm } from "@/components/seller/seller-register-form";
import { normaliseReferralCode } from "@/lib/membership/attribution";
import { loadSellerCategories } from "@/lib/seller/categories";
import { loadActiveCertificateLabs } from "@/lib/seller/labs";

export const metadata: Metadata = {
  title: "Become a seller",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function SellerRegisterPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-accent-text">Sellers</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Apply to sell on Gemstone Selections</h1>
      <p className="mt-4 text-ink-soft">
        Create your account and business profile. Our team reviews your documents before your listings go live.
        Already registered? <Link href="/login" className="font-medium text-brand underline">Sign in</Link>.
      </p>
      <div className="mt-10">
        <Suspense fallback={null}>
          <SellerRegisterFormLoader searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
}

async function SellerRegisterFormLoader({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).ref;
  const referralCode = normaliseReferralCode(Array.isArray(raw) ? raw[0] : raw) ?? undefined;
  const [labs, categories] = await Promise.all([loadActiveCertificateLabs(), loadSellerCategories()]);
  return <SellerRegisterForm labs={labs} categories={categories} referralCode={referralCode} />;
}
