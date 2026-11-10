import Link from "next/link";
import { Suspense } from "react";
import { RequirementForm } from "@/components/requirements/requirement-form";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import type { RequirementRaw } from "@/lib/requirements/validate";
import { getCatalogueFacets } from "@/lib/seller-public/facets";

export default function NewRequirementPage() {
  return (
    <Suspense fallback={null}>
      <NewRequirement />
    </Suspense>
  );
}

const BLANK: RequirementRaw = {
  gemstoneType: "",
  categoryId: "",
  shape: "",
  caratMin: "",
  caratMax: "",
  budgetMin: "",
  budgetMax: "",
  currency: "INR",
  certificateNeeded: null,
  originPreference: "",
  quantity: "1",
  deadline: "",
  notes: "",
};

async function NewRequirement() {
  await requirePageRole(["BUYER"]);
  const [categories, facets] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getCatalogueFacets(),
  ]);

  return (
    <div className="max-w-3xl space-y-10">
      <div className="space-y-3">
        <p className="text-sm">
          <Link href="/buyer/requirements" className="text-ink-soft underline underline-offset-4 hover:text-ink">
            Requirements
          </Link>{" "}
          <span className="text-ink-soft">/ Post</span>
        </p>
        <h2 className="font-heading text-3xl text-ink">Post a requirement</h2>
        <p className="text-sm text-ink-soft">
          Sellers in matching categories are notified. You can edit or close the requirement at any time. You may post up to 5
          requirements in 24 hours.
        </p>
      </div>
      <RequirementForm
        mode="create"
        initial={BLANK}
        categories={categories}
        gemstoneTypeOptions={facets.species}
        shapeOptions={facets.shapes}
      />
    </div>
  );
}
