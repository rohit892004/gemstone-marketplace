import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheck, BarChart3, Boxes, ClipboardList, FileText, Gem, HandCoins, Inbox, Crown, Images, ArrowRight, type LucideIcon } from "lucide-react";
import { StatusCard } from "@/components/seller/status-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";

export default function SellerHomePage() {
  return (
    <Suspense fallback={null}>
      <SellerHome />
    </Suspense>
  );
}

const workspace: { href: string; label: string; note: string; icon: LucideIcon }[] = [
  { href: "/seller/listings", label: "Listings", note: "Publish and edit the stones you offer.", icon: Gem },
  { href: "/seller/inbox", label: "Inbox", note: "Enquiries and conversations with buyers.", icon: Inbox },
  { href: "/seller/quotations", label: "Quotations", note: "Quotes you have sent and their status.", icon: FileText },
  { href: "/seller/offers", label: "Offers", note: "Offers made on your listings.", icon: HandCoins },
  { href: "/seller/requirements", label: "Requirements", note: "Buyer requests you can respond to.", icon: ClipboardList },
  { href: "/seller/inventory", label: "Inventory", note: "Stock levels and quantities.", icon: Boxes },
  { href: "/seller/portfolio", label: "Portfolio", note: "Your business profile and gallery.", icon: Images },
  { href: "/seller/valuations", label: "Valuations", note: "Valuation requests for your stones.", icon: BadgeCheck },
  { href: "/seller/analytics", label: "Analytics", note: "How your listings are performing.", icon: BarChart3 },
  { href: "/seller/membership", label: "Membership", note: "Your plan, limits and benefits.", icon: Crown },
];

async function SellerHome() {
  const user = await requirePageRole(["SELLER"]);
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { businessName: true, approvalStatus: true, rejectionReason: true },
  });

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="font-heading text-4xl text-ink">Seller account</h1>
        <StatusCard title="Seller profile not found">
          <p>We could not find a seller profile for this account. Contact support and we will help you.</p>
        </StatusCard>
      </div>
    );
  }

  if (profile.approvalStatus === "APPROVED") {
    return (
      <div className="space-y-12">
        <PageHeader
          eyebrow="Seller dashboard"
          title={profile.businessName}
          lead="Your listings, enquiries and offers in one place. Choose an area to continue."
          actions={<Badge tone="success">Approved</Badge>}
        />
        <section aria-labelledby="workspace-heading" className="space-y-6">
          <h2 id="workspace-heading" className="text-[11px] uppercase tracking-[0.25em] text-accent-text">
            Your workspace
          </h2>
          <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
            {workspace.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href} className="bg-surface-raised">
                  <Link
                    href={item.href}
                    className="group flex min-h-[7.5rem] items-start gap-4 p-6 transition duration-300 hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center border border-line text-accent" aria-hidden>
                      <Icon className="h-5 w-5" strokeWidth={1.25} />
                    </span>
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-heading text-2xl text-ink">{item.label}</span>
                        <ArrowRight className="h-4 w-4 text-ink-soft transition duration-300 group-hover:translate-x-1 group-hover:text-accent" strokeWidth={1.25} aria-hidden />
                      </span>
                      <span className="block text-[14px] leading-relaxed text-ink-soft">{item.note}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="text-[15px] text-ink-soft">Ready to show a new stone? Add it to your listings and it goes to review.</p>
          <Link href="/seller/listings/new" className="text-sm font-medium text-ink underline underline-offset-4 hover:text-accent-text">
            Add a listing
          </Link>
        </Card>
      </div>
    );
  }

  if (profile.approvalStatus === "REJECTED") {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="font-heading text-4xl text-ink">Application not approved</h1>
        <StatusCard title="Reason" tone="warn">
          <p className="whitespace-pre-line text-ink">{profile.rejectionReason ?? "No reason was recorded. Contact support for details."}</p>
          <p>If you believe this is a mistake, contact support and quote your business name.</p>
        </StatusCard>
      </div>
    );
  }

  // PENDING. SUSPENDED is redirected to login by requirePageRole before this point.
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="font-heading text-4xl text-ink">Application under review</h1>
      <StatusCard title="Status: pending review">
        <p>We are reviewing your documents. This usually takes 2 business days.</p>
        <p>We will email you when a decision is made. You do not need to resubmit anything.</p>
      </StatusCard>
    </div>
  );
}
