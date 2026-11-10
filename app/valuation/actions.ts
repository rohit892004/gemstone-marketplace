"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkRole } from "@/lib/auth/require-role";
import {
  addValuationMedia,
  answerValuationInfoRequest,
  createValuationDraft,
  removeValuationMedia,
  setPublishedOnListing,
  setRequestExpert,
  submitValuation,
  updateValuationDetails,
  type Actor,
} from "@/lib/valuation/service";
import { detailFieldForError, detailsRawFromFormData, type ActionResult, type ValuationActionState } from "@/lib/valuation/requester-form";
import { valuationErrorMessage } from "@/lib/valuation/requester-errors";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";

/**
 * Requester actions. The acting user always comes from the session (checkRole), never from a form field. The
 * valuation service checks ownership and status again, so an action that forgets a check still cannot break a rule.
 * Redirects are called outside try blocks so Next's redirect is not swallowed.
 */

const NOT_SIGNED_IN = "Sign in as a buyer or an approved seller to request a valuation.";
const MAX_ID = 64;

async function currentActor(): Promise<Actor | null> {
  const result = await checkRole(["BUYER", "SELLER"], { sellerApproved: true });
  if (!result.ok) return null;
  return { id: result.user.id, role: result.user.role };
}

function readId(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id.length > 0 && id.length <= MAX_ID ? id : null;
}

function refreshValuation(id: string): void {
  revalidatePath(REQUESTER_PATHS.result(id));
  revalidatePath(REQUESTER_PATHS.upload(id));
  revalidatePath(REQUESTER_PATHS.review(id));
}

function refreshDashboards(): void {
  revalidatePath(REQUESTER_PATHS.buyerValuations);
  revalidatePath(REQUESTER_PATHS.buyerReports);
  revalidatePath(REQUESTER_PATHS.sellerValuations);
  revalidatePath(REQUESTER_PATHS.sellerReports);
}

/** Starts a draft, from a product page (gemstoneId set) or standalone. Goes to step 1. */
export async function startValuationAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: NOT_SIGNED_IN };
  const gemstoneId = readId(formData.get("gemstoneId"));

  let valuationId: string;
  try {
    ({ valuationId } = await createValuationDraft({ requesterId: actor.id, gemstoneId }));
  } catch (error) {
    return { ok: false, error: valuationErrorMessage(error) };
  }
  refreshDashboards();
  redirect(REQUESTER_PATHS.upload(valuationId));
}

/** Saves the details form. "Continue" also moves to step 2, or back to the result when the valuer asked for more. */
export async function saveDetailsAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const actor = await currentActor();
  const valuationId = readId(formData.get("valuationId"));
  if (!actor || !valuationId) return { ok: false, error: NOT_SIGNED_IN };

  try {
    await updateValuationDetails({ valuationId, actor, raw: detailsRawFromFormData(formData) });
  } catch (error) {
    const message = valuationErrorMessage(error);
    return { ok: false, error: message, field: detailFieldForError(message) ?? undefined };
  }
  refreshValuation(valuationId);

  if (formData.get("intent") === "continue") {
    // The target is chosen here from the id, never taken from the form.
    const next = formData.get("continueTo") === REQUESTER_PATHS.review(valuationId) ? REQUESTER_PATHS.review(valuationId) : REQUESTER_PATHS.result(valuationId);
    redirect(next);
  }
  return { ok: true, message: "Draft saved." };
}

/** Adds photos (the "files" field) and the optional video (the "video" field). Each goes through the media pipeline. */
export async function addMediaAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const actor = await currentActor();
  const valuationId = readId(formData.get("valuationId"));
  if (!actor || !valuationId) return { ok: false, error: NOT_SIGNED_IN };

  const photos = formData.getAll("files").filter((v): v is File => typeof v !== "string" && v.size > 0);
  const videos = formData.getAll("video").filter((v): v is File => typeof v !== "string" && v.size > 0);
  if (photos.length === 0 && videos.length === 0) return { ok: false, error: "Choose at least one photo or a video to add.", field: "photos" };

  let added = 0;
  for (const file of [...photos, ...videos]) {
    try {
      await addValuationMedia({ valuationId, actor, bytes: Buffer.from(await file.arrayBuffer()) });
      added += 1;
    } catch (error) {
      refreshValuation(valuationId);
      const message = valuationErrorMessage(error);
      const field = videos.includes(file) ? "video" : "photos";
      return {
        ok: false,
        error: added > 0 ? `${added} added. ${message}` : message,
        field,
      };
    }
  }
  refreshValuation(valuationId);
  return { ok: true, message: added === 1 ? "Added 1 file." : `Added ${added} files.` };
}

export async function removeMediaAction(valuationId: string, mediaId: string): Promise<ActionResult> {
  const actor = await currentActor();
  const id = readId(valuationId);
  const media = readId(mediaId);
  if (!actor || !id || !media) return { ok: false, error: NOT_SIGNED_IN };
  try {
    await removeValuationMedia({ valuationId: id, mediaId: media, actor });
  } catch (error) {
    return { ok: false, error: valuationErrorMessage(error), field: "photos" };
  }
  refreshValuation(id);
  return { ok: true, message: "Photo removed." };
}

/** The "Ask an expert valuer to review this" checkbox. Only before submission. */
export async function setRequestExpertAction(valuationId: string, requestExpert: boolean): Promise<ActionResult> {
  const actor = await currentActor();
  const id = readId(valuationId);
  if (!actor || !id) return { ok: false, error: NOT_SIGNED_IN };
  try {
    await setRequestExpert({ valuationId: id, actor, requestExpert: requestExpert === true });
  } catch (error) {
    return { ok: false, error: valuationErrorMessage(error) };
  }
  refreshValuation(id);
  return { ok: true };
}

/** Submits for a valuation. Redirects to the result page on success. */
export async function submitValuationAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const actor = await currentActor();
  const valuationId = readId(formData.get("valuationId"));
  if (!actor || !valuationId) return { ok: false, error: NOT_SIGNED_IN };

  try {
    await submitValuation({ valuationId, actor, requestExpert: formData.get("requestExpert") === "on" });
  } catch (error) {
    return { ok: false, error: valuationErrorMessage(error), field: "photos" };
  }
  refreshValuation(valuationId);
  refreshDashboards();
  redirect(REQUESTER_PATHS.result(valuationId));
}

/** The requester's reply to the valuer's question. Photos can be added separately with addMediaAction. */
export async function answerInfoAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const actor = await currentActor();
  const valuationId = readId(formData.get("valuationId"));
  if (!actor || !valuationId) return { ok: false, error: NOT_SIGNED_IN };
  const body = formData.get("body");
  try {
    await answerValuationInfoRequest({ valuationId, actor, body: typeof body === "string" ? body : "" });
  } catch (error) {
    return { ok: false, error: valuationErrorMessage(error), field: "reply" };
  }
  refreshValuation(valuationId);
  refreshDashboards();
  return { ok: true, message: "Reply sent to the valuer." };
}

/** The seller of a listing publishes, or hides, their own completed report on that listing. */
export async function setPublishedAction(valuationId: string, publish: boolean): Promise<ActionResult> {
  const actor = await currentActor();
  const id = readId(valuationId);
  if (!actor || !id) return { ok: false, error: NOT_SIGNED_IN };
  try {
    await setPublishedOnListing({ valuationId: id, actor, publish: publish === true });
  } catch (error) {
    return { ok: false, error: valuationErrorMessage(error) };
  }
  refreshValuation(id);
  return { ok: true, message: publish ? "Published on your listing." : "Removed from your listing." };
}
