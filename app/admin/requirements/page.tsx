import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { formatDate } from "@/components/admin/admin-ui";
import { DemoBadge } from "@/components/catalogue/badges";
import { firstParam, parseRequirementFilter, REQUIREMENT_FILTERS, type RequirementFilter } from "@/lib/admin-moderation/filters";
import { REQUIREMENT_STATUS_LABELS } from "@/lib/admin-moderation/labels";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { formatMoney } from "@/lib/money/money";
import { closeRequirement } from "./actions";

export const metadata = { title: "Requirements", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AdminRequirementsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <RequirementList searchParams={searchParams} />
    </Suspense>
  );
}

const FILTER_LABELS: Record<RequirementFilter, string> = {
  all: "All",
  OPEN: "Open",
  CLOSED: "Closed",
};

function budget(min: bigint | null, max: bigint | null, currency: string): string {
  const low = formatMoney(min, currency);
  const high = formatMoney(max, currency);
  if (low && high) return `${low} to ${high}`;
  return low ?? high ?? "Not stated";
}

function caratRange(min: { toString(): string } | null, max: { toString(): string } | null): string {
  if (min && max) return `${min.toString()} to ${max.toString()} ct`;
  if (min) return `From ${min.toString()} ct`;
  if (max) return `Up to ${max.toString()} ct`;
  return "Not stated";
}

/** All buyer requirements, newest first. Notes are shown masked, as stored. */
async function RequirementList({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(["ADMIN"]);
  const params = await searchParams;
  const filter = parseRequirementFilter(firstParam(params.status));

  const requirements = await prisma.requirement.findMany({
    where: filter === "all" ? {} : { status: filter },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      gemstoneType: true,
      shape: true,
      caratMin: true,
      caratMax: true,
      budgetMinMinor: true,
      budgetMaxMinor: true,
      currency: true,
      certificateNeeded: true,
      quantity: true,
      deadline: true,
      notes: true,
      status: true,
      isDemo: true,
      createdAt: true,
      buyer: { select: { name: true, email: true } },
      category: { select: { name: true } },
      _count: { select: { responses: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Requirements</h1>
        <p className="text-sm text-stone-600">
          Buyer requirements posted to sellers. Close one with a reason if it breaks the rules; sellers can no
          longer respond to a closed requirement.
        </p>
      </header>

      <nav aria-label="Filter requirements" className="flex flex-wrap gap-2 text-sm">
        {REQUIREMENT_FILTERS.map((value) => (
          <Link
            key={value}
            href={`/admin/requirements?status=${value}`}
            aria-current={value === filter ? "page" : undefined}
            className={`rounded border px-3 py-1 ${
              value === filter ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"
            }`}
          >
            {FILTER_LABELS[value]}
          </Link>
        ))}
      </nav>

      {requirements.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          No requirements in this view.
        </p>
      ) : (
        <ul className="space-y-4">
          {requirements.map((requirement) => (
            <li key={requirement.id} className="space-y-4 rounded border border-stone-300 bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{requirement.gemstoneType}</span>
                <span className="rounded bg-stone-200 px-2 py-0.5 text-xs">
                  {REQUIREMENT_STATUS_LABELS[requirement.status]}
                </span>
                <span className="text-stone-600">Posted {formatDate(requirement.createdAt)}</span>
                {requirement.isDemo ? <DemoBadge /> : null}
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-600">Buyer</dt>
                  <dd>{requirement.buyer.name ?? "Unnamed buyer"}</dd>
                  <dd className="break-all text-stone-600">{requirement.buyer.email}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-600">Category and shape</dt>
                  <dd>
                    {requirement.category?.name ?? "Any category"}
                    {requirement.shape ? `, ${requirement.shape}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-600">Carat and budget</dt>
                  <dd>{caratRange(requirement.caratMin, requirement.caratMax)}</dd>
                  <dd className="text-stone-600">{budget(requirement.budgetMinMinor, requirement.budgetMaxMinor, requirement.currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-600">Responses</dt>
                  <dd>
                    {requirement._count.responses} seller{requirement._count.responses === 1 ? "" : "s"}
                  </dd>
                  <dd className="text-stone-600">
                    Qty {requirement.quantity}
                    {requirement.certificateNeeded ? ", certificate needed" : ""}
                    {requirement.deadline ? `, by ${formatDate(requirement.deadline)}` : ""}
                  </dd>
                </div>
              </dl>

              {requirement.notes ? (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-stone-600">Notes (masked)</p>
                  <p className="whitespace-pre-wrap break-words rounded bg-stone-100 p-3 text-sm">{requirement.notes}</p>
                </div>
              ) : null}

              {requirement.status === "OPEN" ? (
                <ActionForm
                  action={closeRequirement}
                  title="Close requirement"
                  description="Sellers can no longer respond. The reason is kept in the audit log."
                  submitLabel="Close requirement"
                  tone="danger"
                  hidden={{ requirementId: requirement.id }}
                  fields={[
                    {
                      name: "reason",
                      label: "Reason (10 to 500 characters)",
                      kind: "textarea",
                      required: true,
                      maxLength: 500,
                    },
                  ]}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
