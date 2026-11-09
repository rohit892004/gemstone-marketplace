import type { ApprovalStatus, DocumentType } from "@/app/generated/prisma/client";

/** Shared display helpers for admin pages. Server-safe (no client hooks). */

const STATUS_STYLES: Record<ApprovalStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900",
  APPROVED: "bg-green-100 text-green-900",
  REJECTED: "bg-red-100 text-red-900",
  SUSPENDED: "bg-stone-300 text-stone-900",
};

export function StatusBadge({ status }: { status: ApprovalStatus }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ID_PROOF: "ID proof",
  BUSINESS_PROOF: "Business proof",
  CERTIFICATE: "Gemstone certificate",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}
