import Link from "next/link";
import { DemoBadge } from "@/components/catalogue/badges";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { DecisionForm } from "@/components/admin/decision-form";
import { DOCUMENT_TYPE_LABELS, StatusBadge, formatBytes, formatDate } from "@/components/admin/admin-ui";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { approveSeller, reactivateSeller, rejectSeller, suspendSeller } from "../actions";

type Params = Promise<{ id: string }>;

export default function AdminSellerDetailPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <SellerDetail params={params} />
    </Suspense>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-600">{label}</dt>
      <dd className="text-sm">{value || "-"}</dd>
    </div>
  );
}

async function SellerDetail({ params }: { params: Params }) {
  await requirePageRole(["ADMIN"]);
  const { id } = await params;

  // Explicit field selection: never pass password hashes or other account secrets to the page.
  const seller = await prisma.sellerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      businessName: true,
      isDemo: true,
      businessType: true,
      gstNumber: true,
      addressLine: true,
      city: true,
      state: true,
      country: true,
      pincode: true,
      yearsInBusiness: true,
      specialties: true,
      approvalStatus: true,
      rejectionReason: true,
      reviewedAt: true,
      approvedAt: true,
      createdAt: true,
      user: { select: { name: true, email: true, mobile: true, status: true, emailVerifiedAt: true } },
      documents: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          fileName: true,
          sizeBytes: true,
          status: true,
          certificateLabOther: true,
          certificateLab: { select: { name: true } },
        },
      },
    },
  });
  if (!seller) notFound();

  const status = seller.approvalStatus;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/sellers" className="text-sm underline">
          Back to sellers
        </Link>
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
          {seller.businessName} {seller.isDemo ? <DemoBadge /> : null}
        </h1>
        <StatusBadge status={status} />
      </header>

      <section aria-labelledby="actions-heading" className="space-y-4">
        <h2 id="actions-heading" className="text-lg font-semibold">
          Decision
        </h2>
        {status === "PENDING" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <DecisionForm
              action={approveSeller}
              sellerId={seller.id}
              title="Approve application"
              description="The seller can then manage their portfolio. They will be emailed."
              submitLabel="Approve seller"
            />
            <DecisionForm
              action={rejectSeller}
              sellerId={seller.id}
              title="Reject application"
              description="The seller is emailed the reason. They can correct the details and reapply."
              submitLabel="Reject application"
              reasonLabel="Reason for rejection (at least 10 characters)"
              tone="danger"
            />
          </div>
        ) : null}
        {status === "REJECTED" ? (
          <DecisionForm
            action={approveSeller}
            sellerId={seller.id}
            title="Approve application"
            description="This application was rejected earlier. Approving it clears the rejection reason and emails the seller."
            submitLabel="Approve seller"
          />
        ) : null}
        {status === "APPROVED" ? (
          <DecisionForm
            action={suspendSeller}
            sellerId={seller.id}
            title="Suspend seller"
            description="The seller loses access to seller features until reactivated. The reason is emailed to them."
            submitLabel="Suspend seller"
            reasonLabel="Reason for suspension (at least 10 characters)"
            tone="danger"
          />
        ) : null}
        {status === "SUSPENDED" ? (
          <DecisionForm
            action={reactivateSeller}
            sellerId={seller.id}
            title="Reactivate seller"
            description="Restores the approved state. The seller will be emailed."
            submitLabel="Reactivate seller"
          />
        ) : null}
      </section>

      <section aria-labelledby="business-heading" className="space-y-3">
        <h2 id="business-heading" className="text-lg font-semibold">
          Business
        </h2>
        <dl className="grid gap-4 rounded border border-stone-300 bg-white p-4 md:grid-cols-3">
          <Field label="Business type" value={seller.businessType.replace(/_/g, " ").toLowerCase()} />
          <Field label="GST number" value={seller.gstNumber} />
          <Field label="Years in business" value={seller.yearsInBusiness} />
          <Field label="Address" value={seller.addressLine} />
          <Field label="City" value={seller.city} />
          <Field label="State" value={seller.state} />
          <Field label="Country" value={seller.country} />
          <Field label="PIN code" value={seller.pincode} />
          <Field label="Specialties" value={seller.specialties.join(", ")} />
          <Field label="Submitted" value={formatDate(seller.createdAt)} />
        </dl>
      </section>

      <section aria-labelledby="account-heading" className="space-y-3">
        <h2 id="account-heading" className="text-lg font-semibold">
          Account
        </h2>
        <dl className="grid gap-4 rounded border border-stone-300 bg-white p-4 md:grid-cols-3">
          <Field label="Contact name" value={seller.user.name} />
          <Field label="Email" value={seller.user.email} />
          <Field label="Mobile" value={seller.user.mobile} />
          <Field label="Email verified" value={seller.user.emailVerifiedAt ? "Yes" : "No"} />
          <Field label="Account status" value={seller.user.status} />
          <Field label="Approval status" value={status} />
          <Field label="Reviewed" value={formatDate(seller.reviewedAt)} />
          <Field label="Approved" value={formatDate(seller.approvedAt)} />
          {seller.rejectionReason ? (
            <Field label="Rejection reason" value={seller.rejectionReason} />
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="documents-heading" className="space-y-3">
        <h2 id="documents-heading" className="text-lg font-semibold">
          Documents
        </h2>
        {seller.documents.length === 0 ? (
          <p className="text-sm text-stone-600">No documents uploaded.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-stone-300 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Certificate lab</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Download</th>
                </tr>
              </thead>
              <tbody>
                {seller.documents.map((doc) => (
                  <tr key={doc.id} className="border-t border-stone-200">
                    <td className="px-3 py-2">{DOCUMENT_TYPE_LABELS[doc.type]}</td>
                    <td className="px-3 py-2 break-all">{doc.fileName}</td>
                    <td className="px-3 py-2">{formatBytes(doc.sizeBytes)}</td>
                    <td className="px-3 py-2">
                      {doc.certificateLab?.name ?? (doc.certificateLabOther ? `Other: ${doc.certificateLabOther}` : "-")}
                    </td>
                    <td className="px-3 py-2">{doc.status.toLowerCase()}</td>
                    <td className="px-3 py-2">
                      <a href={`/api/admin/documents/${doc.id}`} className="underline">
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
