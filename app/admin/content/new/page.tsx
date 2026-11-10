import Link from "next/link";
import { Suspense } from "react";
import { saveArticle } from "@/app/admin/content/actions";
import { ArticleForm } from "@/components/admin/content/article-form";
import { requirePageRole } from "@/lib/auth/require-role";

export const metadata = { title: "New article", robots: { index: false, follow: false } };

export default function AdminNewArticlePage() {
  return (
    <Suspense fallback={null}>
      <NewArticle />
    </Suspense>
  );
}

async function NewArticle() {
  await requirePageRole(["ADMIN"]);
  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/admin/content" className="underline">
          Content
        </Link>{" "}
        / <span>New article</span>
      </nav>
      <h1 className="text-2xl font-semibold">New article or news</h1>
      <p className="text-sm text-stone-600">
        The item starts as a draft. You can add a cover image and change the status after the first save.
      </p>
      <ArticleForm
        action={saveArticle}
        values={{
          id: null,
          type: "EDUCATION",
          title: "",
          summary: "",
          body: "",
          tags: [],
          category: "",
          sourceName: "",
          sourceUrl: "",
          coverAlt: "",
          metaDescription: "",
        }}
      />
    </div>
  );
}
