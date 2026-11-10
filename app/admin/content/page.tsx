import Link from "next/link";
import { Suspense } from "react";
import { DemoNotice } from "@/components/content/content-ui";
import { formatDate } from "@/components/admin/admin-ui";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { CONTENT_STATUSES, type ContentStatusName } from "@/lib/content/status";

export const metadata = { title: "Content", robots: { index: false, follow: false } };

const FILTERS = ["ALL", ...CONTENT_STATUSES] as const;
type Filter = (typeof FILTERS)[number];

const KIND_LABELS: Record<string, string> = { EDUCATION: "Education", GUIDE: "Guide", RESEARCH: "Research", NEWS: "News", REFERENCE: "Reference page" };

const STATUS_TONES: Record<ContentStatusName, BadgeTone> = {
  DRAFT: "neutral",
  SCHEDULED: "accent",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

export default function AdminContentPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return (
    <Suspense fallback={null}>
      <ContentList searchParams={searchParams} />
    </Suspense>
  );
}

async function ContentList({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePageRole(["ADMIN"]);
  const { status: raw } = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(raw ?? "") ? (raw as Filter) : "ALL";
  const statusWhere = filter === "ALL" ? {} : { status: filter as ContentStatusName };

  const [articles, references] = await Promise.all([
    prisma.article.findMany({
      where: statusWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      select: { id: true, title: true, type: true, status: true, scheduledFor: true, publishedAt: true, updatedAt: true, isDemo: true },
    }),
    // Reference pages have no schedule, so they do not appear under "Scheduled".
    filter === "SCHEDULED"
      ? Promise.resolve([])
      : prisma.referenceEntry.findMany({
          where: statusWhere,
          orderBy: [{ updatedAt: "desc" }],
          take: 100,
          select: { id: true, name: true, status: true, publishedAt: true, updatedAt: true, isDemo: true },
        }),
  ]);

  const rows = [
    ...articles.map((a) => ({
      key: `article-${a.id}`,
      href: `/admin/content/${a.id}`,
      kind: KIND_LABELS[a.type] ?? a.type,
      title: a.title,
      status: a.status,
      when: a.status === "SCHEDULED" && a.scheduledFor ? `Publishes ${formatDate(a.scheduledFor)}` : a.publishedAt ? `Published ${formatDate(a.publishedAt)}` : `Updated ${formatDate(a.updatedAt)}`,
      isDemo: a.isDemo,
      updatedAt: a.updatedAt,
    })),
    ...references.map((r) => ({
      key: `reference-${r.id}`,
      href: `/admin/content/reference/${r.id}`,
      kind: KIND_LABELS.REFERENCE,
      title: r.name,
      status: r.status,
      when: r.publishedAt ? `Published ${formatDate(r.publishedAt)}` : `Updated ${formatDate(r.updatedAt)}`,
      isDemo: r.isDemo,
      updatedAt: r.updatedAt,
    })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const columns: Column<(typeof rows)[number]>[] = [
    { key: "kind", header: "Kind", cell: (row) => <span className="whitespace-nowrap">{row.kind}</span> },
    {
      key: "title",
      header: "Title",
      cell: (row) => (
        <div className="space-y-2">
          <Link href={row.href} className="font-heading text-lg text-ink underline-offset-4 hover:underline">
            {row.title}
          </Link>
          {row.isDemo ? (
            <div>
              <DemoNotice />
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <Badge tone={STATUS_TONES[row.status]}>{row.status.charAt(0) + row.status.slice(1).toLowerCase()}</Badge>,
    },
    { key: "dates", header: "Dates", hideOnMobile: true, cell: (row) => <span className="whitespace-nowrap text-ink-soft">{row.when}</span> },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Admin"
        title="Content"
        lead={
          <>
            Articles, news and gemstone reference pages. Demo items are marked &quot;Demo – needs expert review&quot;. Drafts and archived items are never
            shown on the public site.
          </>
        }
        actions={
          <>
            <ButtonLink href="/admin/content/new">New article or news</ButtonLink>
            <ButtonLink href="/admin/content/reference/new" variant="secondary">
              New reference page
            </ButtonLink>
          </>
        }
      />

      <Tabs
        label="Filter by status"
        items={FILTERS.map((option) => ({
          href: option === "ALL" ? "/admin/content" : `/admin/content?status=${option}`,
          label: option === "ALL" ? "All" : option.charAt(0) + option.slice(1).toLowerCase(),
          active: option === filter,
        }))}
      />

      <DataTable
        caption="Content"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.key}
        empty={<span>No content matches this filter.</span>}
      />
    </div>
  );
}
