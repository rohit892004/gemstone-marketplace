import { Suspense } from "react";
import { Users } from "lucide-react";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { TOPIC_LABELS, type NewsletterTopicName } from "@/lib/newsletter/topics";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { NewsletterNav } from "../nav";

export const metadata = { title: "Newsletter subscribers", robots: { index: false, follow: false } };

const STATUSES = ["ALL", "CONFIRMED", "PENDING", "UNSUBSCRIBED"] as const;
type StatusFilter = (typeof STATUSES)[number];

/**
 * Subscriber list. No IP addresses are shown or stored here: the consent log keeps only salted hashes,
 * and this page does not read it.
 */
export default async function SubscribersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: StatusFilter = (STATUSES as readonly string[]).includes(status ?? "") ? (status as StatusFilter) : "ALL";
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Content" title="Newsletter subscribers" />
      <NewsletterNav />
      <Tabs
        label="Filter by status"
        items={STATUSES.map((s) => ({
          href: s === "ALL" ? "/admin/newsletter/subscribers" : `/admin/newsletter/subscribers?status=${s}`,
          label: s.charAt(0) + s.slice(1).toLowerCase(),
          active: s === filter,
        }))}
      />
      <Suspense fallback={<p className="text-sm text-ink-soft">Loading subscribers...</p>}>
        <List filter={filter} />
      </Suspense>
    </div>
  );
}

type SubscriberRow = {
  email: string;
  status: string;
  topics: string[];
  source: string;
  confirmedAt: Date | null;
  createdAt: Date;
};

async function List({ filter }: { filter: StatusFilter }) {
  await requirePageRole(["ADMIN"]);
  const rows: SubscriberRow[] = await prisma.newsletterSubscriber.findMany({
    where: filter === "ALL" ? {} : { status: filter },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { email: true, status: true, topics: true, source: true, confirmedAt: true, createdAt: true },
  });
  if (rows.length === 0) {
    return <EmptyState icon={Users} title="No subscribers match this filter yet" body="Sign-ups from the newsletter form appear here once they arrive." />;
  }

  const columns: Column<SubscriberRow>[] = [
    { key: "email", header: "Email", cell: (row) => <span className="break-all">{row.email}</span> },
    { key: "status", header: "Status", cell: (row) => <span className="capitalize">{row.status.toLowerCase()}</span> },
    {
      key: "topics",
      header: "Topics",
      hideOnMobile: true,
      cell: (row) => row.topics.map((t) => TOPIC_LABELS[t as NewsletterTopicName]).join(", ") || "none",
    },
    { key: "source", header: "Source", hideOnMobile: true, cell: (row) => row.source },
    {
      key: "confirmed",
      header: "Confirmed",
      hideOnMobile: true,
      cell: (row) => <span className="tabular-nums">{row.confirmedAt ? row.confirmedAt.toISOString().slice(0, 10) : "not yet"}</span>,
    },
    { key: "signedUp", header: "Signed up", cell: (row) => <span className="tabular-nums">{row.createdAt.toISOString().slice(0, 10)}</span> },
  ];

  return <DataTable caption="Newsletter subscribers, newest first, up to 200" columns={columns} rows={rows} getRowKey={(row) => row.email} />;
}
