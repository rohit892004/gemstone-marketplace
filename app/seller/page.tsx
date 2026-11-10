import { Suspense } from "react";
import { StatusCard } from "@/components/seller/status-card";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";

export default function SellerHomePage() {
  return (
    <Suspense fallback={null}>
      <SellerHome />
    </Suspense>
  );
}

async function SellerHome() {
  const user = await requirePageRole(["SELLER"]);
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { businessName: true, approvalStatus: true, rejectionReason: true },
  });

  if (!profile) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <StatusCard title="Seller profile not found">
          <p>
            We could not find a seller profile for this account. Contact support and we will help you.
          </p>
        </StatusCard>
      </section>
    );
  }

  if (profile.approvalStatus === "APPROVED") {
    return (
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-widest text-accent-text">Seller dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{profile.businessName}</h1>
        <p className="mt-3 text-ink-soft">Your account is approved. Choose an area above to get started.</p>
      </section>
    );
  }

  if (profile.approvalStatus === "REJECTED") {
    return (
      <section className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Application not approved</h1>
        <StatusCard title="Reason" tone="warn">
          <p className="whitespace-pre-line text-ink">
            {profile.rejectionReason ?? "No reason was recorded. Contact support for details."}
          </p>
          <p>If you believe this is a mistake, contact support and quote your business name.</p>
        </StatusCard>
      </section>
    );
  }

  // PENDING. SUSPENDED is redirected to login by requirePageRole before this point.
  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Application under review</h1>
      <StatusCard title="Status: pending review">
        <p>We are reviewing your documents. This usually takes 2 business days.</p>
        <p>We will email you when a decision is made. You do not need to resubmit anything.</p>
      </StatusCard>
    </section>
  );
}
