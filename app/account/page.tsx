import Link from "next/link";
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
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Suspense fallback={null}>
        <AccountContent />
      </Suspense>
    </section>
  );
}

async function AccountContent() {
  const user = await requireBuyerPage();
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Account</h1>
      <p className="mt-2 text-sm text-ink-soft">Signed in as {user.email}</p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {BUYER_TABS.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              className="block rounded-lg border border-line bg-surface-raised p-4 font-medium text-ink hover:border-ink-soft"
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>

      <NewsletterSettings current={await accountNewsletterState(user)} />

      {user.role === "SELLER" ? (
        <p className="mt-8 text-sm text-ink-soft">
          You also have a seller account. <Link href="/seller" className="underline underline-offset-4">Go to seller dashboard</Link>.
        </p>
      ) : null}
    </>
  );
}
