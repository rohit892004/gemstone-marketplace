import type { ApprovalStatus, DocumentType } from "@/app/generated/prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DEMO_LABEL } from "@/lib/demo/guard";

/** Shared display helpers for admin pages. Server-safe (no client hooks). */

const STATUS_TONES: Record<ApprovalStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "neutral",
};

/** Status is always shown as a word inside the badge. The tone only supports the text. */
export function StatusBadge({ status }: { status: ApprovalStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

/** Marks seeded sample records in admin lists. Same text as the catalogue demo label. */
export function AdminDemoTag() {
  return (
    <span className="ml-2 inline-flex items-center border border-dashed border-ink-soft/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-ink-soft">
      {DEMO_LABEL}
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
