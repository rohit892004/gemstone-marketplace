import { moderateContactDetails, type ContactKind } from "@/lib/messaging/moderation";

/**
 * Pure quotation rules. No database or server imports, so the client composer and the tests can use them.
 *
 * Money is stored in minor units (paise, cents). Users type major units ("1,25,000.50"), which
 * parseAmountToMinor turns into minor units with BigInt.
 */

export const QUOTATION_CURRENCIES = ["INR", "USD"] as const;
export type QuotationCurrency = (typeof QUOTATION_CURRENCIES)[number];

export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 10000;
/** 10^12 major units. Keeps amounts inside a sane range. */
export const MAX_AMOUNT_MINOR = BigInt("100000000000000");
export const ITEM_TITLE_MAX = 120;
export const TERMS_MAX = 1000;
export const VALIDITY_MAX_DAYS = 365;

export interface QuotationDraft {
  itemTitle: string;
  quantity: string;
  /** Major units as typed, e.g. "125000" or "125000.50". */
  amount: string;
  currency: string;
  /** YYYY-MM-DD from a date input. The quotation is valid through the end of that day (UTC). */
  validUntil: string;
  terms: string;
}

export interface ValidQuotation {
  itemTitle: string;
  quantity: number;
  amountMinor: bigint;
  currency: QuotationCurrency;
  validUntil: Date;
  terms: string | null;
  /** True when contact details were masked in the item name or terms. */
  flagged: boolean;
  kinds: ContactKind[];
  /** Kinds found in the terms alone. Terms with contact details are refused, not masked. */
  termsKinds: ContactKind[];
}

export type QuotationValidation = { ok: true; value: ValidQuotation } | { ok: false; error: string };

/**
 * "125000" -> 12500000n, "1,25,000.5" -> 12500050n. At most two decimals, no sign, no exponent.
 * Returns null for anything else, including zero.
 */
export function parseAmountToMinor(input: string): bigint | null {
  const cleaned = input.trim().replace(/[,\s]/g, "");
  const match = /^(\d{1,14})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const major = BigInt(match[1]);
  const cents = BigInt((match[2] ?? "").padEnd(2, "0"));
  const minor = major * BigInt(100) + cents;
  return minor > BigInt(0) ? minor : null;
}

/** End of the given YYYY-MM-DD day in UTC. Null when the string is not a real calendar date. */
export function endOfValidityDay(dateText: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText.trim());
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const start = new Date(Date.UTC(y, m - 1, d));
  if (start.getUTCFullYear() !== y || start.getUTCMonth() !== m - 1 || start.getUTCDate() !== d) return null;
  return new Date(Date.UTC(y, m - 1, d + 1) - 1);
}

export function validateQuotation(draft: QuotationDraft, now: Date): QuotationValidation {
  const title = draft.itemTitle.trim();
  if (title.length === 0 || title.length > ITEM_TITLE_MAX) {
    return { ok: false, error: `Enter the item name (up to ${ITEM_TITLE_MAX} characters).` };
  }

  const quantityText = draft.quantity.trim();
  const quantity = /^\d+$/.test(quantityText) ? Number(quantityText) : NaN;
  if (!Number.isInteger(quantity) || quantity < QUANTITY_MIN || quantity > QUANTITY_MAX) {
    return { ok: false, error: `Quantity must be a whole number from ${QUANTITY_MIN} to ${QUANTITY_MAX}.` };
  }

  const amountMinor = parseAmountToMinor(draft.amount);
  if (amountMinor === null) {
    return { ok: false, error: "Enter a price greater than zero, with at most two decimal places." };
  }
  if (amountMinor > MAX_AMOUNT_MINOR) return { ok: false, error: "That price is too large." };

  const currency = draft.currency.trim().toUpperCase();
  if (!(QUOTATION_CURRENCIES as readonly string[]).includes(currency)) {
    return { ok: false, error: "Choose INR or USD." };
  }

  const validUntil = endOfValidityDay(draft.validUntil);
  if (!validUntil) return { ok: false, error: "Choose a valid validity date." };
  if (validUntil.getTime() <= now.getTime()) return { ok: false, error: "The validity date must be in the future." };
  if (validUntil.getTime() > now.getTime() + VALIDITY_MAX_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, error: `Validity can be up to ${VALIDITY_MAX_DAYS} days ahead.` };
  }

  const terms = draft.terms.trim();
  if (terms.length > TERMS_MAX) return { ok: false, error: `Terms can be ${TERMS_MAX} characters or fewer.` };

  const maskedTitle = moderateContactDetails(title);
  const maskedTerms = terms.length > 0 ? moderateContactDetails(terms) : null;
  const kinds = [...new Set([...maskedTitle.kinds, ...(maskedTerms?.kinds ?? [])])];

  return {
    ok: true,
    value: {
      itemTitle: maskedTitle.text,
      quantity,
      amountMinor,
      currency: currency as QuotationCurrency,
      validUntil,
      terms: maskedTerms ? maskedTerms.text : null,
      flagged: kinds.length > 0,
      kinds,
      termsKinds: maskedTerms?.kinds ?? [],
    },
  };
}

/** SENT and past its validity date. Status EXPIRED is also treated as expired. */
export function isQuotationExpired(q: { status: string; validUntil: Date | string | null }, now: Date): boolean {
  if (q.status === "EXPIRED") return true;
  if (q.status !== "SENT" || q.validUntil === null) return false;
  const until = typeof q.validUntil === "string" ? new Date(q.validUntil) : q.validUntil;
  return until.getTime() <= now.getTime();
}

/** The status to show: SENT past its validity date reads as EXPIRED. */
export function effectiveQuotationStatus(
  q: { status: string; validUntil: Date | string | null },
  now: Date,
): string {
  return isQuotationExpired(q, now) ? "EXPIRED" : q.status;
}

export interface ConversationSideInput {
  kind: string;
  startedById: string;
  requirement?: { buyerId: string } | null;
  participants: { userId: string }[];
}

/**
 * Who is the buyer side and who is the seller side of a conversation, from the viewer's point of view.
 * ENQUIRY: the enquirer is the buyer side, the other participant is the listing seller.
 * REQUIREMENT: the requirement's buyer is the buyer side, the responding seller is the seller side.
 * GENERAL conversations have no buyer side, so quotations are not allowed there. Returns null.
 */
export function quotationSides(
  conversation: ConversationSideInput,
  userId: string,
): { buyerId: string; sellerId: string; viewerIsSeller: boolean } | null {
  if (!conversation.participants.some((p) => p.userId === userId)) return null;
  let buyerId: string | null = null;
  if (conversation.kind === "ENQUIRY") buyerId = conversation.startedById;
  else if (conversation.kind === "REQUIREMENT") buyerId = conversation.requirement?.buyerId ?? null;
  if (!buyerId) return null;
  const other = conversation.participants.map((p) => p.userId).find((id) => id !== buyerId);
  if (!other || !conversation.participants.some((p) => p.userId === buyerId)) return null;
  return { buyerId, sellerId: other, viewerIsSeller: userId !== buyerId };
}

/** Readable amount, e.g. "INR 1,25,000.50". Client-safe. */
export function formatMoney(amountMinor: bigint | string | number, currency: string): string {
  const value = BigInt(amountMinor);
  const whole = value / BigInt(100);
  const cents = value % BigInt(100);
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(whole));
  return `${currency} ${grouped}.${cents.toString().padStart(2, "0")}`;
}

export const QUOTATION_STATUS_LABELS: Record<string, string> = {
  SENT: "Awaiting response",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  WITHDRAWN: "Withdrawn",
};
