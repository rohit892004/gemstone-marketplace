import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DEMO_LABEL } from "@/lib/valuation/defaults";
import { METHOD_LABEL, statusLabel } from "@/lib/valuation/requester-copy";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";
import { DemoTag, linkClass } from "./ui";

function dateLabel(date: Date | null | undefined): string {
  if (!date) return "Not yet";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Tone for a status badge. The words carry the meaning; the tone only supports them. */
function statusTone(status: string, withdrawn: boolean): BadgeTone {
  if (withdrawn) return "danger";
  if (status === "AUTO_VALUED" || status === "COMPLETED") return "accent";
  return "neutral";
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
  const columns: Column<ValuationRow>[] = [
    {
      key: "stone",
      header: "Gemstone",
      cell: (row) => (
        <div className="space-y-1">
          <p className="font-medium text-ink">{row.gemstoneType || "Gemstone"}</p>
          <p className="text-[13px] text-ink-soft">Ref. {row.reference}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      hideOnMobile: true,
      cell: (row) => <span className="text-ink-soft">{row.submittedAt ? `Submitted ${dateLabel(row.submittedAt)}` : `Started ${dateLabel(row.createdAt)}`}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <Badge tone={statusTone(row.status, row.withdrawnAt !== null)}>{statusLabel(row.status, row.withdrawnAt !== null)}</Badge>,
    },
    {
      key: "action",
      header: "Open",
      align: "right",
      cell: (row) => (
        <Link href={`${resultsHref}/${row.id}`} className={linkClass}>
          {row.status === "DRAFT" ? "Continue" : "View"}
          <span className="sr-only"> valuation {row.reference}</span>
        </Link>
      ),
    },
  ];
  return <DataTable caption="Your valuation requests" columns={columns} rows={rows} getRowKey={(row) => row.id} />;
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
  const columns: Column<SavedReportRow>[] = [
    {
      key: "report",
      header: "Report",
      cell: (row) => (
        <div className="space-y-1">
          <p className="font-medium text-ink">{row.gemstoneType || "Gemstone"}</p>
          <p className="text-[13px] text-ink-soft">
            Ref. {row.reference} · Completed {dateLabel(row.completedAt)}
          </p>
          {row.isDemo ? <DemoTag label={DEMO_LABEL} /> : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <div className="space-y-2">
          <Badge tone={statusTone(row.status, row.withdrawnAt !== null)}>{statusLabel(row.status, row.withdrawnAt !== null)}</Badge>
          <p className="text-[13px] text-ink-soft">{row.valuedBy === "EXPERT" ? METHOD_LABEL.EXPERT : METHOD_LABEL.AUTO}</p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Open",
      align: "right",
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-x-5 gap-y-1">
          <Link href={`${resultsHref}/${row.id}`} className="inline-flex min-h-11 items-center text-ink-soft underline underline-offset-4 hover:text-ink">
            View
          </Link>
          <a href={REQUESTER_PATHS.pdf(row.id)} download className={linkClass}>
            Download PDF
            <span className="sr-only"> for {row.reference}</span>
          </a>
        </div>
      ),
    },
  ];
  return <DataTable caption="Saved reports" columns={columns} rows={rows} getRowKey={(row) => row.id} />;
}
