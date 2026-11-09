import Link from "next/link";
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
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-accent">Offers</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Offers and counter offers</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Offers are answered inside their conversation. Offers waiting for you are listed first.
        </p>
      </div>

      {offers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
          <h2 className="text-lg font-semibold text-ink">No offers yet</h2>
          <p className="mt-2 text-sm text-ink-soft">When a buyer makes an offer on one of your listings, it appears here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
          {[...offers]
            .sort((a, b) => Number(needsResponse(b, user.id)) - Number(needsResponse(a, user.id)))
            .map((offer) => {
              const other = offer.conversation.participants.find((p) => p.userId !== user.id)?.user;
              const counterpart = other?.sellerProfile?.businessName ?? other?.name ?? "Member";
              const waiting = needsResponse(offer, user.id);
              return (
                <li key={offer.id} className="space-y-2 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {formatMoney(offer.amountMinor, offer.currency)}
                        {offer.counterOfId && <span className="ml-2 text-sm font-normal text-ink-soft">counter</span>}
                        {offer.conversation.isDemo && (
                          <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-normal text-ink">Demo</span>
                        )}
                      </p>
                      <p className="text-sm text-ink-soft">
                        {counterpart}
                        {offer.conversation.gemstone ? ` · ${offer.conversation.gemstone.title}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs ${
                        waiting ? "bg-brand text-white" : "border border-line text-ink-soft"
                      }`}
                    >
                      {waiting ? "Needs your response" : statusLabels[offer.status] ?? offer.status}
                    </span>
                  </div>
                  {offer.note && <p className="whitespace-pre-wrap break-words text-sm text-ink-soft">{offer.note}</p>}
                  <p className="text-xs text-ink-soft">
                    {offer.proposerId === user.id ? "Sent by you" : "Received"} ·{" "}
                    {offer.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </p>
                  <Link href={`/conversations/${offer.conversationId}`} className="text-sm font-medium text-brand underline">
                    Open conversation
                  </Link>
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}

function needsResponse(offer: { status: string; proposerId: string }, userId: string): boolean {
  return offer.status === "PENDING" && offer.proposerId !== userId;
}
