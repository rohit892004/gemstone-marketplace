import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequirementForm } from "@/components/requirements/requirement-form";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { getRequirementForBuyer } from "@/lib/requirements/service";
import { requirementFormDefaults } from "@/lib/requirements/validate";
import { getCatalogueFacets } from "@/lib/seller-public/facets";

type Props = { params: Promise<{ id: string }> };

export default function EditRequirementPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <EditRequirement params={params} />
    </Suspense>
  );
}

async function EditRequirement({ params }: Props) {
  const user = await requirePageRole(["BUYER"]);
  const { id } = await params;
  const requirement = await getRequirementForBuyer(user.id, id);
  if (!requirement) notFound();

  if (requirement.status !== "OPEN") {
    return (
      <EmptyState
        icon={ClipboardList}
        title="This requirement is closed"
        body="Closed requirements can't be edited. Post a new requirement instead."
        action={
          <ButtonLink href={`/buyer/requirements/${id}`} variant="secondary">
            Back to the requirement
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
          <Link href={`/buyer/requirements/${id}`} className="text-ink-soft hover:text-ink">
            {requirement.gemstoneType}
          </Link>{" "}
          <span className="text-ink-soft">/ Edit</span>
        </p>
        <h2 className="font-heading text-3xl text-ink">Edit requirement</h2>
      </div>
      <RequirementForm
        mode="edit"
        requirementId={requirement.id}
        initial={requirementFormDefaults(requirement)}
        categories={categories}
        gemstoneTypeOptions={facets.species}
        shapeOptions={facets.shapes}
      />
    </div>
  );
}
