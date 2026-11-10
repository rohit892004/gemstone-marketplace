import { Suspense } from "react";
import { ListChecks } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminDemoTag, formatDate } from "@/components/admin/admin-ui";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
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

const STATUS_TONES: Record<string, BadgeTone> = { OPEN: "success", CLOSED: "neutral" };

const LABEL = "text-[11px] uppercase tracking-[0.18em] text-ink-soft";

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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Marketplace"
        title="Requirements"
        lead="Buyer requirements posted to sellers. Close one with a reason if it breaks the rules; sellers can no longer respond to a closed requirement."
      />

      <Tabs
        label="Filter requirements"
        items={REQUIREMENT_FILTERS.map((value) => ({
          href: `/admin/requirements?status=${value}`,
          label: FILTER_LABELS[value],
          active: value === filter,
        }))}
      />

      {requirements.length === 0 ? (
        <EmptyState icon={ListChecks} title="No requirements in this view" body="Buyer requirements appear here once they are posted." />
      ) : (
        <ul className="space-y-6">
          {requirements.map((requirement) => (
            <li key={requirement.id}>
              <Card className="space-y-6 p-5 text-sm sm:p-8">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="font-heading text-xl text-ink">{requirement.gemstoneType}</span>
                  <Badge tone={STATUS_TONES[requirement.status] ?? "neutral"}>{REQUIREMENT_STATUS_LABELS[requirement.status]}</Badge>
                  <span className="text-ink-soft">Posted {formatDate(requirement.createdAt)}</span>
                  {requirement.isDemo ? <AdminDemoTag /> : null}
                </div>

                <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <dt className={LABEL}>Buyer</dt>
                    <dd className="text-[15px] text-ink">{requirement.buyer.name ?? "Unnamed buyer"}</dd>
                    <dd className="break-all text-ink-soft">{requirement.buyer.email}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className={LABEL}>Category and shape</dt>
                    <dd className="text-[15px] text-ink">
                      {requirement.category?.name ?? "Any category"}
                      {requirement.shape ? `, ${requirement.shape}` : ""}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className={LABEL}>Carat and budget</dt>
                    <dd className="text-[15px] text-ink">{caratRange(requirement.caratMin, requirement.caratMax)}</dd>
                    <dd className="text-ink-soft">{budget(requirement.budgetMinMinor, requirement.budgetMaxMinor, requirement.currency)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className={LABEL}>Responses</dt>
                    <dd className="text-[15px] text-ink">
                      {requirement._count.responses} seller{requirement._count.responses === 1 ? "" : "s"}
                    </dd>
                    <dd className="text-ink-soft">
                      Qty {requirement.quantity}
                      {requirement.certificateNeeded ? ", certificate needed" : ""}
                      {requirement.deadline ? `, by ${formatDate(requirement.deadline)}` : ""}
                    </dd>
                  </div>
                </dl>

                {requirement.notes ? (
                  <div className="space-y-2">
                    <p className={LABEL}>Notes (masked)</p>
                    <p className="whitespace-pre-wrap break-words border border-line bg-surface p-4 text-[15px] leading-relaxed text-ink">{requirement.notes}</p>
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
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
