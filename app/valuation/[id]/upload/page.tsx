import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DetailsForm, type DetailsInitial } from "@/components/valuation/details-form";
import { PhotoUploader } from "@/components/valuation/photo-uploader";
import { WizardSteps } from "@/components/valuation/wizard-steps";
import { RequesterAccessMessage } from "@/components/valuation/requester-access";
import { Disclaimer, EstimateNote, Panel } from "@/components/valuation/ui";
import { PageHeader } from "@/components/ui/page-header";
import { DISCLAIMER_TEXT, DISCLAIMER_TITLE } from "@/lib/valuation/requester-copy";
import { VALUATION_CATEGORIES } from "@/lib/valuation/defaults";
import { getValuationIds, loadDetailFormOptions } from "@/lib/valuation/requester-queries";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";
import { gateRequester } from "../../guard";
import { loadRequesterValuation } from "../../load";

export const metadata: Metadata = {
  title: "Valuation details",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default function UploadPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <Upload params={params} />
    </Suspense>
  );
}

async function Upload({ params }: Props) {
  const { id } = await params;
  const gate = await gateRequester(REQUESTER_PATHS.upload(id));
  if (gate.kind !== "allowed") return <RequesterAccessMessage state={gate} returnTo={REQUESTER_PATHS.upload(id)} />;

  const view = await loadRequesterValuation(id, gate.user);
  if (!view) notFound();
  // Only a draft, or a request where the valuer has asked for more, can be edited here.
  if (view.status !== "DRAFT" && view.status !== "NEEDS_INFO") redirect(REQUESTER_PATHS.result(id));

  const [{ categories, labs }, ids] = await Promise.all([loadDetailFormOptions(), getValuationIds(id)]);
  const isDraft = view.status === "DRAFT";

  const initial: DetailsInitial = {
    gemstoneType: view.gemstoneType,
    categoryId: ids?.categoryId ?? "",
    shape: view.shape ?? "",
    carat: view.caratMilli !== null ? String(view.caratMilli / 1000) : "",
    dimensions: view.dimensions ?? "",
    colour: view.colour ?? "",
    clarity: view.clarity ?? "",
    qualityGrade: view.qualityGrade ?? "",
    origin: view.origin ?? "",
    treatment: view.treatment ?? "",
    labId: ids?.labId ?? "",
    certificateNumber: view.certificateNumber ?? "",
    notes: view.notes ?? "",
    currency: view.currency,
  };

  return (
    <div className="space-y-12">
      {isDraft ? <WizardSteps current={1} /> : null}
      <PageHeader
        className="pb-0"
        eyebrow="Valuation request"
        title={isDraft ? "Stone details and photos" : "Update your request"}
        lead={
          isDraft
            ? "Add at least one clear photo and the details you know. Anything you are not sure of can be left blank."
            : "The valuer has asked for more information. Correct the details or add photos, then go back to your request."
        }
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
        <div className="min-w-0 space-y-12">
          {isDraft ? null : (
            <Panel title="Update your details" id="update-heading">
              <p className="text-sm text-ink-soft">The valuer asked for more information. Change the details here if they need correcting, then go back to your request.</p>
            </Panel>
          )}

          <DetailsForm
            valuationId={id}
            initial={initial}
            gemstoneTypeOptions={gemstoneTypeOptions(view.gemstoneType)}
            categories={categories}
            labs={labs}
            continueTo={isDraft ? REQUESTER_PATHS.review(id) : REQUESTER_PATHS.result(id)}
            continueLabel={isDraft ? "Continue" : "Save and return"}
            fromListing={view.source === "LISTING"}
          />

          <PhotoUploader
            valuationId={id}
            media={view.media.map((m) => ({ id: m.id, kind: m.kind, mimeType: m.mimeType }))}
            canAdd
            canRemove
          />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="About this estimate">
          <EstimateNote title="About this estimate" text="Fill in the certificate and origin fields when you have them. Each one helps the estimate." />
          <Disclaimer title={DISCLAIMER_TITLE} text={DISCLAIMER_TEXT} />
        </aside>
      </div>
    </div>
  );
}

/** The seven gemstone types, plus the stored value when it is something else (for example a listing's own species). */
function gemstoneTypeOptions(current: string): string[] {
  const types: string[] = [...VALUATION_CATEGORIES];
  if (current && !types.includes(current)) types.unshift(current);
  return types;
}
