import Link from "next/link";
import type { ReactNode } from "react";
import { DEMO_LABEL } from "@/lib/valuation/defaults";
import { METHOD_LABEL, statusLabel } from "@/lib/valuation/requester-copy";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";
import { DemoTag, linkClass } from "./ui";

function dateLabel(date: Date | null | undefined): string {
  if (!date) return "Not yet";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export interface ValuationRow {
  id: string;
  reference: string;
  gemstoneType: string;
  status: string;
  withdrawnAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
}

/** The viewer's requests. Each row links to its result page. */
export function ValuationList({ rows, resultsHref, empty }: { rows: ValuationRow[]; resultsHref: string; empty: ReactNode }) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <ul className="divide-y divide-line border border-line bg-surface-raised" aria-label="Your valuation requests">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-ink">{row.gemstoneType || "Gemstone"}</p>
            <p className="text-sm text-ink-soft">
              Ref. {row.reference} · {row.submittedAt ? `Submitted ${dateLabel(row.submittedAt)}` : `Started ${dateLabel(row.createdAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="border border-line px-2.5 py-0.5 text-xs font-medium text-ink-soft">
              {statusLabel(row.status, row.withdrawnAt !== null)}
            </span>
            <Link href={`${resultsHref}/${row.id}`} className={linkClass}>
              {row.status === "DRAFT" ? "Continue" : "View"}
              <span className="sr-only"> valuation {row.reference}</span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface SavedReportRow {
  id: string;
  reference: string;
  gemstoneType: string;
  status: string;
  valuedBy: "AUTO" | "EXPERT" | null;
  completedAt: Date | null;
  withdrawnAt: Date | null;
  isDemo: boolean;
}

/** Completed and withdrawn reports, with the PDF. The PDF stays downloadable after withdrawal. */
export function SavedReportList({ rows, resultsHref, empty }: { rows: SavedReportRow[]; resultsHref: string; empty: ReactNode }) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <ul className="divide-y divide-line border border-line bg-surface-raised" aria-label="Saved reports">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-ink">{row.gemstoneType || "Gemstone"}</p>
            <p className="text-sm text-ink-soft">
              Ref. {row.reference} · Completed {dateLabel(row.completedAt)}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="border border-line px-2.5 py-0.5 font-medium text-ink-soft">{statusLabel(row.status, row.withdrawnAt !== null)}</span>
              <span className="text-ink-soft">{row.valuedBy === "EXPERT" ? METHOD_LABEL.EXPERT : METHOD_LABEL.AUTO}</span>
              {row.isDemo ? <DemoTag label={DEMO_LABEL} /> : null}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href={`${resultsHref}/${row.id}`} className="text-ink-soft underline underline-offset-4 hover:text-ink">
              View
            </Link>
            <a href={REQUESTER_PATHS.pdf(row.id)} download className={linkClass}>
              Download PDF
              <span className="sr-only"> for {row.reference}</span>
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
