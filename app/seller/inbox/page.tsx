import Link from "next/link";
import { Suspense } from "react";
import { Inbox as InboxIcon } from "lucide-react";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { Badge, DemoTag } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inbox"
        title="Conversations"
        lead="Enquiries, requirement responses and chats with buyers and sellers in one place."
        actions={unreadTotal > 0 ? <Badge tone="accent">{unreadTotal} unread</Badge> : null}
      />

      <form method="get" className="flex flex-col gap-3 sm:flex-row">
        {kind !== "all" && <input type="hidden" name="kind" value={kind} />}
        {side !== "all" && <input type="hidden" name="side" value={side} />}
        <label className="sr-only" htmlFor="inbox-q">Search conversations</label>
        <Input
          id="inbox-q"
          name="q"
          defaultValue={q}
          placeholder="Search by buyer, business or gemstone"
          className="sm:flex-1"
        />
        <Button type="submit" variant="secondary" className="min-h-11">
          Search
        </Button>
      </form>

      <div className="space-y-4">
        <FilterRow label="Side" tabs={sideTabs} active={side} hrefFor={(value) => inboxHref(kind, value)} />
        <FilterRow label="Type" tabs={kindTabs} active={kind} hrefFor={(value) => inboxHref(value, side)} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="No conversations here yet"
          body={
            side === "buying"
              ? "Enquiries you make on other sellers' listings, requirements you post and responses to them appear here."
              : "Buyers who enquire about your listings, and sellers you contact, appear here. Requirement responses also start here."
          }
          action={
            <ButtonLink href="/seller/listings" variant="secondary">
              Review your listings
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-line border border-line bg-surface-raised">
          {items.map((item) => (
            <li key={item.id}>
              <InboxRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
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
    <Tabs
      label={`Filter by ${label.toLowerCase()}`}
      items={tabs.map((t) => ({ href: hrefFor(t.value), label: t.label, active: active === t.value }))}
    />
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
    <Link
      href={`/conversations/${item.id}`}
      className="flex min-h-[4.5rem] items-start justify-between gap-4 px-4 py-4 transition duration-300 hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-5"
    >
      <div className="min-w-0 space-y-1.5">
        <p className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{kindLabels[item.kind]}</Badge>
          <Badge>{item.side === "BUYING" ? "Buying" : "Selling"}</Badge>
          {item.isDemo ? <DemoTag /> : null}
          {item.blocked ? <Badge tone="danger">Blocked</Badge> : null}
        </p>
        <p className="truncate font-heading text-xl text-ink">{title}</p>
        {subject && <p className="truncate text-sm text-ink-soft">{subject}</p>}
        {item.lastMessage && <p className="truncate text-sm text-ink-soft">{item.lastMessage.body}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 text-xs text-ink-soft">
        <span className="tabular-nums">{item.lastMessageAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
        {item.unreadCount > 0 && <Badge tone="accent">{item.unreadCount} new</Badge>}
      </div>
    </Link>
  );
}
