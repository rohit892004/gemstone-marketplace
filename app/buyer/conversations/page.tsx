import { Suspense } from "react";
import { ComingSoon } from "../coming-soon";
import { requireBuyerPage } from "../guard";

export default function ConversationsPage() {
  return (
    <Suspense fallback={null}>
      <Conversations />
    </Suspense>
  );
}

async function Conversations() {
  await requireBuyerPage();
  return <ComingSoon title="Conversations" empty="No conversations yet" />;
}
