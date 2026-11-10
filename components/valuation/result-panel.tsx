import Link from "next/link";
import { formatMoney } from "@/lib/money/money";
import { CONFIDENCE_LABEL, DISCLAIMER_TEXT, DISCLAIMER_TITLE, ESTIMATE_METHOD_NOTE, METHOD_LABEL } from "@/lib/valuation/requester-copy";
import { DEMO_LABEL } from "@/lib/valuation/defaults";
import type { ValuationView } from "@/lib/valuation/view";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/card";
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
    <div className="space-y-8">
      <Panel title="Your indicative estimate" id="estimate-heading">
        <div className="flex flex-wrap items-center gap-3">
          {isDemo ? <DemoTag label={DEMO_LABEL} /> : null}
          <Badge tone={result.valuedBy === "EXPERT" ? "verified" : "neutral"}>{methodLabel}</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Estimate" value={formatMoney(result.estimateMinor, currency)} />
          <StatTile label="Range" value={`${formatMoney(result.lowMinor, currency)} to ${formatMoney(result.highMinor, currency)}`} />
          <StatTile label="Confidence" value={CONFIDENCE_LABEL[result.confidence] ?? result.confidence} />
        </div>
        <p className="text-sm text-ink-soft">
          Valued by: <span className="text-ink">{methodLabel}</span>
        </p>
        <Disclaimer title={DISCLAIMER_TITLE} text={DISCLAIMER_TEXT} />
      </Panel>

      {factors.length > 0 ? (
        <Panel title="Factors used" id="factors-heading">
          <p className="text-sm leading-relaxed text-ink-soft">{ESTIMATE_METHOD_NOTE}</p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-ink">
            {factors.map((factor) => (
              <li key={factor}>{factor}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <a href={REQUESTER_PATHS.pdf(view.id)} download className={linkClass}>
          Download the PDF report
        </a>
        <Link href={REQUESTER_PATHS.verify(view.reference)} className="inline-flex min-h-11 items-center text-ink-soft underline underline-offset-4 hover:text-ink">
          Public verification page
        </Link>
      </div>
    </div>
  );
}
