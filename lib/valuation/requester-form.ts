/**
 * Pure helpers for the requester forms. Shared by the client components and the server actions.
 * Limits here match the server rules in lib/valuation/service.ts (MAX_IMAGES, MAX_VIDEOS) and
 * lib/valuation/validate.ts (NOTES_MAX). The server always re-checks them.
 */

export const PHOTO_LIMIT = 12;
export const VIDEO_LIMIT = 1;
export const NOTES_LIMIT = 1000;

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
export const VIDEO_ACCEPT = "video/mp4,video/webm";
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

/** The details form fields, in display order. The names match the form inputs and parseValuationDetails. */
export const DETAIL_FIELDS = [
  "gemstoneType",
  "categoryId",
  "shape",
  "carat",
  "dimensions",
  "colour",
  "clarity",
  "qualityGrade",
  "origin",
  "treatment",
  "labId",
  "certificateNumber",
  "notes",
  "currency",
] as const;

export type DetailField = (typeof DETAIL_FIELDS)[number];

/** Field keys a form error can point at. "photos" and "video" belong to the photo section. */
export type FormErrorField = DetailField | "carat" | "photos" | "video" | "reply";

/** The result of a server action. */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; field?: FormErrorField };

/** The state a form keeps between submissions. Null before the first one. */
export type ValuationActionState = ActionResult | null;

/** Reads the details form into the raw shape parseValuationDetails expects. Missing fields become empty strings. */
export function detailsRawFromFormData(formData: FormData): Record<DetailField, string> {
  const out = {} as Record<DetailField, string>;
  for (const field of DETAIL_FIELDS) {
    const value = formData.get(field);
    out[field] = typeof value === "string" ? value : "";
  }
  return out;
}

/**
 * Maps the first error message from parseValuationDetails to the field it is about, so the form can mark it.
 * Returns null when the message does not name one field (the summary still shows it).
 */
export function detailFieldForError(message: string): FormErrorField | null {
  const text = message.toLowerCase();
  if (text.includes("carat")) return "carat";
  if (text.includes("gemstone type")) return "gemstoneType";
  if (text.includes("category")) return "categoryId";
  if (text.includes("certificate lab") || text.includes("lab from the list")) return "labId";
  if (text.includes("certificate number")) return "certificateNumber";
  if (text.includes("notes") || text.includes("contact")) return "notes";
  if (text.includes("currency")) return "currency";
  if (text.includes("shape")) return "shape";
  if (text.includes("dimensions")) return "dimensions";
  if (text.includes("colour")) return "colour";
  if (text.includes("clarity")) return "clarity";
  if (text.includes("origin")) return "origin";
  if (text.includes("treatment")) return "treatment";
  if (text.includes("grade")) return "qualityGrade";
  return null;
}

/** The reason the Submit button is blocked, or null when the request can be submitted. */
export function submitBlockReason(photoCount: number): string | null {
  if (photoCount < 1) return "Add at least one photo of the stone before you submit. The valuer and the estimate both need it.";
  return null;
}

/** How many more photos the requester may add. Never negative. */
export function photosRemaining(photoCount: number): number {
  return Math.max(0, PHOTO_LIMIT - photoCount);
}

/** A short client-side hint for a file. The server still checks the bytes, not the type. */
export function looksLikePhoto(file: { type: string }): boolean {
  return (PHOTO_TYPES as readonly string[]).includes(file.type);
}

export function looksLikeVideo(file: { type: string }): boolean {
  return (VIDEO_TYPES as readonly string[]).includes(file.type);
}

/** Counts characters for the notes field, for "123 of 1000 characters". */
export function notesCountLabel(length: number): string {
  return `${length} of ${NOTES_LIMIT} characters`;
}
