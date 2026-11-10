import Link from "next/link";
import { Suspense } from "react";
import { DemoNotice } from "@/components/content/content-ui";
import { formatDate } from "@/components/admin/admin-ui";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { CONTENT_STATUSES, type ContentStatusName } from "@/lib/content/status";

export const metadata = { title: "Content", robots: { index: false, follow: false } };

const FILTERS = ["ALL", ...CONTENT_STATUSES] as const;
type Filter = (typeof FILTERS)[number];

const KIND_LABELS: Record<string, string> = { EDUCATION: "Education", GUIDE: "Guide", RESEARCH: "Research", NEWS: "News", REFERENCE: "Reference page" };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Content</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/content/new" className="rounded bg-stone-900 px-4 py-2 text-sm text-white">
            New article or news
          </Link>
          <Link href="/admin/content/reference/new" className="rounded border border-stone-400 px-4 py-2 text-sm">
            New reference page
          </Link>
        </div>
      </div>
      <p className="text-sm text-stone-600">
        Articles, news and gemstone reference pages. Demo items are marked &quot;Demo – needs expert review&quot;. Drafts and
        archived items are never shown on the public site.
      </p>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((option) => {
          const active = option === filter;
          return (
            <Link
              key={option}
              href={option === "ALL" ? "/admin/content" : `/admin/content?status=${option}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"}`}
            >
              {option === "ALL" ? "All" : option.charAt(0) + option.slice(1).toLowerCase()}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">No content matches this filter.</p>
      ) : (
        <div className="relative overflow-x-auto rounded border border-stone-300 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-300 bg-stone-50 text-xs uppercase tracking-wide text-stone-600">
              <tr>
                <th scope="col" className="px-3 py-2">Kind</th>
                <th scope="col" className="px-3 py-2">Title</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2">Dates</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-stone-200 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{row.kind}</td>
                  <td className="px-3 py-2">
                    <Link href={row.href} className="font-medium underline">
                      {row.title}
                    </Link>
                    {row.isDemo ? (
                      <div className="mt-1">
                        <DemoNotice />
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{row.status.charAt(0) + row.status.slice(1).toLowerCase()}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-stone-600">{row.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
