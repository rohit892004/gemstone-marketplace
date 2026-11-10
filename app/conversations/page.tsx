import { Suspense } from "react";
import { MessagesSquare } from "lucide-react";
import { ConversationRows } from "@/components/messaging/conversation-rows";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageRole } from "@/lib/auth/require-role";
import { listConversationsForUser } from "@/lib/messaging/service";
import { MESSAGING_ROLES } from "@/lib/messaging/access";

/**
 * Shared conversation list for buyers and sellers. Role-specific dashboards link here.
 * Search matches the other person's name or business, or the listing title.
 */
export default function ConversationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
      <Suspense fallback={null}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePageRole(MESSAGING_ROLES, { sellerApproved: true });
  const { q } = await searchParams;
  const items = await listConversationsForUser(user.id, { q: typeof q === "string" ? q.slice(0, 100) : undefined });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Messages" title="Conversations" />

      <form method="get" className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="q">Search conversations</label>
        <Input id="q" name="q" defaultValue={typeof q === "string" ? q : ""} placeholder="Search by name, business or gemstone" className="sm:flex-1" />
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No conversations yet"
          body="Enquire about a gemstone to start a conversation with its seller."
          action={
            <ButtonLink href="/gemstones" variant="secondary">
              Browse gemstones
            </ButtonLink>
          }
        />
      ) : (
        <ConversationRows items={items} />
      )}
    </div>
  );
}
