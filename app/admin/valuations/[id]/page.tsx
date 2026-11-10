import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { formatDate } from "@/components/admin/admin-ui";
import { MediaGallery } from "@/components/valuator/media-gallery";
import { ThreadList } from "@/components/valuator/thread-list";
import { ValuationForm } from "@/components/valuator/valuation-form";
import { isResultReady } from "@/lib/valuation/access";
import { prisma } from "@/lib/db/client";
import { CONFIDENCE_LABELS, formatCarat, money, statusLabel } from "@/lib/valuation/display";
import { getValuationView, ValuationError } from "@/lib/valuation/service";
import type { ValuationView } from "@/lib/valuation/view";
import { expertReasonLabel, loadAutoFactors } from "@/lib/valuation/valuator-queue";
import { VALUATION_ROUTES } from "@/lib/valuation/routes";
import { assignAction, adminRejectAction, withdrawAction } from "./actions";

type Params = Promise<{ id: string }>;

export default function AdminValuationPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <AdminDetail params={params} />
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

async function AdminDetail({ params }: { params: Params }) {
  const admin = await requirePageRole(["ADMIN"]);
  const { id } = await params;
  const actor = { id: admin.id, role: admin.role };

  let view: ValuationView;
  try {
    view = await getValuationView(id, actor);
  } catch (error) {
    if (error instanceof ValuationError) notFound();
    throw error;
  }
  const [factors, valuators, assignment] = await Promise.all([
    loadAutoFactors(id, actor),
    prisma.user.findMany({
      where: { role: "VALUATOR", status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.valuation.findUnique({ where: { id }, select: { assignedValuatorId: true } }),
  ]);
  const open = view.status === "IN_EXPERT_REVIEW" || view.status === "NEEDS_INFO";
  const assignedId = assignment?.assignedValuatorId ?? null;
  const assignedToInactive = assignedId !== null && !valuators.some((v) => v.id === assignedId);
  const currency = view.currency;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href={VALUATION_ROUTES.adminQueue} className="text-sm underline">
          Back to valuations
        </Link>
        <h1 className="font-mono text-xl font-semibold">{view.reference}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded bg-stone-200 px-2 py-0.5 text-xs font-medium">{statusLabel(view.status)}</span>
          <span className="rounded bg-stone-100 px-2 py-0.5 text-xs">{view.source === "LISTING" ? "From a listing" : "Standalone"}</span>
          {view.withdrawn ? <span className="rounded bg-stone-300 px-2 py-0.5 text-xs">Withdrawn</span> : null}
          <span className="text-stone-600">Submitted {formatDate(view.submittedAt)}</span>
        </p>
        {view.withdrawn ? (
          <p className="rounded border border-stone-400 bg-stone-100 p-3 text-sm">
            Withdrawn. Reason: {view.withdrawnReason ?? "-"}. The public verification page shows withdrawn.
          </p>
        ) : null}
      </div>

      <section aria-labelledby="people-heading" className="space-y-3">
        <h2 id="people-heading" className="text-lg font-medium">Requester and valuer</h2>
        <dl className="grid grid-cols-1 gap-3 rounded border border-stone-300 bg-white p-4 sm:grid-cols-3">
          <Field label="Requester" value={view.requester?.name} />
          <Field label="Requester email" value={view.requester?.email} />
          <Field label="Assigned valuer" value={view.assignedValuatorName ?? "Unassigned"} />
        </dl>
        {assignedToInactive ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            The assigned valuer is not active. Reassign this request below.
          </p>
        ) : null}
      </section>

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
            <Field label="Requester's notes" value={view.notes} />
          </div>
        </dl>
      </section>

      <section aria-labelledby="media-heading" className="space-y-3">
        <h2 id="media-heading" className="text-lg font-medium">Photos and video</h2>
        <MediaGallery media={view.media} />
      </section>

      <section aria-labelledby="result-heading" className="space-y-3">
        <h2 id="result-heading" className="text-lg font-medium">Result</h2>
        <div className="space-y-2 rounded border border-stone-300 bg-white p-4 text-sm">
          {view.result ? (
            <p>
              {view.result.valuedBy === "EXPERT" ? "Expert" : "Automatic"} estimate{" "}
              <span className="font-semibold">{money(view.result.estimateMinor, currency)}</span>, range{" "}
              {money(view.result.lowMinor, currency)} to {money(view.result.highMinor, currency)}, confidence{" "}
              {CONFIDENCE_LABELS[view.result.confidence] ?? view.result.confidence}.
            </p>
          ) : (
            <p>No result yet.</p>
          )}
          {view.autoSuggestion && view.result?.valuedBy !== "AUTO" ? (
            <p className="text-stone-600">
              Automatic suggestion: {money(view.autoSuggestion.estimateMinor, currency)} (confidence{" "}
              {CONFIDENCE_LABELS[view.autoSuggestion.confidence] ?? view.autoSuggestion.confidence}).
            </p>
          ) : null}
          {factors.length > 0 ? (
            <ul className="list-disc pl-5 text-stone-700">
              {factors.map((factor) => (
                <li key={factor}>{factor}</li>
              ))}
            </ul>
          ) : null}
          {view.expertReasons.length > 0 ? (
            <p className="text-stone-600">Expert review because: {view.expertReasons.map((r) => expertReasonLabel(r)).join("; ")}</p>
          ) : null}
          {view.rejectionReason ? <p className="text-red-800">Rejected: {view.rejectionReason}</p> : null}
          {isResultReady(view.status) && !view.withdrawn ? (
            <p>
              <a href={`/api/valuation/${view.id}/pdf`} className="underline" target="_blank" rel="noopener noreferrer">
                Download the PDF report
              </a>
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="thread-heading" className="space-y-3">
        <h2 id="thread-heading" className="text-lg font-medium">Conversation</h2>
        <ThreadList thread={view.thread} />
      </section>

      <section aria-labelledby="actions-heading" className="space-y-4">
        <h2 id="actions-heading" className="text-lg font-medium">Actions</h2>

        {open ? (
          <ValuationForm
            title="Assign or reassign a valuer"
            description="Only active valuers are listed. Choose Unassigned to remove the current valuer."
            action={assignAction}
            hidden={{ valuationId: view.id }}
            submitLabel="Save assignment"
            fields={[
              {
                name: "valuatorId",
                label: "Valuer",
                kind: "select",
                defaultValue: "",
                options: [
                  { value: "", label: "Unassigned" },
                  ...valuators.map((v) => ({ value: v.id, label: `${v.name ?? v.email} (${v.email})` })),
                ],
              },
            ]}
          />
        ) : null}

        {open ? (
          <ValuationForm
            title="Reject this request"
            description="The requester is told and sees the reason."
            action={adminRejectAction}
            hidden={{ valuationId: view.id }}
            submitLabel="Reject request"
            tone="danger"
            fields={[{ name: "reason", label: "Reason", kind: "textarea", required: true, maxLength: 500, rows: 3 }]}
          />
        ) : null}

        {isResultReady(view.status) && !view.withdrawn ? (
          <ValuationForm
            title="Withdraw this report"
            description="The public verification page then shows withdrawn. The reason is kept on record."
            action={withdrawAction}
            hidden={{ valuationId: view.id }}
            submitLabel="Withdraw report"
            tone="danger"
            fields={[{ name: "reason", label: "Reason for withdrawal", kind: "textarea", required: true, maxLength: 500, rows: 3 }]}
          />
        ) : null}

        {!open && !isResultReady(view.status) ? (
          <p className="text-sm text-stone-600">No actions are open for this request in its current state.</p>
        ) : null}
      </section>
    </div>
  );
}
