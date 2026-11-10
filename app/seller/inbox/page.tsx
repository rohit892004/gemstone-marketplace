import Link from "next/link";
import { Suspense } from "react";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { requireRole } from "@/lib/auth/require-role";
import { listConversationsForUser, type ConversationListItem } from "@/lib/messaging/service";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Seller inbox: every conversation the seller is in. Two filters work together:
 *  - Buying / Selling: the seller's own enquiries and requirement threads (buying) are kept apart from
 *    the customers who contact their listings (selling).
 *  - Kind: enquiries, requirement responses and general chats.
 */
export default function SellerInboxPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <Inbox searchParams={searchParams} />
    </Suspense>
  );
}

const kindTabs = [
  { value: "all", label: "All" },
  { value: "enquiry", label: "Enquiries" },
  { value: "requirement", label: "Requirements" },
  { value: "general", label: "Chats" },
] as const;

const sideTabs = [
  { value: "all", label: "Everything" },
  { value: "buying", label: "Buying" },
  { value: "selling", label: "Selling" },
] as const;

type KindValue = (typeof kindTabs)[number]["value"];
type SideValue = (typeof sideTabs)[number]["value"];

const kindFor: Record<Exclude<KindValue, "all">, "ENQUIRY" | "REQUIREMENT" | "GENERAL"> = {
  enquiry: "ENQUIRY",
  requirement: "REQUIREMENT",
  general: "GENERAL",
};

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Builds an inbox link that keeps the other filter. "all" values are left out of the URL. */
function inboxHref(kind: KindValue, side: SideValue): string {
  const params = new URLSearchParams();
  if (kind !== "all") params.set("kind", kind);
  if (side !== "all") params.set("side", side);
  const query = params.toString();
  return query ? `/seller/inbox?${query}` : "/seller/inbox";
}

async function Inbox({ searchParams }: { searchParams: SearchParams }) {
  const state = await gateApprovedSeller();
  if (state !== "approved") return <AwaitingApprovalPage title="Inbox" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const params = await searchParams;
  const requestedKind = one(params.kind);
  const kind: KindValue = kindTabs.some((t) => t.value === requestedKind) ? (requestedKind as KindValue) : "all";
  const requestedSide = one(params.side);
  const side: SideValue = sideTabs.some((t) => t.value === requestedSide) ? (requestedSide as SideValue) : "all";
  const q = one(params.q).slice(0, 100);

  const items = await listConversationsForUser(user.id, {
    kind: kind === "all" ? undefined : kindFor[kind],
    side: side === "all" ? undefined : side,
    q: q || undefined,
  });
  const unreadTotal = items.reduce((sum, item) => sum + item.unreadCount, 0);

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-widest text-accent-text">Inbox</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Conversations</h1>
        </div>
        {unreadTotal > 0 && (
          <p className="rounded-full bg-brand px-3 py-1 text-sm font-medium text-white">{unreadTotal} unread</p>
        )}
      </div>

      <form method="get" className="flex flex-col gap-3 sm:flex-row">
        {kind !== "all" && <input type="hidden" name="kind" value={kind} />}
        {side !== "all" && <input type="hidden" name="side" value={side} />}
        <label className="sr-only" htmlFor="inbox-q">Search conversations</label>
        <input
          id="inbox-q"
          name="q"
          defaultValue={q}
          placeholder="Search by buyer, business or gemstone"
          className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
        />
        <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-surface">
          Search
        </button>
      </form>

      <div className="space-y-3">
        <FilterRow label="Side" tabs={sideTabs} active={side} hrefFor={(value) => inboxHref(kind, value)} />
        <FilterRow label="Type" tabs={kindTabs} active={kind} hrefFor={(value) => inboxHref(value, side)} />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
          <h2 className="text-lg font-semibold text-ink">No conversations here yet</h2>
          <p className="mt-2 text-sm text-ink-soft">
            {side === "buying"
              ? "Enquiries you make on other sellers' listings, requirements you post and responses to them appear here."
              : "Buyers who enquire about your listings, and sellers you contact, appear here. Requirement responses also start here."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
          {items.map((item) => (
            <li key={item.id}>
              <InboxRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterRow<T extends string>({
  label,
  tabs,
  active,
  hrefFor,
}: {
  label: string;
  tabs: readonly { value: T; label: string }[];
  active: T;
  hrefFor: (value: T) => string;
}) {
  return (
    <nav aria-label={`Filter by ${label.toLowerCase()}`} className="flex flex-wrap items-center gap-2">
      <span className="w-12 text-xs uppercase tracking-widest text-ink-soft">{label}</span>
      <ul className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <li key={t.value}>
            <Link
              href={hrefFor(t.value)}
              aria-current={active === t.value ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${
                active === t.value ? "border-brand bg-brand text-white" : "border-line text-ink-soft"
              }`}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const kindLabels: Record<ConversationListItem["kind"], string> = {
  ENQUIRY: "Enquiry",
  REQUIREMENT: "Requirement",
  GENERAL: "Chat",
};

function InboxRow({ item }: { item: ConversationListItem }) {
  const title = item.counterpart.businessName ?? item.counterpart.name ?? "Member";
  const subject = item.gemstone?.title ?? (item.requirement ? `Requirement: ${item.requirement.gemstoneType}` : null);
  return (
    <Link href={`/conversations/${item.id}`} className="flex items-start justify-between gap-4 px-4 py-4 hover:bg-surface">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-accent-text">
          <span>{kindLabels[item.kind]}</span>
          <span className="text-ink-soft">{item.side === "BUYING" ? "Buying" : "Selling"}</span>
          {item.isDemo && <span className="rounded bg-accent-soft px-1.5 py-0.5 normal-case tracking-normal text-ink">Demo</span>}
        </p>
        <p className="mt-1 flex items-center gap-2 font-medium text-ink">
          <span className="truncate">{title}</span>
          {item.blocked && <span className="text-xs font-normal text-ink-soft">Blocked</span>}
        </p>
        {subject && <p className="truncate text-sm text-ink-soft">{subject}</p>}
        {item.lastMessage && <p className="mt-1 truncate text-sm text-ink-soft">{item.lastMessage.body}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-ink-soft">
        <span>{item.lastMessageAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
        {item.unreadCount > 0 && (
          <span className="rounded-full bg-brand px-2 py-0.5 font-medium text-white">{item.unreadCount} new</span>
        )}
      </div>
    </Link>
  );
}
