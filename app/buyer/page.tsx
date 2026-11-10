import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BadgeCheck, BarChart3, ClipboardList, Heart, MessagesSquare, Send, type LucideIcon } from "lucide-react";
import { StatTile } from "@/components/ui/card";
import { prisma } from "@/lib/db/client";
import { requireBuyerPage } from "./guard";

export default function BuyerDashboardPage() {
  return (
    <Suspense fallback={null}>
      <BuyerOverview />
    </Suspense>
  );
}

const areas: { href: string; label: string; note: string; icon: LucideIcon }[] = [
  { href: "/buyer/wishlist", label: "Wishlist", note: "Stones you are watching.", icon: Heart },
  { href: "/buyer/enquiries", label: "Enquiries", note: "Questions you have asked sellers.", icon: Send },
  { href: "/buyer/conversations", label: "Conversations", note: "Messages with sellers.", icon: MessagesSquare },
  { href: "/buyer/requirements", label: "Requirements", note: "Stones you have asked sellers to find.", icon: ClipboardList },
  { href: "/buyer/valuations", label: "Valuations", note: "Valuation requests and results.", icon: BadgeCheck },
  { href: "/buyer/reports", label: "Saved reports", note: "Completed valuation reports and PDFs.", icon: BarChart3 },
];

async function BuyerOverview() {
  const user = await requireBuyerPage();
  const wishlistCount = await prisma.wishlistItem.count({ where: { buyerId: user.id } });

  return (
    <div className="space-y-12">
      <p className="max-w-2xl text-base leading-relaxed text-ink-soft">
        Welcome{user.name ? `, ${user.name}` : ""}. Signed in as {user.email}.
      </p>

      <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
        <StatTile label="Saved stones" value={wishlistCount} note={wishlistCount === 1 ? "1 stone in your wishlist" : `${wishlistCount} stones in your wishlist`} />
      </div>

      <section aria-labelledby="areas-heading" className="space-y-6">
        <h2 id="areas-heading" className="text-[11px] uppercase tracking-[0.25em] text-accent-text">
          Your activity
        </h2>
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2">
          {areas.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href} className="bg-surface-raised">
                <Link
                  href={item.href}
                  className="group flex min-h-[6.5rem] items-start gap-4 p-6 transition duration-300 hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center border border-line text-accent" aria-hidden>
                    <Icon className="h-5 w-5" strokeWidth={1.25} />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
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
    </div>
  );
}
