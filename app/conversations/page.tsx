import Link from "next/link";
import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { listConversationsForUser, type ConversationListItem } from "@/lib/messaging/service";
import { MESSAGING_ROLES } from "@/lib/messaging/access";

/**
 * Shared conversation list for buyers and sellers. Role-specific dashboards link here.
 * Search matches the other person's name or business, or the listing title.
 */
export default function ConversationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Suspense fallback={null}>
      <List searchParams={searchParams} />
    </Suspense>
  );
}

async function List({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePageRole(MESSAGING_ROLES, { sellerApproved: true });
  const { q } = await searchParams;
  const items = await listConversationsForUser(user.id, { q: typeof q === "string" ? q.slice(0, 100) : undefined });

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm uppercase tracking-widest text-accent-text">Messages</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Conversations</h1>

      <form method="get" className="mt-6">
        <label className="sr-only" htmlFor="q">Search conversations</label>
        <input
          id="q"
          name="q"
          defaultValue={typeof q === "string" ? q : ""}
          placeholder="Search by name, business or gemstone"
          className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
        />
      </form>

      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
          <h2 className="text-lg font-semibold text-ink">No conversations yet</h2>
          <p className="mt-2 text-sm text-ink-soft">Enquire about a gemstone to start a conversation with its seller.</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-lg border border-line bg-surface-raised">
          {items.map((item) => (
            <li key={item.id}>
              <ConversationRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConversationRow({ item }: { item: ConversationListItem }) {
  const title = item.counterpart.businessName ?? item.counterpart.name ?? "Member";
  const subject = item.gemstone?.title ?? (item.requirement ? `Requirement: ${item.requirement.gemstoneType}` : null);
  return (
    <Link href={`/conversations/${item.id}`} className="flex items-start justify-between gap-4 px-4 py-4 hover:bg-surface">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium text-ink">
          <span className="truncate">{title}</span>
          {item.isDemo && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-ink">Demo</span>}
          {item.blocked && <span className="text-xs text-ink-soft">Blocked</span>}
        </p>
        {subject && <p className="truncate text-sm text-ink-soft">{subject}</p>}
        {item.lastMessage && (
          <p className="mt-1 truncate text-sm text-ink-soft">
            {item.lastMessage.body}
          </p>
        )}
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
