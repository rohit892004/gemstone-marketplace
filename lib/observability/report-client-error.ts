"use server";

import { reportError } from "@/lib/observability/report-error";

/**
 * Called from the error boundaries in the browser. Only the Next.js error digest arrives here (never the
 * message or stack, which the browser does not receive in production), so nothing sensitive is sent.
 */
export async function reportClientError(digest: string | undefined): Promise<void> {
  const safeDigest = typeof digest === "string" && /^[A-Za-z0-9]{1,40}$/.test(digest) ? digest : undefined;
  await reportError(new Error("Unhandled client-side error boundary"), { source: "error-boundary", digest: safeDigest });
}
