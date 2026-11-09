import Link from "next/link";
import { Suspense } from "react";
import { ConversationRows } from "@/components/messaging/conversation-rows";
import { listConversationsForUser } from "@/lib/messaging/service";
import { requireBuyerPage } from "../guard";

export default function ConversationsPage() {
  return (
    <Suspense fallback={null}>
      <Conversations />
    </Suspense>
  );
}

/**
 * Direct conversations with sellers (started from a seller's portfolio page) and conversations a seller
 * opened in reply to one of your requirements. Enquiries about listings are on the Enquiries tab.
 */
async function Conversations() {
  const user = await requireBuyerPage();
  const [general, requirement] = await Promise.all([
    listConversationsForUser(user.id, { kind: "GENERAL" }),
    listConversationsForUser(user.id, { kind: "REQUIREMENT" }),
  ]);
  const items = [...general, ...requirement].sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Messages stay on Gemstone Selections.</p>
        <Link href="/conversations" className="text-sm font-medium text-brand-strong underline underline-offset-4">
          Search all conversations
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
          <h2 className="text-lg font-semibold text-ink">No conversations yet</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Message a seller from their portfolio page, or post a requirement so sellers can respond.
          </p>
        </div>
      ) : (
        <ConversationRows items={items} />
      )}
    </div>
  );
}
