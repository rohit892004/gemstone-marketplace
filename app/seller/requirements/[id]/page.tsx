import Link from "next/link";
import { DemoTag } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequirementRespondForm } from "@/components/seller/requirement-respond-form";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { budgetLabel, caratLabel } from "@/lib/requirements/format";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

export default function SellerRequirementPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <RequirementDetail params={params} />
    </Suspense>
  );
}

async function RequirementDetail({ params }: { params: Promise<{ id: string }> }) {
  const state = await gateApprovedSeller();
  if (state !== "approved") return <AwaitingApprovalPage title="Requirement" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const { id } = await params;
  const now = new Date();

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { categories: { select: { id: true } } },
  });
  const categoryIds = profile?.categories.map((c) => c.id) ?? [];

  // Visible when it is open in one of the seller's categories, or when this seller already responded.
  // Any other ID (closed, outside the categories, or missing) gets the same 404.
  const requirement = await prisma.requirement.findFirst({
    where: {
      id,
      // A seller's own requirement is never shown to them as a board item, even when it is open in their category.
      buyerId: { not: user.id },
      OR: [
        { status: "OPEN", categoryId: { in: categoryIds } },
        { responses: { some: { sellerId: user.id } } },
      ],
    },
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
      originPreference: true,
      quantity: true,
      deadline: true,
      notes: true,
      status: true,
      isDemo: true,
      category: { select: { name: true } },
      responses: { where: { sellerId: user.id }, select: { conversationId: true }, take: 1 },
    },
  });
  if (!requirement) notFound();

  const existing = requirement.responses[0]?.conversationId ?? null;
  const passedDeadline = requirement.deadline !== null && requirement.deadline.getTime() < now.getTime();
  const canRespond = !existing && requirement.status === "OPEN" && !passedDeadline;

  return (
    <div className="max-w-3xl space-y-10">
      <Link href="/seller/requirements" className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4 hover:text-accent-text">
        ← Requirements board
      </Link>

      <PageHeader
        eyebrow={requirement.category?.name ?? "Requirement"}
        title={requirement.gemstoneType}
        lead="Buyer details are not shared. Replies stay on Gemstone Selections."
        actions={requirement.isDemo ? <DemoTag /> : null}
      />

      <dl className="grid gap-x-8 gap-y-5 border border-line bg-surface-raised p-5 text-[15px] sm:grid-cols-2 sm:p-6">
        <Row label="Shape" value={requirement.shape ?? "Any"} />
        <Row
          label="Carat"
          value={caratLabel(requirement.caratMin?.toString() ?? null, requirement.caratMax?.toString() ?? null)}
        />
        <Row
          label="Budget"
          value={budgetLabel(requirement.budgetMinMinor, requirement.budgetMaxMinor, requirement.currency)}
        />
        <Row label="Quantity" value={String(requirement.quantity)} />
        <Row label="Certificate" value={requirement.certificateNeeded ? "Needed" : "Not required"} />
        <Row label="Origin preference" value={requirement.originPreference ?? "No preference"} />
        <Row
          label="Deadline"
          value={
            requirement.deadline
              ? requirement.deadline.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "UTC" })
              : "No deadline"
          }
        />
      </dl>

      {requirement.notes && (
        <div className="border border-line bg-surface-raised p-5 sm:p-6">
          <h2 className="font-heading text-2xl text-ink">Buyer notes</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">{requirement.notes}</p>
        </div>
      )}

      {existing ? (
        <div className="space-y-3 border border-line bg-accent-soft p-5 text-sm text-ink sm:p-6">
          <p>You have already responded to this requirement.</p>
          <Link href={`/conversations/${existing}`} className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-4 hover:text-accent-text">
            Open your conversation
          </Link>
        </div>
      ) : canRespond ? (
        <RequirementRespondForm requirementId={requirement.id} />
      ) : (
        <p className="text-sm text-ink-soft">
          {passedDeadline ? "The deadline for this requirement has passed." : "This requirement is closed."}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.2em] text-ink-soft">{label}</dt>
      <dd className="mt-1 text-ink">{value}</dd>
    </div>
  );
}
