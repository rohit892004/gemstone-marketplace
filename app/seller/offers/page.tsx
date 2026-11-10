import Link from "next/link";
import { HandCoins } from "lucide-react";
import { Badge, DemoTag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Suspense } from "react";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { requireRole } from "@/lib/auth/require-role";
import { listOffersForUser } from "@/lib/offers/respond";
import { formatMoney } from "@/lib/quotations/validate";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

export default function SellerOffersPage() {
  return (
    <Suspense fallback={null}>
      <SellerOffers />
    </Suspense>
  );
}

const statusLabels: Record<string, string> = {
  PENDING: "Awaiting response",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  COUNTERED: "Countered",
  WITHDRAWN: "Withdrawn",
};

async function SellerOffers() {
  const state = await gateApprovedSeller();
  if (state !== "approved") return <AwaitingApprovalPage title="Offers" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const offers = await listOffersForUser(user.id);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-accent-text">Offers</p>
        <h1 className="mt-2 font-heading text-4xl text-ink">Offers and counter offers</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Offers are answered inside their conversation. Offers waiting for you are listed first.
        </p>
      </div>

      {offers.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No offers yet"
          body="When a buyer makes an offer on one of your listings, it appears here."
          action={
            <ButtonLink href="/seller/listings" variant="secondary">
              Review your listings
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-line border border-line bg-surface-raised">
          {[...offers]
            .sort((a, b) => Number(needsResponse(b, user.id)) - Number(needsResponse(a, user.id)))
            .map((offer) => {
              const other = offer.conversation.participants.find((p) => p.userId !== user.id)?.user;
              const counterpart = other?.sellerProfile?.businessName ?? other?.name ?? "Member";
              const waiting = needsResponse(offer, user.id);
              return (
                <li key={offer.id} className="space-y-3 px-4 py-5 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-heading text-xl text-ink">
                        {formatMoney(offer.amountMinor, offer.currency)}
                        {offer.counterOfId && <span className="ml-2 font-sans text-sm text-ink-soft">counter</span>}
                        {offer.conversation.isDemo && (
                          <DemoTag />
                        )}
                      </p>
                      <p className="text-sm text-ink-soft">
                        {counterpart}
                        {offer.conversation.gemstone ? ` · ${offer.conversation.gemstone.title}` : ""}
                      </p>
                    </div>
                    <Badge tone={waiting ? "warning" : offer.status === "ACCEPTED" ? "success" : "neutral"}>
                      {waiting ? "Needs your response" : statusLabels[offer.status] ?? offer.status}
                    </Badge>
                  </div>
                  {offer.note && <p className="whitespace-pre-wrap break-words text-sm text-ink-soft">{offer.note}</p>}
                  <p className="text-xs text-ink-soft">
                    {offer.proposerId === user.id ? "Sent by you" : "Received"} ·{" "}
                    {offer.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </p>
                  <Link href={`/conversations/${offer.conversationId}`} className="text-sm font-medium text-ink underline underline-offset-4">
                    Open conversation
                  </Link>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}

function needsResponse(offer: { status: string; proposerId: string }, userId: string): boolean {
  return offer.status === "PENDING" && offer.proposerId !== userId;
}
