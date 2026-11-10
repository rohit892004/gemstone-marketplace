import Link from "next/link";
import { Suspense } from "react";
import { RequirementForm } from "@/components/requirements/requirement-form";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import type { RequirementRaw } from "@/lib/requirements/validate";
import { getCatalogueFacets } from "@/lib/seller-public/facets";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

/**
 * A seller posting a requirement as a buyer. Sellers in matching categories are notified, except
 * this seller. Their own requirements are kept out of the board (see lib/requirements/board.ts).
 */
export default function SellerNewRequirementPage() {
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
  const state = await gateApprovedSeller();
  if (state !== "approved") return <AwaitingApprovalPage title="Post a requirement" />;
  await requireRole(["SELLER"], { sellerApproved: true });

  const [categories, facets] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getCatalogueFacets(),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/seller/requirements/mine" className="text-ink-soft hover:text-ink">
            Your requirements
          </Link>{" "}
          <span className="text-ink-soft">/ Post</span>
        </p>
        <h1 className="font-heading text-4xl text-ink">Post a requirement</h1>
        <p className="text-sm text-ink-soft">
          Post a stone you are looking for, as a buyer. Other approved sellers in matching categories are notified. Your own
          listings are not affected. You may post up to 5 requirements in 24 hours.
        </p>
      </div>
      <RequirementForm
        mode="create"
        sellerPoster
        initial={BLANK}
        categories={categories}
        gemstoneTypeOptions={facets.species}
        shapeOptions={facets.shapes}
      />
    </div>
  );
}
