import Link from "next/link";
import { deleteDocumentAction, toggleDocumentPublicAction } from "@/app/seller/listings/actions";
import { DocumentUploadForm } from "@/components/seller/document-upload-form";
import { canAddDocument, canSellerDeleteDocument, MAX_LISTING_DOCUMENTS } from "@/lib/seller-catalogue/documents";
import { listingDocumentUrl } from "@/lib/media/urls";

/**
 * Listing documents on the editor. Verification status and reason are read-only for sellers.
 * Public visibility still needs admin verification (enforced by the document route).
 */

export interface EditorDocument {
  id: string;
  type: "CERTIFICATE" | "VALUATION_REPORT" | "LAB_DOCUMENT";
  title: string;
  fileName: string;
  isPublic: boolean;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  verificationReason: string | null;
}

const typeLabels: Record<EditorDocument["type"], string> = {
  CERTIFICATE: "Certificate",
  VALUATION_REPORT: "Valuation report",
  LAB_DOCUMENT: "Lab document",
};

const statusLabels: Record<EditorDocument["verificationStatus"], string> = {
  PENDING: "Awaiting verification",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

const buttonClass = " border border-line bg-surface-raised px-3 py-1 text-xs font-medium text-ink";

export function ListingDocuments({
  listingId,
  documents,
  labs,
}: {
  listingId: string;
  documents: readonly EditorDocument[];
  labs: readonly { id: string; name: string }[];
}) {
  return (
    <section aria-labelledby="documents-heading" className="space-y-5">
      <h2 id="documents-heading" className="font-heading text-2xl text-ink">
        Documents
      </h2>
      <p className="text-sm text-ink-soft">
        Up to {MAX_LISTING_DOCUMENTS} documents per listing. Verified documents cannot be deleted; contact an administrator to replace them.
      </p>

      {documents.length === 0 ? <p className="text-sm text-ink-soft">No documents yet.</p> : null}

      <ul className="divide-y divide-line border border-line bg-surface-raised">
        {documents.map((doc) => (
          <li key={doc.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-ink">{doc.title}</p>
              <p className="text-sm text-ink-soft">
                {typeLabels[doc.type]} · {statusLabels[doc.verificationStatus]}
              </p>
            </div>
            {doc.verificationStatus === "REJECTED" && doc.verificationReason ? (
              <p className="text-sm text-danger">Reason: {doc.verificationReason}</p>
            ) : null}
            <p className="text-xs text-ink-soft">
              File: {doc.fileName} · {doc.isPublic ? "Public when verified" : "Private"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={listingDocumentUrl(doc.id)} className={buttonClass}>
                Download
              </Link>
              <form action={toggleDocumentPublicAction}>
                <input type="hidden" name="listingId" value={listingId} />
                <input type="hidden" name="documentId" value={doc.id} />
                <input type="hidden" name="isPublic" value={doc.isPublic ? "false" : "true"} />
                <button type="submit" className={buttonClass}>
                  {doc.isPublic ? "Make private" : "Make public"}
                </button>
              </form>
              {canSellerDeleteDocument(doc) ? (
                <form action={deleteDocumentAction}>
                  <input type="hidden" name="listingId" value={listingId} />
                  <input type="hidden" name="documentId" value={doc.id} />
                  <button type="submit" className={buttonClass}>
                    Delete
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {canAddDocument(documents.length) ? (
        <DocumentUploadForm listingId={listingId} labs={labs} />
      ) : (
        <p className="text-sm text-ink-soft">This listing has the maximum number of documents.</p>
      )}
    </section>
  );
}
