import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { changeArticleStatusAction, saveArticle, updateCoverAction } from "@/app/admin/content/actions";
import { ArticleForm } from "@/components/admin/content/article-form";
import { CoverForm } from "@/components/admin/content/cover-form";
import { StatusPanel } from "@/components/admin/content/status-panel";
import { DemoNotice } from "@/components/content/content-ui";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import type { ContentStatusName } from "@/lib/content/status";

export const metadata = { title: "Edit content", robots: { index: false, follow: false } };

export default function AdminArticleEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <ArticleEditor params={params} />
    </Suspense>
  );
}

async function ArticleEditor({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(["ADMIN"]);
  const { id } = await params;
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) notFound();

  const publicPath = article.type === "NEWS" ? `/news/${article.slug}` : `/education/${article.slug}`;
  const isPublic = article.status === "PUBLISHED" && article.publishedAt !== null && article.publishedAt <= new Date();

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/admin/content" className="underline">
          Content
        </Link>{" "}
        / <span>{article.title}</span>
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{article.title}</h1>
          <p className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
            <span>Slug: {article.slug}</span>
            {article.isDemo ? <DemoNotice /> : null}
          </p>
        </div>
        {isPublic ? (
          <Link href={publicPath} className="text-sm underline" target="_blank" rel="noopener noreferrer">
            View on site<span className="sr-only"> (opens in a new tab)</span>
          </Link>
        ) : (
          <p className="text-sm text-stone-600">Not visible on the site yet.</p>
        )}
      </header>

      <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
        <ArticleForm
          action={saveArticle}
          values={{
            id: article.id,
            type: article.type,
            title: article.title,
            summary: article.summary ?? "",
            body: article.body,
            tags: article.tags,
            category: article.category ?? "",
            sourceName: article.sourceName ?? "",
            sourceUrl: article.sourceUrl ?? "",
            coverAlt: article.coverAlt ?? "",
            metaDescription: article.metaDescription ?? "",
          }}
        />
        <aside className="space-y-6">
          <StatusPanel
            id={article.id}
            status={article.status as ContentStatusName}
            scheduledFor={article.scheduledFor?.toISOString() ?? null}
            action={changeArticleStatusAction}
            canSchedule
          />
          <CoverForm id={article.id} coverKey={article.coverKey} coverAlt={article.coverAlt} action={updateCoverAction} />
        </aside>
      </div>
    </div>
  );
}
