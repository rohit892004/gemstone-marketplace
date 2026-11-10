import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { CloseRequirementButton } from "@/components/requirements/close-requirement-button";
import { requirePageRole } from "@/lib/auth/require-role";
import { formatBudgetRange, formatCaratRange } from "@/lib/requirements/format";
import { getRequirementForBuyer, listRequirementThreads } from "@/lib/requirements/service";

type Props = { params: Promise<{ id: string }> };

export default function RequirementDetailPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <RequirementDetail params={params} />
    </Suspense>
  );
}

async function RequirementDetail({ params }: Props) {
  const user = await requirePageRole(["BUYER"]);
  const { id } = await params;
  const requirement = await getRequirementForBuyer(user.id, id);
  if (!requirement) notFound();
  const threads = await listRequirementThreads(user.id, id);
  const open = requirement.status === "OPEN";

  const facts: [string, string | null][] = [
    ["Category", requirement.category?.name ?? "Any category"],
    ["Shape", requirement.shape],
    ["Carat", formatCaratRange(requirement.caratMin, requirement.caratMax)],
    ["Budget", formatBudgetRange(requirement.budgetMinMinor, requirement.budgetMaxMinor, requirement.currency)],
    ["Certificate needed", requirement.certificateNeeded ? "Yes" : "No"],
    ["Origin preference", requirement.originPreference],
    ["Quantity", String(requirement.quantity)],
    ["Deadline", requirement.deadline ? requirement.deadline.toLocaleDateString("en-IN", { dateStyle: "medium" }) : null],
    ["Posted", requirement.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })],
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link href="/buyer/requirements" className="underline underline-offset-4 hover:text-ink">
          Requirements
        </Link>{" "}
        / <span className="text-ink">{requirement.gemstoneType}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge tone={open ? "success" : "neutral"}>{open ? "Open" : "Closed"}</Badge>
          <h2 className="font-heading text-3xl text-ink sm:text-4xl">{requirement.gemstoneType}</h2>
        </div>
        {open ? (
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/buyer/requirements/${requirement.id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <CloseRequirementButton requirementId={requirement.id} />
          </div>
        ) : null}
      </header>

      <dl className="divide-y divide-line border border-line bg-surface-raised text-[15px]">
        {facts
          .filter((row): row is [string, string] => !!row[1])
          .map(([label, value]) => (
            <div key={label} className="grid grid-cols-3 gap-3 px-4 py-3.5 sm:px-6">
              <dt className="text-ink-soft">{label}</dt>
              <dd className="col-span-2 text-ink">{value}</dd>
            </div>
          ))}
      </dl>

      {requirement.notes ? (
        <section aria-labelledby="notes-heading" className="space-y-2">
          <h3 id="notes-heading" className="font-heading text-2xl text-ink">
            Notes
          </h3>
          <p className="whitespace-pre-line text-ink-soft">{requirement.notes}</p>
        </section>
      ) : null}

      <section aria-labelledby="responses-heading" className="space-y-3">
        <h3 id="responses-heading" className="font-heading text-2xl text-ink">
          Seller responses ({requirement._count.responses})
        </h3>
        {threads.length === 0 ? (
          <p className="text-sm text-ink-soft">No seller has responded yet. Sellers who reply open a conversation with you here.</p>
        ) : (
          <ul className="divide-y divide-line border border-line bg-surface-raised">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link href={`/conversations/${thread.id}`} className="flex min-h-11 items-center justify-between gap-4 px-4 py-3 transition duration-300 hover:bg-accent-soft/40">
                  <span className="font-medium text-ink">{thread.sellerName}</span>
                  <span className="text-xs text-ink-soft">{thread.lastMessageAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
