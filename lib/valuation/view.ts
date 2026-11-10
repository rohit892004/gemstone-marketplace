import { QUALITY_GRADE_LABELS, type QualityGrade } from "./engine";

/**
 * Builds what one viewer may see of a valuation. Pure. Every page and server action that shows a valuation
 * goes through buildValuationView, so the privacy rules live in one place:
 *
 *  - ADMIN sees everything, including the requester and the assigned valuator.
 *  - REQUESTER sees their own request and the final result. Not the assigned valuator's name.
 *  - VALUATOR sees the stone, the media, the engine output and the thread. Never the requester's identity,
 *    the listing or the seller. Thread authors appear as REQUESTER, VALUATOR or ADMIN, never by name.
 *  - The requester sees no result while the request is in expert review. The estimate appears when it is ready.
 */

export type ViewerRole = "ADMIN" | "REQUESTER" | "VALUATOR";

export interface ResultView {
  valuedBy: "AUTO" | "EXPERT";
  estimateMinor: bigint;
  lowMinor: bigint;
  highMinor: bigint;
  confidence: string;
}

export interface ThreadEntry {
  id: string;
  kind: string;
  body: string;
  createdAt: Date;
  from: "REQUESTER" | "VALUATOR" | "ADMIN";
}

export interface MediaEntry {
  id: string;
  kind: "IMAGE" | "VIDEO";
  mimeType: string;
  sortOrder: number;
}

/** The stone and the engine output, as stored. */
export interface StoneRecord {
  reference: string;
  status: string;
  gemstoneType: string;
  shape: string | null;
  caratMilli: number | null;
  dimensions: string | null;
  colour: string | null;
  clarity: string | null;
  qualityGrade: string | null;
  origin: string | null;
  treatment: string | null;
  certificateNumber: string | null;
  notes: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  expertReasons: string[];
  autoEstimateMinor: bigint | null;
  autoLowMinor: bigint | null;
  autoHighMinor: bigint | null;
  autoConfidence: string | null;
  finalEstimateMinor: bigint | null;
  finalLowMinor: bigint | null;
  finalHighMinor: bigint | null;
  finalConfidence: string | null;
}

export interface ViewRecord extends StoneRecord {
  id: string;
  requesterId: string;
  source: string;
  gemstoneId: string | null;
  listingSellerUserId: string | null;
  categoryName: string | null;
  labName: string | null;
  currency: string;
  requestExpert: boolean;
  publishedOnListing: boolean;
  withdrawnAt: Date | null;
  withdrawnReason: string | null;
  rejectionReason: string | null;
  completedAt: Date | null;
  assignedValuatorId: string | null;
  requester: { id: string; name: string | null; email: string };
  assignedValuator: { id: string; name: string | null } | null;
  media: MediaEntry[];
  thread: Array<{ id: string; kind: string; body: string; createdAt: Date; authorId: string; authorRole: string }>;
}

export interface ValuationView {
  id: string;
  reference: string;
  status: string;
  source: string;
  currency: string;
  gemstoneType: string;
  categoryName: string | null;
  shape: string | null;
  caratMilli: number | null;
  dimensions: string | null;
  colour: string | null;
  clarity: string | null;
  qualityGrade: string | null;
  qualityGradeLabel: string | null;
  origin: string | null;
  treatment: string | null;
  labName: string | null;
  certificateNumber: string | null;
  notes: string | null;
  requestExpert: boolean;
  expertReasons: string[];
  createdAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
  withdrawn: boolean;
  withdrawnReason: string | null;
  rejectionReason: string | null;
  media: MediaEntry[];
  thread: ThreadEntry[];
  /** The result the viewer may rely on. Null while under review, or for a viewer who may not see it yet. */
  result: ResultView | null;
  /** The engine's automatic estimate, for valuators and admins while the request is open. */
  autoSuggestion: ResultView | null;
  /** Admin and requester only. Not present for valuators. */
  requester?: { id: string; name: string | null; email: string };
  assignedValuatorName?: string | null;
  gemstoneId?: string | null;
  publishedOnListing?: boolean;
}

