import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PortfolioForm } from "@/components/seller/portfolio-form";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { requireRole } from "@/lib/auth/require-role";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";
import { loadSellerPortfolio } from "@/lib/seller-catalogue/load";

export default function SellerPortfolioPage() {
  return (
    <Suspense fallback={null}>
      <SellerPortfolioView />
    </Suspense>
  );
}

async function SellerPortfolioView() {
  const gate = await gateApprovedSeller();
  if (gate !== "approved") return <AwaitingApprovalPage title="Portfolio" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const seller = await loadSellerPortfolio(user.id);
  if (!seller) notFound();

  return (
    <div className="max-w-4xl space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-4xl text-ink">Portfolio</h1>
          <p className="text-sm text-ink-soft">
            Edit what buyers see on your public page. Only you can see this page.
          </p>
        </div>
        {/* Owner-only preview. The public page is built separately. */}
        <Link href={`/sellers/${seller.slug}`} className="text-sm font-medium text-ink underline underline-offset-4">
          Preview public page
        </Link>
      </header>

      <section aria-labelledby="business-heading" className="space-y-3 border border-line bg-surface-raised p-5">
        <h2 id="business-heading" className="font-heading text-2xl text-ink">
          Business details
        </h2>
        <p className="text-sm text-ink-soft">These details are set during registration. Contact an administrator to change them.</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-soft">Business name</dt>
            <dd className="text-ink">{seller.businessName}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">GST number</dt>
            <dd className="text-ink">{seller.gstNumber ?? "Not provided"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-ink-soft">Address</dt>
            <dd className="text-ink">
              {[seller.addressLine, seller.city, seller.state, seller.pincode, seller.country].filter(Boolean).join(", ")}
            </dd>
          </div>
        </dl>
      </section>

      <PortfolioForm
        tagline={seller.tagline ?? ""}
        description={seller.description ?? ""}
        specialties={seller.specialties}
        hasLogo={Boolean(seller.logoKey)}
        hasBanner={Boolean(seller.bannerKey)}
      />
    </div>
  );
}
