import Link from "next/link";
import { Suspense } from "react";
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
      <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
        <h2 className="text-lg font-semibold text-ink">No enquiries yet</h2>
        <p className="mt-2 text-sm text-ink-soft">Open a gemstone and choose Chat / Enquire to ask its seller a question.</p>
        <Link href="/gemstones" className="mt-4 inline-block text-sm font-medium text-brand-strong underline underline-offset-4">
          Browse gemstones
        </Link>
      </div>
    );
  }

  return <ConversationRows items={items} />;
}
