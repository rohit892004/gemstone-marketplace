/**
 * Shared client/server payload types for conversation threads. Owned by the lead.
 * BigInt amounts are sent as strings (minor units) so they survive JSON.
 */

export type ViewerRole = "BUYER" | "SELLER";

export interface OfferPayload {
  id: string;
  amountMinor: string;
  currency: string;
  note: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "COUNTERED" | "WITHDRAWN";
  proposerId: string;
  counterOfId: string | null;
  respondedById: string | null;
}

export interface QuotationPayload {
  id: string;
  itemTitle: string;
  quantity: number;
  amountMinor: string;
  currency: string;
  validUntil: string | null;
  terms: string | null;
  status: "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "WITHDRAWN";
  sellerId: string;
  gemstoneId: string | null;
}

/** Everything a thread-level extension needs to know about the current viewer and conversation. */
export interface ThreadContext {
  conversationId: string;
  kind: "ENQUIRY" | "GENERAL" | "REQUIREMENT";
  viewerId: string;
  viewerRole: ViewerRole;
  counterpartId: string | null;
  isDemo: boolean;
  gemstone: { id: string; title: string; slug: string } | null;
  requirement: { id: string; gemstoneType: string; status: "OPEN" | "CLOSED" } | null;
}
