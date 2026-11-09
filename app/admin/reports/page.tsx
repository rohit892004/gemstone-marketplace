import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { formatDate } from "@/components/admin/admin-ui";
import { DemoBadge } from "@/components/catalogue/badges";
import { firstParam, parseReportFilter, REPORT_FILTERS, type ReportFilter } from "@/lib/admin-moderation/filters";
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from "@/lib/admin-moderation/labels";
import { RESTRICTION_DAYS } from "@/lib/admin-moderation/restriction";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { resolveReport } from "./actions";

export const metadata = { title: "Reports", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AdminReportsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <ReportQueue searchParams={searchParams} />
    </Suspense>
  );
}

const FILTER_LABELS: Record<ReportFilter, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
  all: "All",
};

async function ReportQueue({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(["ADMIN"]);
  const params = await searchParams;
  const filter = parseReportFilter(firstParam(params.status));

  const open = filter === "OPEN";
  const reports = await prisma.report.findMany({
    where: filter === "all" ? {} : { status: filter },
    // Open reports oldest first, so none waits forever. Closed reports newest first.
    orderBy: { createdAt: open ? "asc" : "desc" },
    take: 100,
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      resolutionNote: true,
      resolvedAt: true,
      createdAt: true,
      conversationId: true,
      messageId: true,
      reporter: { select: { name: true, email: true, role: true } },
      conversation: { select: { isDemo: true } },
      resolvedBy: { select: { email: true } },
    },
  });

  const messageIds = reports.map((r) => r.messageId).filter((id): id is string => id !== null);
  const messages =
    messageIds.length > 0
      ? await prisma.message.findMany({ where: { id: { in: messageIds } }, select: { id: true, body: true } })
      : [];
  const bodyById = new Map(messages.map((m) => [m.id, m.body]));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-stone-600">
          Reports filed by users about a conversation or message. Resolving or dismissing needs a note.
        </p>
      </header>

      <nav aria-label="Filter reports" className="flex flex-wrap gap-2 text-sm">
        {REPORT_FILTERS.map((value) => (
          <Link
            key={value}
            href={`/admin/reports?status=${value}`}
            aria-current={value === filter ? "page" : undefined}
            className={`rounded border px-3 py-1 ${
              value === filter ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"
            }`}
          >
            {FILTER_LABELS[value]}
          </Link>
        ))}
      </nav>

      {reports.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          No reports in this view.
        </p>
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => {
            const reportedText = report.messageId ? bodyById.get(report.messageId) : null;
            return (
              <li key={report.id} className="space-y-4 rounded border border-stone-300 bg-white p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{REPORT_REASON_LABELS[report.reason]}</span>
                  <span className="rounded bg-stone-200 px-2 py-0.5 text-xs">{REPORT_STATUS_LABELS[report.status]}</span>
                  <span className="text-stone-600">Filed {formatDate(report.createdAt)}</span>
                  {report.conversation?.isDemo ? <DemoBadge /> : null}
                </div>

                <p className="text-sm">
                  Reported by {report.reporter.name ?? "Unnamed user"} ({report.reporter.role.toLowerCase()})
                  <span className="block break-all text-stone-600">{report.reporter.email}</span>
                </p>

                {report.details ? (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-stone-600">Details from the reporter</p>
                    <p className="whitespace-pre-wrap break-words rounded bg-stone-100 p-3 text-sm">{report.details}</p>
                  </div>
                ) : null}

                {reportedText ? (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-stone-600">Reported message (masked)</p>
                    <p className="whitespace-pre-wrap break-words rounded bg-stone-100 p-3 text-sm">{reportedText}</p>
                  </div>
                ) : null}

                {report.conversationId ? (
                  <Link
                    href={`/admin/conversations/${report.conversationId}`}
                    prefetch={false}
                    className="inline-block text-sm underline"
                  >
                    Open the conversation (logged with a reason)
                  </Link>
                ) : (
                  <p className="text-sm text-stone-600">The conversation was deleted.</p>
                )}

                {report.status === "OPEN" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <ActionForm
                      action={resolveReport}
                      title="Resolve"
                      description="Action taken. The note is kept with the report."
                      submitLabel="Resolve report"
                      hidden={{ reportId: report.id, decision: "RESOLVE" }}
                      fields={[
                        {
                          name: "note",
                          label: "Resolution note (10 to 500 characters)",
                          kind: "textarea",
                          required: true,
                          maxLength: 500,
                        },
                        ...(report.conversationId
                          ? [
                              {
                                name: "restrict",
                                label: `Also restrict the reported user's messaging for ${RESTRICTION_DAYS} days`,
                                kind: "checkbox" as const,
                                help: "Only applies when there is one clear reported user.",
                              },
                            ]
                          : []),
                      ]}
                    />
                    <ActionForm
                      action={resolveReport}
                      title="Dismiss"
                      description="No action needed. The note explains why."
                      submitLabel="Dismiss report"
                      hidden={{ reportId: report.id, decision: "DISMISS" }}
                      fields={[
                        {
                          name: "note",
                          label: "Resolution note (10 to 500 characters)",
                          kind: "textarea",
                          required: true,
                          maxLength: 500,
                        },
                      ]}
                    />
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">Resolution note</p>
                    <p className="whitespace-pre-wrap break-words text-stone-700">{report.resolutionNote ?? "-"}</p>
                    <p className="text-stone-600">
                      {report.resolvedBy?.email ? `By ${report.resolvedBy.email}` : ""}
                      {report.resolvedAt ? ` on ${formatDate(report.resolvedAt)}` : ""}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
