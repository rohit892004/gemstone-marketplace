import { OfferCard } from "./offer-card";
import { QuotationCard } from "./quotation-card";
import type { OfferPayload, QuotationPayload, ThreadContext } from "./types";

/**
 * Extra UI under a message bubble: offer cards and quotation cards.
 * OWNER: seller agent (M3 Phase B). Accept, decline and counter show for the non-proposer. Withdraw shows
 * for the seller who sent a quotation. Both cards are client components that call the server actions.
 */
export function MessageExtras({
  message,
  context,
}: {
  message: { id: string; offer: OfferPayload | null; quotation: QuotationPayload | null };
  context: ThreadContext;
}) {
  return (
    <>
      {message.offer && <OfferCard offer={message.offer} context={context} />}
      {message.quotation && <QuotationCard quotation={message.quotation} context={context} />}
    </>
  );
}
