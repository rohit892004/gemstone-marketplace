import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequirementForm } from "@/components/requirements/requirement-form";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { getRequirementForBuyer } from "@/lib/requirements/service";
import { requirementFormDefaults } from "@/lib/requirements/validate";
import { getCatalogueFacets } from "@/lib/seller-public/facets";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

type Props = { params: Promise<{ id: string }> };

/** A seller edits a requirement they posted as a buyer. Same validation and moderation as buyers. */
export default function SellerEditRequirementPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <EditRequirement params={params} />
    </Suspense>
  );
}

async function EditRequirement({ params }: Props) {
  const state = await gateApprovedSeller();
  if (state !== "approved") return <AwaitingApprovalPage title="Edit requirement" />;
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const { id } = await params;
  // Scoped to the poster: another seller's requirement is not found here.
  const requirement = await getRequirementForBuyer(user.id, id);
  if (!requirement) notFound();

  if (requirement.status !== "OPEN") {
    return (
      <EmptyState
        icon={ClipboardList}
        title="This requirement is closed"
        body="Closed requirements can't be edited. Post a new requirement instead."
        action={
          <ButtonLink href="/seller/requirements/mine" variant="secondary">
            Back to your requirements
          </ButtonLink>
        }
      />
    );
  }

  const [categories, facets] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getCatalogueFacets(),
  ]);

  return (
    <div className="max-w-3xl space-y-10">
      <div className="space-y-3">
        <p className="text-sm">
          <Link href="/seller/requirements/mine" className="text-ink-soft hover:text-ink">
            Your requirements
          </Link>{" "}
          <span className="text-ink-soft">/ Edit</span>
        </p>
        <h1 className="font-heading text-4xl text-ink">Edit requirement</h1>
      </div>
      <RequirementForm
        mode="edit"
        sellerPoster
        requirementId={requirement.id}
        initial={requirementFormDefaults(requirement)}
        categories={categories}
        gemstoneTypeOptions={facets.species}
        shapeOptions={facets.shapes}
      />
    </div>
  );
}
