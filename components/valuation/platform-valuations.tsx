import Link from "next/link";
import { publishedValuationsForListing } from "@/lib/valuation/service";
import { VALUATION_ROUTES } from "@/lib/valuation/routes";
import { demoReferencesForListing } from "@/lib/valuation/requester-queries";
import { CONFIDENCE_LABEL, DISCLAIMER_TEXT, METHOD_LABEL } from "@/lib/valuation/requester-copy";
import { DEMO_LABEL } from "@/lib/valuation/defaults";
import { DemoTag } from "./ui";

/**
 * "Platform indicative valuation" on a product page: completed reports the seller chose to publish on their own
 * listing. Shows the date, the method, the estimate and range. Never shows the requester.
 */
export async function PlatformValuations({ gemstoneId }: { gemstoneId: string }) {
  const [rows, demoRefs] = await Promise.all([publishedValuationsForListing(gemstoneId), demoReferencesForListing(gemstoneId)]);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="platform-valuation-heading" className="space-y-3">
      <h2 id="platform-valuation-heading" className="font-heading text-2xl text-ink">
        Platform indicative valuation – not a certified appraisal
      </h2>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.reference} className="space-y-2 border border-line bg-surface-raised p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-ink-soft">
                {row.completedAt
                  ? `Published ${row.completedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`
                  : "Published"}
              </p>
              <div className="flex flex-wrap gap-2">
                {demoRefs.has(row.reference) ? <DemoTag label={DEMO_LABEL} /> : null}
                <Link
                  href={VALUATION_ROUTES.verify(row.reference)}
                  className="border border-line px-2.5 py-0.5 text-xs font-medium text-brand underline"
                >
                  Verify ref. {row.reference}
                </Link>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2">
              <dt className="text-ink-soft">Estimate</dt>
              <dd className="col-span-2 font-medium text-ink">{row.estimateLabel ?? "Not available"}</dd>
              <dt className="text-ink-soft">Range</dt>
              <dd className="col-span-2 text-ink">{row.rangeLabel ?? "Not available"}</dd>
              <dt className="text-ink-soft">Confidence</dt>
              <dd className="col-span-2 text-ink">{CONFIDENCE_LABEL[row.confidence ?? ""] ?? "Not stated"}</dd>
              <dt className="text-ink-soft">Method</dt>
              <dd className="col-span-2 text-ink">{row.method === "EXPERT" ? METHOD_LABEL.EXPERT : METHOD_LABEL.AUTO}</dd>
            </dl>
            <p className="text-xs text-ink-soft">{DISCLAIMER_TEXT}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