function autoResult(record: ViewRecord): ResultView | null {
  if (record.autoEstimateMinor === null || record.autoLowMinor === null || record.autoHighMinor === null) return null;
  return {
    valuedBy: "AUTO",
    estimateMinor: record.autoEstimateMinor,
    lowMinor: record.autoLowMinor,
    highMinor: record.autoHighMinor,
    confidence: record.autoConfidence ?? "LOW",
  };
}

/** The result for display: the expert sign-off when completed, otherwise the automatic result once it is ready. */
export function effectiveResult(record: Pick<ViewRecord, "status" | "autoEstimateMinor" | "autoLowMinor" | "autoHighMinor" | "autoConfidence" | "finalEstimateMinor" | "finalLowMinor" | "finalHighMinor" | "finalConfidence">): ResultView | null {
  if (record.status === "COMPLETED" && record.finalEstimateMinor !== null && record.finalLowMinor !== null && record.finalHighMinor !== null) {
    return {
      valuedBy: "EXPERT",
      estimateMinor: record.finalEstimateMinor,
      lowMinor: record.finalLowMinor,
      highMinor: record.finalHighMinor,
      confidence: record.finalConfidence ?? "LOW",
    };
  }
  if (record.status === "AUTO_VALUED" && record.autoEstimateMinor !== null && record.autoLowMinor !== null && record.autoHighMinor !== null) {
    return {
      valuedBy: "AUTO",
      estimateMinor: record.autoEstimateMinor,
      lowMinor: record.autoLowMinor,
      highMinor: record.autoHighMinor,
      confidence: record.autoConfidence ?? "LOW",
    };
  }
  return null;
}

function fromOf(entry: { authorId: string; authorRole: string }, requesterId: string): ThreadEntry["from"] {
  if (entry.authorId === requesterId) return "REQUESTER";
  return entry.authorRole === "ADMIN" ? "ADMIN" : "VALUATOR";
}

export function buildValuationView(viewer: { id: string; role: ViewerRole }, record: ViewRecord): ValuationView {
  const isAdmin = viewer.role === "ADMIN";
  const isValuator = viewer.role === "VALUATOR";
  const isRequester = !isAdmin && !isValuator;

  const thread: ThreadEntry[] = record.thread.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    body: entry.body,
    createdAt: entry.createdAt,
    from: fromOf(entry, record.requesterId),
  }));

  const base: ValuationView = {
    id: record.id,
    reference: record.reference,
    status: record.status,
    source: record.source,
    currency: record.currency,
    gemstoneType: record.gemstoneType,
    categoryName: record.categoryName,
    shape: record.shape,
    caratMilli: record.caratMilli,
    dimensions: record.dimensions,
    colour: record.colour,
    clarity: record.clarity,
    qualityGrade: record.qualityGrade,
    qualityGradeLabel: record.qualityGrade ? QUALITY_GRADE_LABELS[record.qualityGrade as QualityGrade] ?? null : null,
    origin: record.origin,
    treatment: record.treatment,
    labName: record.labName,
    certificateNumber: record.certificateNumber,
    notes: record.notes,
    requestExpert: record.requestExpert,
    expertReasons: record.expertReasons,
    createdAt: record.createdAt,
    submittedAt: record.submittedAt,
    completedAt: record.completedAt,
    withdrawn: record.withdrawnAt !== null,
    withdrawnReason: isValuator ? null : record.withdrawnReason,
    rejectionReason: record.rejectionReason,
    media: record.media,
    thread,
    result: effectiveResult(record),
    autoSuggestion: isRequester ? null : autoResult(record),
  };

  if (isValuator) {
    // Valuators get the stone, the media and the thread. Nothing here identifies the requester or the listing.
    return base;
  }

  if (isAdmin) {
    return {
      ...base,
      requester: record.requester,
      assignedValuatorName: record.assignedValuator?.name ?? null,
      gemstoneId: record.gemstoneId,
      publishedOnListing: record.publishedOnListing,
    };
  }

  // Requester: their own request, with the assigned valuator shown by role only.
  return { ...base, gemstoneId: record.gemstoneId, publishedOnListing: record.publishedOnListing };
}
