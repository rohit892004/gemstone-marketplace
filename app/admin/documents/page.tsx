import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { formatBytes, formatDate } from "@/components/admin/admin-ui";
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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Document verification</h1>
      <p className="text-sm text-stone-600">
        Verifying a document marks it as checked. It does not make it public: the seller chooses whether to show it on
        the listing. {docs.length} waiting, oldest first.
      </p>

      {docs.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">No documents are waiting for verification.</p>
      ) : (
        <ul className="space-y-4">
          {docs.map((doc) => (
            <li key={doc.id} className="space-y-3 rounded border border-stone-300 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">{doc.gemstone.title}</p>
                  <p className="text-stone-600">Seller: {doc.gemstone.seller.businessName}</p>
                  <p>
                    {doc.title} · {TYPE_LABELS[doc.type] ?? doc.type} · {doc.certificateLab?.name ?? "No lab"} · {formatBytes(doc.sizeBytes)}
                  </p>
                  <p className="text-stone-600">File: {doc.fileName} · uploaded {formatDate(doc.createdAt)}</p>
                </div>
                <a href={listingDocumentUrl(doc.id)} className="rounded border border-stone-300 px-3 py-1 underline">
                  Download
                </a>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
