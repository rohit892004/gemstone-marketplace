import { prisma } from "@/lib/db/client";
import { getValuationView, type Actor } from "./service";
import type { ExpertReason } from "./engine";

/**
 * Valuator queue and the valuator's view of a single request.
 *
 * Least privilege: the queue query selects only the stone and status fields. It never selects the requester
 * relation, the requester id, the listing or the seller. The filter is the session user's own assignments.
 */

/** Statuses a valuator works on. COMPLETED, REJECTED and withdrawn requests leave the queue. */
export const VALUATOR_QUEUE_STATUSES = ["IN_EXPERT_REVIEW", "NEEDS_INFO"] as const;

/** Exported so a test can check that no requester, listing or seller field is ever selected. */
export const VALUATOR_QUEUE_SELECT = {
  id: true,
  reference: true,
  gemstoneType: true,
  caratMilli: true,
  status: true,
  submittedAt: true,
  expertReasons: true,
} as const;

export type ValuatorQueueRow = {
  id: string;
  reference: string;
  gemstoneType: string;
  caratMilli: number | null;
  status: string;
  submittedAt: Date | null;
  expertReasons: string[];
};

export async function loadValuatorQueue(valuatorId: string): Promise<ValuatorQueueRow[]> {
  return prisma.valuation.findMany({
    where: {
      assignedValuatorId: valuatorId,
      status: { in: [...VALUATOR_QUEUE_STATUSES] },
      withdrawnAt: null,
    },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    select: VALUATOR_QUEUE_SELECT,
  });
}

const REASON_LABELS: Record<ExpertReason, string> = {
  NO_REFERENCE: "No reference price for this stone",
  INCOMPLETE: "Details incomplete",
  LOW_CONFIDENCE: "Low confidence",
  ABOVE_THRESHOLD: "Above the expert threshold",
  REQUESTED: "Requester asked for an expert",
};

/** Plain-language reasons for the queue. Unknown codes are shown as they are. */
export function expertReasonLabel(code: string): string {
  return REASON_LABELS[code as ExpertReason] ?? code;
}

/**
 * The engine's factors for the valuator. Read only after getValuationView has confirmed the viewer may see the
 * request, so it never reads a row the valuator could not open. Factors never contain requester identity.
 */
export async function loadAutoFactors(valuationId: string, viewer: Actor): Promise<string[]> {
  // Throws NOT_FOUND for anyone who may not see the request. The select below is the factors column only.
  await getValuationView(valuationId, viewer);
  const row = await prisma.valuation.findUnique({ where: { id: valuationId }, select: { autoFactors: true } });
  if (!row) return [];
  return Array.isArray(row.autoFactors) ? row.autoFactors.filter((f): f is string => typeof f === "string") : [];
}
