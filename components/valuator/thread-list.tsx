import { formatDate } from "@/components/admin/admin-ui";
import { THREAD_FROM_LABELS, THREAD_KIND_LABELS } from "@/lib/valuation/display";
import type { ThreadEntry } from "@/lib/valuation/view";

/**
 * The conversation on a valuation. Authors appear by role (Requester, Valuer, Admin), never by name.
 */
export function ThreadList({ thread }: { thread: ThreadEntry[] }) {
  if (thread.length === 0) {
    return <p className="rounded border border-dashed border-stone-300 p-4 text-sm text-stone-600">No messages yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {thread.map((entry) => (
        <li key={entry.id} className="rounded border border-stone-200 bg-white p-3 text-sm">
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-stone-600">
            <span className="font-medium text-stone-900">{THREAD_FROM_LABELS[entry.from]}</span>
            <span>{THREAD_KIND_LABELS[entry.kind] ?? entry.kind}</span>
            <time dateTime={entry.createdAt.toISOString()}>{formatDate(entry.createdAt)}</time>
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{entry.body}</p>
        </li>
      ))}
    </ol>
  );
}
