import Link from "next/link";
import { Suspense } from "react";
import { ClipboardList } from "lucide-react";
import { formatDate } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageRole } from "@/lib/auth/require-role";
import { formatCarat, statusLabel } from "@/lib/valuation/display";
import { loadValuatorQueue, expertReasonLabel } from "@/lib/valuation/valuator-queue";
import { VALUATION_ROUTES } from "@/lib/valuation/routes";

export const metadata = { title: "My queue" };

export default function ValuatorQueuePage() {
  return (
    <Suspense fallback={null}>
      <QueueList />
    </Suspense>
  );
}

type QueueRow = Awaited<ReturnType<typeof loadValuatorQueue>>[number];

/** Only the stone and status fields are loaded. The requester is never part of this page. */
async function QueueList() {
  const user = await requirePageRole(["VALUATOR"]);
  const rows = await loadValuatorQueue(user.id);

  const columns: Column<QueueRow>[] = [
    { key: "reference", header: "Reference", cell: (row) => <span className="font-mono text-[13px]">{row.reference}</span> },
    { key: "gemstone", header: "Gemstone", cell: (row) => row.gemstoneType },
    { key: "carat", header: "Carat", cell: (row) => formatCarat(row.caratMilli) },
    { key: "status", header: "Status", cell: (row) => <Badge tone="accent">{statusLabel(row.status)}</Badge> },
    { key: "submitted", header: "Submitted", hideOnMobile: true, cell: (row) => <span className="whitespace-nowrap">{formatDate(row.submittedAt)}</span> },
    {
      key: "why",
      header: "Why it is here",
      hideOnMobile: true,
      cell: (row) => (row.expertReasons.length === 0 ? "-" : row.expertReasons.map((r) => expertReasonLabel(r)).join("; ")),
    },
    {
      key: "open",
      header: "Open",
      align: "right",
      cell: (row) => (
        <Link
          href={VALUATION_ROUTES.valuatorDetail(row.id)}
          className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:text-accent-text"
        >
          Open<span className="sr-only"> {row.reference}</span>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Valuer workspace"
        title="My queue"
        lead="Requests assigned to you that need an expert decision or an answer. Open a request to review it."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nothing is waiting for you right now"
          body="New requests assigned to you appear here. Check back later."
        />
      ) : (
        <DataTable caption="Requests assigned to you" columns={columns} rows={rows} getRowKey={(row) => row.id} />
      )}
    </div>
  );
}
