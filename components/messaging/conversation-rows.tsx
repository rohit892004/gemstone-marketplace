import Link from "next/link";
import type { ConversationListItem } from "@/lib/messaging/service";
import { DemoBadge } from "@/components/catalogue/badges";

/**
 * Conversation list rows for the buyer dashboard. Plain text only: every name, title and message
 * snippet is rendered as text, never as HTML. Demo rows carry the Demo label.
 */
export function ConversationRows({ items }: { items: ConversationListItem[] }) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
      {items.map((item) => (
        <li key={item.id}>
          <ConversationRow item={item} />
        </li>
      ))}
    </ul>
  );
}

function ConversationRow({ item }: { item: ConversationListItem }) {
  const title = item.counterpart.businessName ?? item.counterpart.name ?? "Member";
  const subject = item.gemstone?.title ?? (item.requirement ? `Requirement: ${item.requirement.gemstoneType}` : null);
  return (
    <Link href={`/conversations/${item.id}`} className="flex items-start justify-between gap-4 px-4 py-4 hover:bg-surface">
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
          <span className="truncate">{title}</span>
          {item.isDemo ? <DemoBadge /> : null}
          {item.blocked ? <span className="text-xs text-ink-soft">Blocked</span> : null}
        </p>
        {subject ? <p className="truncate text-sm text-ink-soft">{subject}</p> : null}
        {item.lastMessage ? <p className="truncate text-sm text-ink-soft">{item.lastMessage.body}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-ink-soft">
        <span>{item.lastMessageAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
        {item.unreadCount > 0 ? (
          <span className="rounded-full bg-brand px-2 py-0.5 font-medium text-white">{item.unreadCount} new</span>
        ) : null}
      </div>
    </Link>
  );
}
