import { canTransition, statusAfterEdit, statusOnSubmit, type ListingStatusValue } from "@/lib/listings/status";

/**
 * What a seller's Save or Submit does to a listing's status.
 *
 * - "draft": Save keeps the listing a draft. A PUBLISHED listing returns to DRAFT (statusAfterEdit).
 * - "submit": Submit moves it to PENDING_REVIEW, or straight to PUBLISHED when auto-publish is on.
 *   The base status is statusAfterEdit(current), so a PUBLISHED listing can be edited and submitted in one step.
 */
export type SaveIntent = "draft" | "submit";

export type SaveStatusResult =
  | { ok: true; status: ListingStatusValue; setSubmittedAt: boolean; setPublishedAt: boolean }
  | { ok: false; reason: "archived" | "not_submittable" };

export function resolveSaveStatus(input: {
  /** null for a new listing. */
  current: ListingStatusValue | null;
  intent: SaveIntent;
  sellerApproved: boolean;
  autoPublish: boolean;
}): SaveStatusResult {
  const { current, intent, sellerApproved, autoPublish } = input;

  if (current === null) {
    if (intent === "draft") {
      return { ok: true, status: "DRAFT", setSubmittedAt: false, setPublishedAt: false };
    }
    const status = statusOnSubmit(sellerApproved, autoPublish);
    return { ok: true, status, setSubmittedAt: true, setPublishedAt: status === "PUBLISHED" };
  }

  if (!canTransition(current, "edit")) return { ok: false, reason: "archived" };
  const base = statusAfterEdit(current);

  if (intent === "draft") {
    return { ok: true, status: base, setSubmittedAt: false, setPublishedAt: false };
  }
  if (!canTransition(base, "submit")) return { ok: false, reason: "not_submittable" };

  const status = statusOnSubmit(sellerApproved, autoPublish);
  return { ok: true, status, setSubmittedAt: true, setPublishedAt: status === "PUBLISHED" };
}
