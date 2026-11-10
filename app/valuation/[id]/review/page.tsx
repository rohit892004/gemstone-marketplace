import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DetailsSummary } from "@/components/valuation/details-summary";
import { PhotoGrid } from "@/components/valuation/photo-grid";
import { RequesterAccessMessage } from "@/components/valuation/requester-access";
import { ReviewForm } from "@/components/valuation/review-form";
import { WizardSteps } from "@/components/valuation/wizard-steps";
import { Panel, linkClass } from "@/components/valuation/ui";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";
import { gateRequester } from "../../guard";
import { loadRequesterValuation } from "../../load";

export const metadata: Metadata = {
  title: "Review your valuation request",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default function ReviewPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <Review params={params} />
    </Suspense>
  );
}

async function Review({ params }: Props) {
  const { id } = await params;
  const gate = await gateRequester(REQUESTER_PATHS.review(id));
  if (gate.kind !== "allowed") return <RequesterAccessMessage state={gate} returnTo={REQUESTER_PATHS.review(id)} />;

  const view = await loadRequesterValuation(id, gate.user);
  if (!view) notFound();
  if (view.status !== "DRAFT") redirect(REQUESTER_PATHS.result(id));

  const photoCount = view.media.filter((m) => m.kind === "IMAGE").length;

  return (
    <div className="space-y-8">
      <WizardSteps current={2} />

      <Panel title="Check your request" id="summary-heading">
        <DetailsSummary view={view} />
        <p className="text-sm">
          <Link href={REQUESTER_PATHS.upload(id)} className={linkClass}>
            Change the details or photos
          </Link>
        </p>
      </Panel>

      <Panel title={`Photos (${photoCount})`} id="photos-heading">
        <PhotoGrid media={view.media.map((m) => ({ id: m.id, kind: m.kind }))} />
      </Panel>

      <ReviewForm valuationId={id} photoCount={photoCount} initialRequestExpert={view.requestExpert} />
    </div>
  );
}
