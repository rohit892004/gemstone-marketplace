import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { formatDate } from "@/components/admin/admin-ui";
import { MediaGallery } from "@/components/valuator/media-gallery";
import { ThreadList } from "@/components/valuator/thread-list";
import { ValuationForm } from "@/components/valuator/valuation-form";
import { CONFIDENCE_LABELS, formatCarat, money, statusLabel } from "@/lib/valuation/display";
import { getValuationView, ValuationError } from "@/lib/valuation/service";
import type { ValuationView } from "@/lib/valuation/view";
import { expertReasonLabel, loadAutoFactors } from "@/lib/valuation/valuator-queue";
import { VALUATION_ROUTES } from "@/lib/valuation/routes";
import { askForInfoAction, rejectAction, signOffAction } from "./actions";

type Params = Promise<{ id: string }>;

export default function ValuatorValuationPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <ValuatorDetail params={params} />
    </Suspense>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-600">{label}</dt>
      <dd className="text-sm break-words">{value || "-"}</dd>
    </div>
  );
}

/**
 * The valuator's view. getValuationView applies the privacy rules: no requester, listing or seller fields reach
 * this page. The only other read is the engine's factors (loadAutoFactors), which hold no requester data.
 */
async function ValuatorDetail({ params }: { params: Params }) {
  const user = await requirePageRole(["VALUATOR"]);
  const { id } = await params;
  const actor = { id: user.id, role: user.role };

  let view: ValuationView;
  try {
    view = await getValuationView(id, actor);
  } catch (error) {
    if (error instanceof ValuationError) notFound();
    throw error;
  }
  const factors = await loadAutoFactors(id, actor);
  const open = view.status === "IN_EXPERT_REVIEW";
  const waiting = view.status === "NEEDS_INFO";
  const canDecide = open || waiting;
  const currency = view.currency;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href={VALUATION_ROUTES.valuatorQueue} className="text-sm underline">
          Back to my queue
        </Link>
        <h1 className="font-mono text-xl font-semibold">{view.reference}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded bg-stone-200 px-2 py-0.5 text-xs font-medium">{statusLabel(view.status)}</span>
          {view.withdrawn ? <span className="rounded bg-stone-300 px-2 py-0.5 text-xs">Withdrawn</span> : null}
          <span className="text-stone-600">Submitted {formatDate(view.submittedAt)}</span>
        </p>
      </div>

      <section aria-labelledby="stone-heading" className="space-y-3">
        <h2 id="stone-heading" className="text-lg font-medium">Stone</h2>
        <dl className="grid grid-cols-1 gap-3 rounded border border-stone-300 bg-white p-4 sm:grid-cols-2 md:grid-cols-3">
          <Field label="Gemstone" value={view.gemstoneType} />
          <Field label="Category" value={view.categoryName} />
          <Field label="Carat" value={formatCarat(view.caratMilli)} />
          <Field label="Shape" value={view.shape} />
          <Field label="Dimensions" value={view.dimensions} />
          <Field label="Colour" value={view.colour} />
          <Field label="Clarity" value={view.clarity} />
          <Field label="Quality grade" value={view.qualityGradeLabel} />
          <Field label="Origin" value={view.origin} />
          <Field label="Treatment" value={view.treatment} />
          <Field label="Certificate lab" value={view.labName} />
          <Field label="Certificate number" value={view.certificateNumber} />
          <div className="sm:col-span-2 md:col-span-3">
            <Field label="Notes on the stone" value={view.notes} />
          </div>
        </dl>
      </section>

      <section aria-labelledby="media-heading" className="space-y-3">
        <h2 id="media-heading" className="text-lg font-medium">Photos and video</h2>
        <MediaGallery media={view.media} />
      </section>

      <section aria-labelledby="engine-heading" className="space-y-3">
        <h2 id="engine-heading" className="text-lg font-medium">Automatic suggestion</h2>
        <div className="rounded border border-stone-300 bg-white p-4 text-sm">
          {view.autoSuggestion ? (
            <>
              <p>
                Estimate <span className="font-semibold">{money(view.autoSuggestion.estimateMinor, currency)}</span>, range{" "}
                {money(view.autoSuggestion.lowMinor, currency)} to {money(view.autoSuggestion.highMinor, currency)}. Confidence:{" "}
                {CONFIDENCE_LABELS[view.autoSuggestion.confidence] ?? view.autoSuggestion.confidence}.
              </p>
              <p className="mt-1 text-xs text-stone-600">Indicative only. Reference prices may still be demo data.</p>
            </>
          ) : (
            <p>The engine gave no estimate for this stone.</p>
          )}
          {factors.length > 0 ? (
            <div className="mt-3">
              <p className="font-medium">Factors used</p>
              <ul className="list-disc pl-5">
                {factors.map((factor) => (
                  <li key={factor}>{factor}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {view.expertReasons.length > 0 ? (
            <div className="mt-3">
              <p className="font-medium">Why it came to you</p>
              <ul className="list-disc pl-5">
                {view.expertReasons.map((reason) => (
                  <li key={reason}>{expertReasonLabel(reason)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="thread-heading" className="space-y-3">
        <h2 id="thread-heading" className="text-lg font-medium">Conversation</h2>
        <ThreadList thread={view.thread} />
      </section>

      {view.status === "COMPLETED" && view.result ? (
        <section aria-labelledby="outcome-heading" className="rounded border border-green-300 bg-green-50 p-4 text-sm">
          <h2 id="outcome-heading" className="font-medium">Signed off</h2>
          <p>
            Estimate {money(view.result.estimateMinor, currency)}, range {money(view.result.lowMinor, currency)} to{" "}
            {money(view.result.highMinor, currency)}, confidence {CONFIDENCE_LABELS[view.result.confidence] ?? view.result.confidence}.
          </p>
        </section>
      ) : null}

      {view.status === "REJECTED" ? (
        <section aria-labelledby="rejected-heading" className="rounded border border-red-300 bg-red-50 p-4 text-sm">
          <h2 id="rejected-heading" className="font-medium">Rejected</h2>
          <p>{view.rejectionReason ?? "No reason recorded."}</p>
        </section>
      ) : null}

      {canDecide ? (
        <section aria-labelledby="decide-heading" className="space-y-4">
          <h2 id="decide-heading" className="text-lg font-medium">Your decision</h2>
          {waiting ? (
            <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
              Waiting for the requester to reply to your question. The request returns to review when they reply. You can still reject it.
            </p>
          ) : null}

          {open ? (
            <>
              <ValuationForm
                title="Ask for more information"
                description="The requester is asked to reply on the platform. Do not include contact details."
                action={askForInfoAction}
                hidden={{ valuationId: view.id }}
                submitLabel="Send question"
                fields={[{ name: "body", label: "Question for the requester", kind: "textarea", required: true, maxLength: 1000, rows: 3 }]}
              />

              <ValuationForm
                title="Sign off the valuation"
                description="Amounts are in the stone's currency, in major units (for example 12500.50). The estimate must sit within the range."
                action={signOffAction}
                hidden={{ valuationId: view.id }}
                submitLabel="Sign off"
                fields={[
                  { name: "estimate", label: `Estimate (${currency})`, required: true, inputMode: "decimal", help: "Major units, such as 12500.50." },
                  { name: "low", label: `Low (${currency})`, required: true, inputMode: "decimal" },
                  { name: "high", label: `High (${currency})`, required: true, inputMode: "decimal" },
                  {
                    name: "confidence",
                    label: "Confidence",
                    kind: "select",
                    required: true,
                    defaultValue: "MEDIUM",
                    options: [
                      { value: "LOW", label: "Low" },
                      { value: "MEDIUM", label: "Medium" },
                      { value: "HIGH", label: "High" },
                    ],
                  },
                  { name: "notes", label: "Note for the record", kind: "textarea", required: true, maxLength: 1000, rows: 3, help: "Explain the value. No contact details." },
                ]}
              />
            </>
          ) : null}

          <ValuationForm
            title="Reject this request"
            description="Use this when the stone cannot be valued. The requester sees the reason."
            action={rejectAction}
            hidden={{ valuationId: view.id }}
            submitLabel="Reject request"
            tone="danger"
            fields={[{ name: "reason", label: "Reason", kind: "textarea", required: true, maxLength: 500, rows: 3 }]}
          />
        </section>
      ) : null}
    </div>
  );
}
