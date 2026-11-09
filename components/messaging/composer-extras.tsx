import { OfferComposer } from "./offer-composer";
import { QuotationComposer } from "./quotation-composer";
import type { ThreadContext } from "./types";

/**
 * Extra composer controls above the text box: the buyer's offer composer (listing enquiries)
 * and the seller's quotation composer. Both hide themselves when they do not apply.
 */
export function ComposerExtras({ context }: { context: ThreadContext }) {
  if (context.viewerRole === "BUYER" && context.kind === "ENQUIRY" && !context.requirement) {
    return <OfferComposer conversationId={context.conversationId} />;
  }
  if (context.viewerRole === "SELLER" && context.canQuote) {
    return <QuotationComposer context={context} />;
  }
  return null;
}
