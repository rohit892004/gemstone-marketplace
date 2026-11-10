import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { DecisionForm } from "@/components/admin/decision-form";
import { SellerCategoriesForm } from "@/components/admin/seller-categories-form";
import { AdminDemoTag, DOCUMENT_TYPE_LABELS, StatusBadge, formatBytes, formatDate } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { loadSellerCategories } from "@/lib/seller/categories";
import { approveSeller, reactivateSeller, rejectSeller, suspendSeller } from "../actions";
import { updateSellerCategories } from "../categories-actions";

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
    <div className="space-y-1">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">{label}</dt>
      <dd className="text-[15px] text-ink">{value || "-"}</dd>
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
      categories: { orderBy: { name: "asc" }, select: { id: true, name: true } },
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
  const categoryOptions = await loadSellerCategories();

  type DocRow = (typeof seller.documents)[number];
  const documentColumns: Column<DocRow>[] = [
    { key: "type", header: "Type", cell: (doc) => DOCUMENT_TYPE_LABELS[doc.type] },
    { key: "file", header: "File", cell: (doc) => <span className="break-all">{doc.fileName}</span> },
    { key: "size", header: "Size", hideOnMobile: true, cell: (doc) => formatBytes(doc.sizeBytes) },
    {
      key: "lab",
      header: "Certificate lab",
      hideOnMobile: true,
      cell: (doc) => doc.certificateLab?.name ?? (doc.certificateLabOther ? `Other: ${doc.certificateLabOther}` : "-"),
    },
    { key: "status", header: "Status", cell: (doc) => doc.status.toLowerCase() },
    {
      key: "download",
      header: "Download",
      cell: (doc) => (
        <a
          href={`/api/admin/documents/${doc.id}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-ink underline underline-offset-4 hover:text-accent-text"
        >
          <Download className="h-4 w-4" strokeWidth={1.25} aria-hidden />
          Download
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-12">
      <Link href="/admin/sellers" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.25} aria-hidden />
        Back to sellers
      </Link>

      <PageHeader
        eyebrow="Seller application"
        title={seller.businessName}
        lead={
          <span className="flex flex-wrap items-center gap-3">
            <StatusBadge status={status} />
            {seller.isDemo ? <AdminDemoTag /> : null}
          </span>
        }
      />

      <section className="space-y-6">
        <SectionHeading title="Decision" />
        {status === "PENDING" ? (
          <div className="grid gap-6 md:grid-cols-2">
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

      <section className="space-y-6">
        <SectionHeading title="Business" />
        <Card className="p-5 sm:p-8">
          <dl className="grid gap-6 md:grid-cols-3">
            <Field label="Business type" value={seller.businessType.replace(/_/g, " ").toLowerCase()} />
            <Field label="GST number" value={seller.gstNumber} />
            <Field label="Years in business" value={seller.yearsInBusiness} />
            <Field label="Address" value={seller.addressLine} />
            <Field label="City" value={seller.city} />
            <Field label="State" value={seller.state} />
            <Field label="Country" value={seller.country} />
            <Field label="PIN code" value={seller.pincode} />
            <Field label="Specialties" value={seller.specialties.join(", ")} />
            <Field label="Gemstone categories" value={seller.categories.map((c) => c.name).join(", ")} />
            <Field label="Submitted" value={formatDate(seller.createdAt)} />
          </dl>
        </Card>
        <SellerCategoriesForm
          action={updateSellerCategories}
          sellerId={seller.id}
          options={categoryOptions}
          selectedIds={seller.categories.map((c) => c.id)}
        />
      </section>

      <section className="space-y-6">
        <SectionHeading title="Account" />
        <Card className="p-5 sm:p-8">
          <dl className="grid gap-6 md:grid-cols-3">
            <Field label="Contact name" value={seller.user.name} />
            <Field label="Email" value={seller.user.email} />
            <Field label="Mobile" value={seller.user.mobile} />
            <Field label="Email verified" value={seller.user.emailVerifiedAt ? "Yes" : "No"} />
            <Field label="Account status" value={seller.user.status} />
            <Field label="Approval status" value={status} />
            <Field label="Reviewed" value={formatDate(seller.reviewedAt)} />
            <Field label="Approved" value={formatDate(seller.approvedAt)} />
            {seller.rejectionReason ? <Field label="Rejection reason" value={seller.rejectionReason} /> : null}
          </dl>
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeading title="Documents" />
        {seller.documents.length === 0 ? (
          <p className="text-sm text-ink-soft">No documents uploaded.</p>
        ) : (
          <DataTable caption="Seller documents" columns={documentColumns} rows={seller.documents} getRowKey={(doc) => doc.id} />
        )}
      </section>
    </div>
  );
}
