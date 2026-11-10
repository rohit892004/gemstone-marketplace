import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { changeReferenceStatusAction, saveReferenceEntry } from "@/app/admin/content/actions";
import { ReferenceForm } from "@/components/admin/content/reference-form";
import { StatusPanel } from "@/components/admin/content/status-panel";
import { DemoNotice } from "@/components/content/content-ui";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { REFERENCE_SECTIONS } from "@/lib/content/reference-sections";
import type { ContentStatusName } from "@/lib/content/status";

export const metadata = { title: "Edit reference page", robots: { index: false, follow: false } };

export default function AdminReferenceEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <ReferenceEditor params={params} />
    </Suspense>
  );
}

async function ReferenceEditor({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(["ADMIN"]);
  const { id } = await params;
  const [entry, categories] = await Promise.all([
    prisma.referenceEntry.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  if (!entry) notFound();

  const sections = Object.fromEntries(REFERENCE_SECTIONS.map((s) => [s.key, entry[s.key]])) as Record<
    (typeof REFERENCE_SECTIONS)[number]["key"],
    string
  >;
  const isPublic = entry.status === "PUBLISHED";

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/admin/content" className="underline">
          Content
        </Link>{" "}
        / <span>{entry.name}</span>
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{entry.name} (reference page)</h1>
          <p className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
            <span>Slug: {entry.slug}</span>
            {entry.isDemo ? <DemoNotice /> : null}
          </p>
        </div>
        {isPublic ? (
          <Link href={`/reference/${entry.slug}`} className="text-sm underline" target="_blank" rel="noopener noreferrer">
            View on site<span className="sr-only"> (opens in a new tab)</span>
          </Link>
        ) : (
          <p className="text-sm text-stone-600">Not visible on the site yet.</p>
        )}
      </header>

      <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
        <ReferenceForm
          action={saveReferenceEntry}
          categories={categories}
          values={{
            id: entry.id,
            name: entry.name,
            categorySlug: entry.categorySlug,
            summary: entry.summary,
            hardness: entry.hardness ?? "",
            metaDescription: entry.metaDescription ?? "",
            sortOrder: entry.sortOrder,
            sections,
          }}
        />
        <aside className="space-y-6">
          <StatusPanel
            id={entry.id}
            status={entry.status as ContentStatusName}
            scheduledFor={null}
            action={changeReferenceStatusAction}
            canSchedule={false}
          />
        </aside>
      </div>
    </div>
  );
}
