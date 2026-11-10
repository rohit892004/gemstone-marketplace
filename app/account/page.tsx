import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Suspense } from "react";
import { requireBuyerPage } from "@/app/buyer/guard";
import { BUYER_TABS } from "@/app/buyer/tab-list";
import { NewsletterSettings } from "@/components/newsletter/newsletter-settings";
import { accountNewsletterState } from "@/lib/newsletter/account";

/**
 * Account home for buyer features. Sellers reach the same buyer tabs from here, since they can
 * use buyer features too. Seller tooling lives under /seller and is not duplicated here.
 */
export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <Suspense fallback={null}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

async function AccountContent() {
  const user = await requireBuyerPage();
  return (
    <div className="space-y-12">
      <PageHeader eyebrow="Your account" title="Account" lead={`Signed in as ${user.email}`} />

      <section aria-labelledby="sections-heading" className="space-y-6">
        <h2 id="sections-heading" className="text-[11px] uppercase tracking-[0.25em] text-accent-text">
          Your gemstones
        </h2>
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2">
          {BUYER_TABS.map((tab) => (
            <li key={tab.href} className="bg-surface-raised">
              <Link
                href={tab.href}
                className="group flex min-h-14 items-center justify-between gap-4 p-5 transition duration-300 hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              >
                <span className="font-heading text-2xl text-ink">{tab.label}</span>
                <ArrowRight className="h-4 w-4 text-ink-soft transition duration-300 group-hover:translate-x-1 group-hover:text-accent" strokeWidth={1.25} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <NewsletterSettings current={await accountNewsletterState(user)} />

      {user.role === "SELLER" ? (
        <p className="text-sm text-ink-soft">
          You also have a seller account.{" "}
          <Link href="/seller" className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:text-accent-text">
            Go to seller dashboard
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
