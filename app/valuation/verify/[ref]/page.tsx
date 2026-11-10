import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessMessage, Panel } from "@/components/valuation/ui";
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
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-accent">Verification</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Verify a valuation</h1>

      <div className="mt-8">
        {row ? (
          <VerificationResult view={verificationView(row)} />
        ) : (
          <AccessMessage title={VERIFY_NOT_FOUND_TITLE}>
            <p>{VERIFY_NOT_FOUND_TEXT}</p>
          </AccessMessage>
        )}
      </div>

      <p className="mt-8 text-sm text-ink-soft">
        This check confirms a reference only. It does not show the value. Indicative valuations are not certified appraisals.{" "}
        <Link href="/" className="text-brand-strong underline underline-offset-4">
          Gemstone Selections
        </Link>
      </p>
    </section>
  );
}

function VerificationResult({ view }: { view: VerificationView }) {
  const rows: [string, string][] = [
    ["Reference", view.reference],
    ["Date", view.date ? formatDate(view.date) : "Not yet"],
    ["Gemstone type", view.gemstoneType || "Not stated"],
    ["Status", VERIFY_STATUS_LABEL[view.status]],
    ["Method", view.method ? VERIFY_METHOD_LABEL[view.method] : "Not yet"],
  ];
  return (
    <Panel title="Reference found" id="verify-heading">
      <dl className="divide-y divide-line rounded-md border border-line text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-3 gap-3 px-4 py-2.5">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="col-span-2 font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
