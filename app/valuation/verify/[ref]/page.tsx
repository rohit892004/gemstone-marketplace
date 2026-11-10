import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AccessMessage, Panel } from "@/components/valuation/ui";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { verificationView, type VerificationView } from "@/lib/valuation/access";
import { VERIFY_METHOD_LABEL, VERIFY_NOT_FOUND_TEXT, VERIFY_NOT_FOUND_TITLE, VERIFY_STATUS_LABEL } from "@/lib/valuation/requester-copy";
import { findVerificationRow } from "@/lib/valuation/requester-queries";
import { isValidReference } from "@/lib/valuation/reference";

/**
 * Public verification. No login. Shows only the five fields in VerificationView: reference, date, gemstone type,
 * status and method. It never shows the price, the range, the requester, the listing or the notes. The lookup runs
 * only for a well-formed reference, and every miss gets the same page.
 */

export const metadata: Metadata = {
  title: "Verify a valuation",
  description: "Check that a Gemstone Selections indicative valuation reference is valid.",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ ref: string }> };

export default function VerifyPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <Verify params={params} />
    </Suspense>
  );
}

async function Verify({ params }: Props) {
  const { ref } = await params;
  const row = isValidReference(ref) ? await findVerificationRow(ref) : null;
  return (
    <section className="mx-auto max-w-3xl space-y-10 px-4 py-16 sm:px-6 sm:py-20">
      <PageHeader
        eyebrow="Verification"
        title="Verify a valuation"
        lead="Check that a Gemstone Selections indicative valuation reference is valid."
        className="border-b border-line pb-10"
      />

      <div>
        {row ? (
          <VerificationResult view={verificationView(row)} />
        ) : (
          <AccessMessage title={VERIFY_NOT_FOUND_TITLE}>
            <p>{VERIFY_NOT_FOUND_TEXT}</p>
          </AccessMessage>
        )}
      </div>

      <p className="text-sm leading-relaxed text-ink-soft">
        This check confirms a reference only. It does not show the value. Indicative valuations are not certified appraisals.{" "}
        <Link href="/" className="inline-flex min-h-11 items-center text-brand-strong underline underline-offset-4">
          Gemstone Selections
        </Link>
      </p>
    </section>
  );
}

const STATUS_TONE: Record<VerificationView["status"], BadgeTone> = {
  VALID: "verified",
  WITHDRAWN: "danger",
  NOT_COMPLETE: "warning",
};

function VerificationResult({ view }: { view: VerificationView }) {
  const rows: [string, ReactNode][] = [
    ["Reference", view.reference],
    ["Date", view.date ? formatDate(view.date) : "Not yet"],
    ["Gemstone type", view.gemstoneType || "Not stated"],
    ["Status", <Badge key="status" tone={STATUS_TONE[view.status]}>{VERIFY_STATUS_LABEL[view.status]}</Badge>],
    ["Method", view.method ? VERIFY_METHOD_LABEL[view.method] : "Not yet"],
  ];
  return (
    <Panel title="Reference found" id="verify-heading">
      <dl className="divide-y divide-line border border-line text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-3">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="font-medium text-ink sm:col-span-2">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
