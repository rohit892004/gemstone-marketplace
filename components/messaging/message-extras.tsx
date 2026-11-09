import type { OfferPayload, QuotationPayload, ThreadContext } from "./types";

/**
 * Extra UI under a message bubble: offer cards and quotation cards.
 * OWNER: seller agent (M3 Phase B). Stub until then.
 */
export function MessageExtras(_props: {
  message: { id: string; offer: OfferPayload | null; quotation: QuotationPayload | null };
  context: ThreadContext;
}) {
  return null;
}
