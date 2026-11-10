import Link from "next/link";
import { Suspense } from "react";
import { saveReferenceEntry } from "@/app/admin/content/actions";
import { ReferenceForm } from "@/components/admin/content/reference-form";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";

export const metadata = { title: "New reference page", robots: { index: false, follow: false } };

export default function AdminNewReferencePage() {
  return (
    <Suspense fallback={null}>
      <NewReference />
    </Suspense>
  );
}

async function NewReference() {
  await requirePageRole(["ADMIN"]);
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } });
  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/admin/content" className="underline">
          Content
        </Link>{" "}
        / <span>New reference page</span>
      </nav>
      <h1 className="text-2xl font-semibold">New reference page</h1>
      <p className="text-sm text-stone-600">
        Every section is needed before the page can be published. The page starts as a draft.
      </p>
      <ReferenceForm
        action={saveReferenceEntry}
        categories={categories}
        values={{
          id: null,
          name: "",
          categorySlug: "",
          summary: "",
          hardness: "",
          metaDescription: "",
          sortOrder: 0,
          sections: { properties: "", origins: "", treatments: "", qualityGuide: "", care: "", priceFactors: "" },
        }}
      />
    </div>
  );
}
