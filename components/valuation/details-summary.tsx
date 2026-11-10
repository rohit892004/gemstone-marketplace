import { QUALITY_GRADE_LABELS, type QualityGrade } from "@/lib/valuation/engine";
import type { ValuationView } from "@/lib/valuation/view";

/** Read-only summary of the stone details. Used on the review step and on the result page. */
export function DetailsSummary({ view }: { view: ValuationView }) {
  const rows: [string, string | null][] = [
    ["Gemstone type", view.gemstoneType || null],
    ["Category", view.categoryName],
    ["Shape or cut", view.shape],
    ["Carat weight", view.caratMilli !== null ? `${(view.caratMilli / 1000).toFixed(3)} ct` : null],
    ["Dimensions", view.dimensions],
    ["Colour", view.colour],
    ["Clarity", view.clarity],
    ["Overall quality", view.qualityGrade ? (QUALITY_GRADE_LABELS[view.qualityGrade as QualityGrade] ?? view.qualityGrade) : null],
    ["Origin", view.origin],
    ["Treatment", view.treatment],
    ["Certificate lab", view.labName],
    ["Certificate number", view.certificateNumber],
    ["Currency", view.currency],
    ["Notes", view.notes],
  ];
  return (
    <dl className="divide-y divide-line rounded-lg border border-line bg-surface-raised text-sm">
      {rows
        .filter((row): row is [string, string] => !!row[1])
        .map(([label, value]) => (
          <div key={label} className="grid grid-cols-3 gap-3 px-4 py-2.5">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="col-span-2 whitespace-pre-line text-ink">{value}</dd>
          </div>
        ))}
    </dl>
  );
}
