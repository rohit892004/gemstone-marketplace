import Link from "next/link";
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
      <div className="max-w-3xl rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
        <h2 className="text-lg font-semibold text-ink">This requirement is closed</h2>
        <p className="mt-2 text-sm text-ink-soft">Closed requirements can&apos;t be edited. Post a new requirement instead.</p>
        <Link href={`/buyer/requirements/${id}`} className="mt-4 inline-block text-sm font-medium text-brand-strong underline underline-offset-4">
          Back to the requirement
        </Link>
      </div>
    );
  }

  const [categories, facets] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getCatalogueFacets(),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href={`/buyer/requirements/${id}`} className="text-ink-soft hover:text-ink">
            {requirement.gemstoneType}
          </Link>{" "}
          <span className="text-ink-soft">/ Edit</span>
        </p>
        <h2 className="text-lg font-semibold text-ink">Edit requirement</h2>
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
