import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DetailsSummary } from "@/components/valuation/details-summary";
import { InfoReplyForm, ThreadList } from "@/components/valuation/info-thread";
import { PhotoUploader } from "@/components/valuation/photo-uploader";
import { PublishToggle } from "@/components/valuation/publish-toggle";
import { RequesterAccessMessage } from "@/components/valuation/requester-access";
import { ResultPanel } from "@/components/valuation/result-panel";
import { WizardSteps } from "@/components/valuation/wizard-steps";
import { Disclaimer, Panel, linkClass } from "@/components/valuation/ui";
import { canPublishOnListing } from "@/lib/valuation/access";
import {
  DISCLAIMER_TEXT,
  DISCLAIMER_TITLE,
  STATUS_BODY,
  WITHDRAWN_BANNER_TEXT,
  WITHDRAWN_BANNER_TITLE,
  expertReasonText,
  statusLabel,
} from "@/lib/valuation/requester-copy";
import { getResultExtras } from "@/lib/valuation/requester-queries";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";
import { gateRequester } from "../guard";
import { loadRequesterValuation } from "../load";

export const metadata: Metadata = {
  title: "Your valuation",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default function ResultPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <Result params={params} />
    </Suspense>
  );
}

async function Result({ params }: Props) {
  const { id } = await params;
  const gate = await gateRequester(REQUESTER_PATHS.result(id));
  if (gate.kind !== "allowed") return <RequesterAccessMessage state={gate} returnTo={REQUESTER_PATHS.result(id)} />;

  const view = await loadRequesterValuation(id, gate.user);
  if (!view) notFound();

  const extras = await getResultExtras(id);
  const isDemo = extras?.isDemo ?? false;
  const factors = Array.isArray(extras?.autoFactors) ? (extras.autoFactors as unknown[]).filter((f): f is string => typeof f === "string") : [];
  const showFactors = view.result?.valuedBy === "AUTO";

  // The seller of the listing may publish their own completed report there. The rule is canPublishOnListing.
  const canPublish =
    !!extras && !!view.gemstoneId
      ? canPublishOnListing(
          { id: gate.user.id, role: gate.user.role },
          { requesterId: gate.user.id, assignedValuatorId: null, status: view.status, withdrawnAt: extras.withdrawnAt, gemstoneId: view.gemstoneId },
          { id: view.gemstoneId, sellerUserId: extras.gemstone?.seller.userId ?? "" },
        )
      : false;

  const hasThread = view.thread.length > 0;
  const canReply = view.status === "NEEDS_INFO";
  const label = statusLabel(view.status, view.withdrawn);

  return (
    <div className="space-y-8">
      {view.status === "DRAFT" ? null : <WizardSteps current={3} />}

      <header className="space-y-2">
        <p className="text-sm text-ink-soft">
          Ref. {view.reference} · {view.gemstoneType || "Gemstone"}
        </p>
        <h1 className="font-heading text-3xl font-medium leading-tight text-ink sm:text-4xl">{label}</h1>
        <p className="text-ink-soft">{STATUS_BODY[view.status] ?? "Your valuation is in progress."}</p>
      </header>

      {view.withdrawn ? (
        <div role="alert" className="space-y-1 border border-danger/40 px-4 py-3 text-sm text-danger">
          <p className="font-medium">{WITHDRAWN_BANNER_TITLE}</p>
          <p>{WITHDRAWN_BANNER_TEXT}</p>
          {view.withdrawnReason ? <p className="pt-1 font-medium">Reason: {view.withdrawnReason}</p> : null}
        </div>
      ) : null}

      {view.status === "DRAFT" ? (
        <Panel title="Your request is not sent yet" id="draft-heading">
          <p className="text-sm text-ink-soft">Finish the details and photos, then submit the request.</p>
          <Link href={REQUESTER_PATHS.upload(id)} className={linkClass}>
            Continue your valuation
          </Link>
        </Panel>
      ) : null}

      {view.status === "IN_EXPERT_REVIEW" ? (
        <Panel title="With an expert valuer" id="review-heading">
          {view.expertReasons.length > 0 ? (
            <div className="space-y-1 text-sm text-ink-soft">
              <p>Why this went to a valuer:</p>
              <ul className="list-disc pl-5">
                {view.expertReasons.map((code) => (
                  <li key={code}>{expertReasonText(code)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-sm text-ink-soft">The valuer&apos;s result will appear here when it is ready. No estimate is shown until then.</p>
        </Panel>
      ) : null}

      {view.status === "NEEDS_INFO" ? (
        <Panel title="The valuer has a question" id="info-heading">
          <p className="text-sm text-ink-soft">Reply below. You can also add photos or correct the details.</p>
          <Link href={REQUESTER_PATHS.upload(id)} className={linkClass}>
            Update the stone details
          </Link>
        </Panel>
      ) : null}

      {view.status === "REJECTED" ? (
        <Panel title="Reason" id="rejected-heading">
          <p className="whitespace-pre-line text-sm text-ink">{view.rejectionReason ?? "No reason was given."}</p>
          <p className="text-sm text-ink-soft">
            You can start a new valuation from the valuation page at any time.
          </p>
        </Panel>
      ) : null}

      {view.result ? (
        <ResultPanel view={view} factors={showFactors ? factors : []} isDemo={isDemo} />
      ) : null}

      {hasThread ? (
        <Panel title="Conversation with the valuer" id="thread-heading">
          <ThreadList thread={view.thread} />
        </Panel>
      ) : null}

      {canReply ? (
        <Panel title="Reply to the valuer" id="reply-heading">
          <InfoReplyForm valuationId={id} />
        </Panel>
      ) : null}

      {canReply ? (
        <PhotoUploader
          valuationId={id}
          media={view.media.map((m) => ({ id: m.id, kind: m.kind, mimeType: m.mimeType }))}
          canAdd
          canRemove
          heading="Add photos"
        />
      ) : null}

      {canPublish || view.publishedOnListing ? (
        <PublishToggle valuationId={id} initiallyPublished={view.publishedOnListing ?? false} />
      ) : null}

      <Panel title="Your details" id="details-heading">
        <DetailsSummary view={view} />
      </Panel>

      <Disclaimer title={DISCLAIMER_TITLE} text={DISCLAIMER_TEXT} />
    </div>
  );
}
