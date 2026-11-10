import { Suspense } from "react";
import { Download, FileCheck } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminDemoTag, formatBytes, formatDate } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { listingDocumentUrl } from "@/lib/media/urls";
import { rejectListingDocument, verifyListingDocument } from "./actions";

export const metadata = { title: "Document verification", robots: { index: false, follow: false } };

export default function AdminDocumentsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentQueue />
    </Suspense>
  );
}

const TYPE_LABELS: Record<string, string> = {
  CERTIFICATE: "Certificate",
  VALUATION_REPORT: "Valuation report",
  LAB_DOCUMENT: "Lab document",
};

async function DocumentQueue() {
  await requirePageRole(["ADMIN"]);

  const docs = await prisma.listingDocument.findMany({
    where: { verificationStatus: "PENDING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      type: true,
      fileName: true,
      sizeBytes: true,
      createdAt: true,
      certificateLab: { select: { name: true } },
      gemstone: { select: { id: true, title: true, isDemo: true, seller: { select: { businessName: true } } } },
    },
  });

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Queue"
        title="Document verification"
        lead={
          <>
            Verifying a document marks it as checked. It does not make it public: the seller chooses whether to show it on the listing.{" "}
            {docs.length} waiting, oldest first.
          </>
        }
      />

      {docs.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="No documents are waiting for verification"
          body="New certificates and reports appear here when a seller uploads them."
        />
      ) : (
        <ul className="space-y-6">
          {docs.map((doc) => (
            <li key={doc.id}>
              <Card className="space-y-6 p-5 text-sm sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="flex flex-wrap items-center gap-2 font-heading text-xl text-ink">
                      {doc.gemstone.title}
                      {doc.gemstone.isDemo ? <AdminDemoTag /> : null}
                    </p>
                    <p className="text-ink-soft">Seller: {doc.gemstone.seller.businessName}</p>
                    <p className="flex flex-wrap items-center gap-2 text-ink">
                      <span>{doc.title}</span>
                      <Badge tone="neutral">{TYPE_LABELS[doc.type] ?? doc.type}</Badge>
                      <span>{doc.certificateLab?.name ?? "No lab"}</span>
                      <span className="text-ink-soft">{formatBytes(doc.sizeBytes)}</span>
                    </p>
                    <p className="text-ink-soft">
                      File: {doc.fileName} · uploaded {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <a
                    href={listingDocumentUrl(doc.id)}
                    className="inline-flex min-h-11 items-center gap-2 border border-line px-4 py-2 text-sm text-ink transition duration-300 hover:border-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <Download className="h-4 w-4" strokeWidth={1.25} aria-hidden />
                    Download
                  </a>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <ActionForm
                    action={verifyListingDocument}
                    hidden={{ documentId: doc.id }}
                    title="Verify"
                    description="Marks the document as verified. The seller is emailed. It stays private until they show it."
                    submitLabel="Verify document"
                  />
                  <ActionForm
                    action={rejectListingDocument}
                    hidden={{ documentId: doc.id }}
                    title="Reject"
                    description="The seller is emailed the reason."
                    submitLabel="Reject document"
                    tone="danger"
                    fields={[
                      { name: "reason", label: "Reason (at least 10 characters)", kind: "textarea", required: true, maxLength: 1000 },
                    ]}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
