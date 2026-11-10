import Link from "next/link";
import { formatMoney } from "@/lib/money/money";
import { CONFIDENCE_LABEL, DISCLAIMER_TEXT, DISCLAIMER_TITLE, ESTIMATE_METHOD_NOTE, METHOD_LABEL } from "@/lib/valuation/requester-copy";
import { DEMO_LABEL } from "@/lib/valuation/defaults";
import type { ValuationView } from "@/lib/valuation/view";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";
import { DemoTag, Disclaimer, Panel, linkClass } from "./ui";

/**
 * The estimate, range, confidence, method, factors, disclaimer and PDF link. Only rendered for the requester, and only
 * when a result exists. The demo tag shows when the reference data behind the number is demo data.
 */
export function ResultPanel({ view, factors, isDemo }: { view: ValuationView; factors: string[]; isDemo: boolean }) {
  const result = view.result;
  if (!result) return null;
  const currency = view.currency;
  const methodLabel = result.valuedBy === "EXPERT" ? METHOD_LABEL.EXPERT : METHOD_LABEL.AUTO;

  return (
    <div className="space-y-6">
      <Panel title="Your indicative estimate" id="estimate-heading">
        <div className="flex flex-wrap items-center gap-2">
          {isDemo ? <DemoTag label={DEMO_LABEL} /> : null}
          <span className="border border-line px-2.5 py-0.5 text-xs font-medium text-ink-soft">{methodLabel}</span>
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-ink-soft">Estimate</dt>
            <dd className="mt-1 font-heading text-2xl text-ink">{formatMoney(result.estimateMinor, currency)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Range</dt>
            <dd className="mt-1 text-lg font-medium text-ink">
              {formatMoney(result.lowMinor, currency)} to {formatMoney(result.highMinor, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Confidence</dt>
            <dd className="mt-1 text-lg font-medium text-ink">{CONFIDENCE_LABEL[result.confidence] ?? result.confidence}</dd>
          </div>
        </dl>
        <p className="text-sm text-ink-soft">
          Valued by: <span className="text-ink">{methodLabel}</span>
        </p>
        <Disclaimer title={DISCLAIMER_TITLE} text={DISCLAIMER_TEXT} />
      </Panel>

      {factors.length > 0 ? (
        <Panel title="Factors used" id="factors-heading">
          <p className="text-sm text-ink-soft">{ESTIMATE_METHOD_NOTE}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {factors.map((factor) => (
              <li key={factor}>{factor}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <a href={REQUESTER_PATHS.pdf(view.id)} download className={linkClass}>
          Download the PDF report
        </a>
        <Link href={REQUESTER_PATHS.verify(view.reference)} className="text-ink-soft underline underline-offset-4 hover:text-ink">
          Public verification page
        </Link>
      </div>
    </div>
  );
}
