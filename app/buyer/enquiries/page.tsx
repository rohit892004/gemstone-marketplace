import { Suspense } from "react";
import { Send } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConversationRows } from "@/components/messaging/conversation-rows";
import { listConversationsForUser } from "@/lib/messaging/service";
import { requireBuyerPage } from "../guard";

export default function EnquiriesPage() {
  return (
    <Suspense fallback={null}>
      <Enquiries />
    </Suspense>
  );
}

/** Enquiries about gemstone listings. Each enquiry is one conversation with the seller of that stone. */
async function Enquiries() {
  const user = await requireBuyerPage();
  const items = await listConversationsForUser(user.id, { kind: "ENQUIRY" });

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="No enquiries yet"
        body="Open a gemstone and choose Chat / Enquire to ask its seller a question."
        action={
          <ButtonLink href="/gemstones" variant="secondary">
            Browse gemstones
          </ButtonLink>
        }
      />
    );
  }

  return <ConversationRows items={items} />;
}
