import Link from "next/link";
import { publishedValuationsForListing } from "@/lib/valuation/service";
import { VALUATION_ROUTES } from "@/lib/valuation/routes";
import { demoReferencesForListing } from "@/lib/valuation/requester-queries";
import { CONFIDENCE_LABEL, DISCLAIMER_TEXT, METHOD_LABEL } from "@/lib/valuation/requester-copy";
import { DEMO_LABEL } from "@/lib/valuation/defaults";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DemoTag } from "./ui";

/**
 * "Platform indicative valuation" on a product page: completed reports the seller chose to publish on their own
 * listing. Shows the date, the method, the estimate and range. Never shows the requester.
 */
export async function PlatformValuations({ gemstoneId }: { gemstoneId: string }) {
  const [rows, demoRefs] = await Promise.all([publishedValuationsForListing(gemstoneId), demoReferencesForListing(gemstoneId)]);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="platform-valuation-heading" className="space-y-8 border-t border-line pt-12">
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.28em] text-accent-text">Valuation</p>
        <h2 id="platform-valuation-heading" className="font-heading text-3xl font-medium leading-tight text-ink">
          Platform indicative valuation – not a certified appraisal
        </h2>
      </div>
      <ul className="grid gap-6 md:grid-cols-2">
        {rows.map((row) => (
          <li key={row.reference}>
            <Card as="article" className="flex h-full flex-col gap-5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                  {row.completedAt
                    ? `Published ${row.completedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`
                    : "Published"}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {demoRefs.has(row.reference) ? <DemoTag label={DEMO_LABEL} /> : null}
                  <Badge tone="verified">Indicative</Badge>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="space-y-1">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">Estimate</dt>
                  <dd className="font-heading text-2xl text-ink">{row.estimateLabel ?? "Not available"}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">Range</dt>
                  <dd className="text-ink">{row.rangeLabel ?? "Not available"}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">Confidence</dt>
                  <dd className="text-ink">{CONFIDENCE_LABEL[row.confidence ?? ""] ?? "Not stated"}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">Method</dt>
                  <dd className="text-ink">{row.method === "EXPERT" ? METHOD_LABEL.EXPERT : METHOD_LABEL.AUTO}</dd>
                </div>
              </dl>
              <p className="text-[13px] leading-relaxed text-ink-soft">{DISCLAIMER_TEXT}</p>
              <div className="mt-auto">
                <Link
                  href={VALUATION_ROUTES.verify(row.reference)}
                  className="inline-flex min-h-11 items-center text-sm text-brand-strong underline underline-offset-4 hover:text-accent-text"
                >
                  Verify ref. {row.reference}
                </Link>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
