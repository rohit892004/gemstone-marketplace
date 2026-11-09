import { Suspense } from "react";
import { ComingSoon } from "../coming-soon";
import { requireBuyerPage } from "../guard";

export default function EnquiriesPage() {
  return (
    <Suspense fallback={null}>
      <Enquiries />
    </Suspense>
  );
}

async function Enquiries() {
  await requireBuyerPage();
  return <ComingSoon title="Enquiries" empty="No enquiries yet" />;
}
