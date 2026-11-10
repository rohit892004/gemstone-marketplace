import Link from "next/link";
import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { TOPIC_LABELS, type NewsletterTopicName } from "@/lib/newsletter/topics";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Mail } from "lucide-react";
import { NewsletterNav } from "../nav";

export const metadata = { title: "Newsletter campaigns", robots: { index: false, follow: false } };

export default function CampaignsPage() {
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Content" title="Newsletter campaigns" />
      <NewsletterNav />
      <Suspense fallback={<p className="text-sm text-ink-soft">Loading campaigns...</p>}>
        <List />
      </Suspense>
    </div>
  );
}

type CampaignRow = {
  id: string;
  subject: string;
  status: string;
  topics: string[];
  scheduledFor: Date | null;
  sentAt: Date | null;
  recipientCount: number;
};

async function List() {
  await requirePageRole(["ADMIN"]);
  const rows: CampaignRow[] = await prisma.newsletterCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, subject: true, status: true, topics: true, scheduledFor: true, sentAt: true, recipientCount: true },
  });
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No campaigns yet"
        body="Write the first issue of the newsletter, then schedule or send it."
        action={
          <Link href="/admin/newsletter/campaigns/new" className="inline-flex min-h-11 items-center justify-center bg-brand px-6 py-3 text-sm tracking-wide text-ivory hover:bg-[#2e2b26]">
            New campaign
          </Link>
        }
      />
    );
  }

  const columns: Column<CampaignRow>[] = [
    {
      key: "subject",
      header: "Subject",
      cell: (row) => (
        <Link href={`/admin/newsletter/campaigns/${row.id}`} className="font-heading text-lg text-ink underline underline-offset-4">
          {row.subject}
        </Link>
      ),
    },
    { key: "status", header: "Status", cell: (row) => <span className="capitalize">{row.status.toLowerCase()}</span> },
    { key: "topics", header: "Topics", hideOnMobile: true, cell: (row) => row.topics.map((t) => TOPIC_LABELS[t as NewsletterTopicName]).join(", ") },
    {
      key: "scheduled",
      header: "Scheduled (UTC)",
      hideOnMobile: true,
      cell: (row) => <span className="tabular-nums">{row.scheduledFor ? row.scheduledFor.toISOString().slice(0, 16).replace("T", " ") : "not scheduled"}</span>,
    },
    {
      key: "sent",
      header: "Sent",
      hideOnMobile: true,
      cell: (row) => <span className="tabular-nums">{row.sentAt ? row.sentAt.toISOString().slice(0, 16).replace("T", " ") : "not yet"}</span>,
    },
    { key: "recipients", header: "Recipients", align: "right", cell: (row) => <span className="tabular-nums">{row.recipientCount}</span> },
  ];

  return <DataTable caption="Campaigns, newest first, up to 100" columns={columns} rows={rows} getRowKey={(row) => row.id} />;
}
