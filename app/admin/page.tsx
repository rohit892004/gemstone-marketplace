import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { TriangleAlert, ClipboardList, FileText, Flag, Gem, MessageSquare, Star, Users } from "lucide-react";
import type { ApprovalStatus } from "@/app/generated/prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, StatTile } from "@/components/ui/card";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardStats />
    </Suspense>
  );
}

const STATUSES: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

const ICON = "h-5 w-5";

interface QueueItem {
  href: string;
  label: string;
  count: number;
  icon: ReactNode;
  /** Pending work is shown as a warning badge; an empty queue is neutral. */
  tone: BadgeTone;
  note: string;
}

async function DashboardStats() {
  await requirePageRole(["ADMIN"]);

  // Cheap aggregates: seller statuses, buyers, and the three moderation queues.
  const [groups, buyerCount, listingsPending, documentsPending, reviewsPending, flagsOpen, reportsOpen] =
    await Promise.all([
      prisma.sellerProfile.groupBy({ by: ["approvalStatus"], _count: { _all: true } }),
      prisma.user.count({ where: { role: "BUYER" } }),
      prisma.gemstone.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.listingDocument.count({ where: { verificationStatus: "PENDING" } }),
      prisma.review.count({ where: { status: "PENDING" } }),
      prisma.moderationFlag.count({ where: { status: "OPEN" } }),
      prisma.report.count({ where: { status: "OPEN" } }),
    ]);

  const sellerCounts: Record<ApprovalStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, SUSPENDED: 0 };
  for (const group of groups) sellerCounts[group.approvalStatus] = group._count._all;

  const queues: QueueItem[] = [
    { href: "/admin/listings", label: "Listings pending review", count: listingsPending, icon: <Gem className={ICON} strokeWidth={1.25} aria-hidden />, tone: listingsPending > 0 ? "warning" : "neutral", note: "Check before publishing" },
    { href: "/admin/documents", label: "Documents pending", count: documentsPending, icon: <FileText className={ICON} strokeWidth={1.25} aria-hidden />, tone: documentsPending > 0 ? "warning" : "neutral", note: "Verify certificates and IDs" },
    { href: "/admin/reviews", label: "Reviews pending", count: reviewsPending, icon: <Star className={ICON} strokeWidth={1.25} aria-hidden />, tone: reviewsPending > 0 ? "warning" : "neutral", note: "Approve or reject buyer reviews" },
    { href: "/admin/moderation", label: "Flagged messages open", count: flagsOpen, icon: <MessageSquare className={ICON} strokeWidth={1.25} aria-hidden />, tone: flagsOpen > 0 ? "danger" : "neutral", note: "Messages flagged by the filter" },
    { href: "/admin/reports?status=OPEN", label: "Reports open", count: reportsOpen, icon: <Flag className={ICON} strokeWidth={1.25} aria-hidden />, tone: reportsOpen > 0 ? "danger" : "neutral", note: "Reports from members" },
  ];

  const pendingSellers = sellerCounts.PENDING;

  return (
    <div className="space-y-12">
      <PageHeader eyebrow="Admin" title="Dashboard" lead="Sellers, listings and moderation at a glance. Start with the queues that have work waiting." />

      <section aria-labelledby="sellers-heading" className="space-y-6">
        <h2 id="sellers-heading" className="sr-only">
          Sellers
        </h2>
        <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-5">
          {STATUSES.map((status) => (
            <Link
              key={status}
              href={`/admin/sellers?status=${status}`}
              className="block bg-surface-raised transition duration-300 hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            >
              <StatTile
                className="h-full border-0"
                label={`Sellers, ${status.toLowerCase()}`}
                value={sellerCounts[status]}
                icon={<Users className={ICON} strokeWidth={1.25} aria-hidden />}
                note={<Badge tone={status === "PENDING" ? "warning" : status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : "neutral"}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>}
              />
            </Link>
          ))}
          <div className="bg-surface-raised">
            <StatTile className="h-full border-0" label="Buyers" value={buyerCount} icon={<ClipboardList className={ICON} strokeWidth={1.25} aria-hidden />} />
          </div>
        </div>
        {pendingSellers > 0 ? (
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <p className="flex items-center gap-3 text-[15px] text-ink">
              <TriangleAlert className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.25} aria-hidden />
              {pendingSellers} seller application{pendingSellers === 1 ? "" : "s"} waiting for a decision.
            </p>
            <ButtonLink href="/admin/sellers?status=PENDING" variant="secondary">
              Review {pendingSellers} pending seller application{pendingSellers === 1 ? "" : "s"}
            </ButtonLink>
          </Card>
        ) : null}
      </section>

      <section aria-labelledby="queues-heading" className="space-y-6">
        <SectionHeading eyebrow="Work queues" title="What needs attention" />
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
          {queues.map((queue) => (
            <li key={queue.href} className="bg-surface-raised">
              <Link
                href={queue.href}
                className="flex h-full min-h-11 items-start gap-4 p-5 transition duration-300 hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:p-6"
              >
                <span className="text-accent">{queue.icon}</span>
                <span className="flex-1 space-y-3">
                  <span className="block text-[11px] uppercase tracking-[0.2em] text-ink-soft">{queue.label}</span>
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="font-heading text-3xl text-ink tabular-nums">{queue.count}</span>
                    <Badge tone={queue.tone}>{queue.count > 0 ? "Waiting" : "Clear"}</Badge>
                  </span>
                  <span className="block text-[12px] text-ink-soft">{queue.note}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
