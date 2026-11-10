import Link from "next/link";
import { Suspense } from "react";
import { Flag } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminDemoTag, formatDate } from "@/components/admin/admin-ui";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
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

const STATUS_TONES: Record<string, BadgeTone> = { OPEN: "warning", RESOLVED: "success", DISMISSED: "neutral" };

const LABEL = "text-[11px] uppercase tracking-[0.18em] text-ink-soft";

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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Queue"
        title="Reports"
        lead="Reports filed by users about a conversation or message. Resolving or dismissing needs a note."
      />

      <Tabs
        label="Filter reports"
        items={REPORT_FILTERS.map((value) => ({
          href: `/admin/reports?status=${value}`,
          label: FILTER_LABELS[value],
          active: value === filter,
        }))}
      />

      {reports.length === 0 ? (
        <EmptyState icon={Flag} title="No reports in this view" body="Reports from members appear here. Try another filter to see closed reports." />
      ) : (
        <ul className="space-y-6">
          {reports.map((report) => {
            const reportedText = report.messageId ? bodyById.get(report.messageId) : null;
            return (
              <li key={report.id}>
                <Card className="space-y-6 p-5 text-sm sm:p-8">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="font-heading text-xl text-ink">{REPORT_REASON_LABELS[report.reason]}</span>
                    <Badge tone={STATUS_TONES[report.status] ?? "neutral"}>{REPORT_STATUS_LABELS[report.status]}</Badge>
                    <span className="text-ink-soft">Filed {formatDate(report.createdAt)}</span>
                    {report.conversation?.isDemo ? <AdminDemoTag /> : null}
                  </div>

                  <p className="text-[15px] text-ink">
                    Reported by {report.reporter.name ?? "Unnamed user"} ({report.reporter.role.toLowerCase()})
                    <span className="block break-all text-ink-soft">{report.reporter.email}</span>
                  </p>

                  {report.details ? (
                    <div className="space-y-2">
                      <p className={LABEL}>Details from the reporter</p>
                      <p className="whitespace-pre-wrap break-words border border-line bg-surface p-4 text-[15px] leading-relaxed text-ink">{report.details}</p>
                    </div>
                  ) : null}

                  {reportedText ? (
                    <div className="space-y-2">
                      <p className={LABEL}>Reported message (masked)</p>
                      <p className="whitespace-pre-wrap break-words border border-line bg-surface p-4 text-[15px] leading-relaxed text-ink">{reportedText}</p>
                    </div>
                  ) : null}

                  {report.conversationId ? (
                    <Link
                      href={`/admin/conversations/${report.conversationId}`}
                      prefetch={false}
                      className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4 hover:text-accent-text"
                    >
                      Open the conversation (logged with a reason)
                    </Link>
                  ) : (
                    <p className="text-sm text-ink-soft">The conversation was deleted.</p>
                  )}

                  {report.status === "OPEN" ? (
                    <div className="grid gap-6 md:grid-cols-2">
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
                    <div className="space-y-2 border-t border-line pt-5">
                      <p className="font-medium text-ink">Resolution note</p>
                      <p className="whitespace-pre-wrap break-words leading-relaxed text-ink">{report.resolutionNote ?? "-"}</p>
                      <p className="text-ink-soft">
                        {report.resolvedBy?.email ? `By ${report.resolvedBy.email}` : ""}
                        {report.resolvedAt ? ` on ${formatDate(report.resolvedAt)}` : ""}
                      </p>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
