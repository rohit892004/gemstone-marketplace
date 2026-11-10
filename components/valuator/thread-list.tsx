import { MessageSquare } from "lucide-react";
import { formatDate } from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { THREAD_FROM_LABELS, THREAD_KIND_LABELS } from "@/lib/valuation/display";
import type { ThreadEntry } from "@/lib/valuation/view";

/**
 * The conversation on a valuation. Authors appear by role (Requester, Valuer, Admin), never by name.
 */
export function ThreadList({ thread }: { thread: ThreadEntry[] }) {
  if (thread.length === 0) {
    return <EmptyState icon={MessageSquare} title="No messages yet" body="Messages on this valuation appear here in order." />;
  }
  return (
    <ol className="space-y-3">
      {thread.map((entry) => (
        <li key={entry.id} className="border border-line bg-surface-raised p-3 text-sm">
          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-ink-soft">
            <span className="font-medium text-ink">{THREAD_FROM_LABELS[entry.from]}</span>
            <span>{THREAD_KIND_LABELS[entry.kind] ?? entry.kind}</span>
            <time dateTime={entry.createdAt.toISOString()}>{formatDate(entry.createdAt)}</time>
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{entry.body}</p>
        </li>
      ))}
    </ol>
  );
}
