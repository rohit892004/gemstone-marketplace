import Link from "next/link";
import type { ConversationListItem } from "@/lib/messaging/service";
import { Badge, DemoTag } from "@/components/ui/badge";

/**
 * Conversation list rows for buyer and seller dashboards. Plain text only: every name, title and message
 * snippet is rendered as text, never as HTML. Demo rows carry the Demo label.
 */
export function ConversationRows({ items }: { items: ConversationListItem[] }) {
  return (
    <ul className="divide-y divide-line border border-line bg-surface-raised">
      {items.map((item) => (
        <li key={item.id}>
          <ConversationRow item={item} />
        </li>
      ))}
    </ul>
  );
}

export function ConversationRow({ item }: { item: ConversationListItem }) {
  const title = item.counterpart.businessName ?? item.counterpart.name ?? "Member";
  const subject = item.gemstone?.title ?? (item.requirement ? `Requirement: ${item.requirement.gemstoneType}` : null);
  return (
    <Link
      href={`/conversations/${item.id}`}
      className="flex min-h-[4.5rem] items-start justify-between gap-4 px-4 py-4 transition duration-300 hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-5"
    >
      <div className="min-w-0 space-y-1.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate font-heading text-xl text-ink">{title}</span>
          {item.isDemo ? <DemoTag /> : null}
          {item.blocked ? <Badge tone="danger">Blocked</Badge> : null}
        </p>
        {subject ? <p className="truncate text-sm text-ink-soft">{subject}</p> : null}
        {item.lastMessage ? <p className="truncate text-sm text-ink-soft">{item.lastMessage.body}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 text-xs text-ink-soft">
        <span className="tabular-nums">{item.lastMessageAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
        {item.unreadCount > 0 ? <Badge tone="accent">{item.unreadCount} new</Badge> : null}
      </div>
    </Link>
  );
}
