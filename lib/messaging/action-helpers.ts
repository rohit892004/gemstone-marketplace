import { getEnv } from "@/lib/config/env";
import { AuthzError } from "@/lib/auth/require-role";
import { MessagingError, type UploadedFile } from "./service";

/**
 * Helpers shared by the buyer-side server actions (enquiries, contact, offers, requirements).
 * Kept separate from app/conversations/actions.ts, which owns its own copies.
 */

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export const GENERIC_ACTION_ERROR = "Something went wrong. Try again.";

/** Maps an error to a message that is safe to show. Known domain errors pass through; the rest is generic. */
export function messageForActionError(error: unknown): string {
  if (error instanceof MessagingError) return error.message;
  if (error instanceof AuthzError) return "Your account can't do this right now.";
  console.error("[messaging] action failed", error);
  return GENERIC_ACTION_ERROR;
}

/**
 * Reads uploads from a form. A file over the limit is not buffered in full: it is passed on as a
 * placeholder one byte over the limit, so validateUpload rejects it with "too large".
 */
export async function readUploads(formData: FormData, field = "files"): Promise<UploadedFile[]> {
  const out: UploadedFile[] = [];
  const limit = getEnv().UPLOAD_MAX_MB * 1024 * 1024;
  for (const value of formData.getAll(field)) {
    if (typeof value === "string" || value.size === 0) continue;
    if (value.size > limit) {
      out.push({ fileName: value.name, bytes: Buffer.alloc(limit + 1) });
      continue;
    }
    out.push({ fileName: value.name, bytes: Buffer.from(await value.arrayBuffer()) });
  }
  return out;
}
