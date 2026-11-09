import { OfferComposer } from "./offer-composer";
import type { ThreadContext } from "./types";

/**
 * Extra composer controls above the text box: the buyer's offer composer, the seller's quotation
 * composer. OWNERS: buyer agent (offer composer, buyer branch) and seller agent (quotation composer,
 * seller branch). Keep edits to one import and one conditional line each, to merge cleanly.
 */
export function ComposerExtras({ context }: { context: ThreadContext }) {
  if (context.viewerRole === "BUYER" && context.kind === "ENQUIRY" && !context.requirement) {
    return <OfferComposer conversationId={context.conversationId} />;
  }
  return null;
}
