/**
 * Public URLs for listing files. Files are never linked straight from storage: every request
 * goes through a route that checks the listing's visibility first.
 */

export type MediaVariant = "thumb" | "full";

export function mediaUrl(mediaId: string, variant: MediaVariant): string {
  return `/api/media/${encodeURIComponent(mediaId)}/${variant}`;
}

export function listingDocumentUrl(documentId: string): string {
  return `/api/listing-documents/${encodeURIComponent(documentId)}`;
}
