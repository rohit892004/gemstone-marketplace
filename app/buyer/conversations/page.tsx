import Link from "next/link";
import { Suspense } from "react";
import { MessagesSquare } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
        <Link href="/conversations" className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4 hover:text-accent-text">
          Search all conversations
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No conversations yet"
          body="Message a seller from their portfolio page, or post a requirement so sellers can respond."
          action={
            <ButtonLink href="/buyer/requirements/new" variant="secondary">
              Post a requirement
            </ButtonLink>
          }
        />
      ) : (
        <ConversationRows items={items} />
      )}
    </div>
  );
}
