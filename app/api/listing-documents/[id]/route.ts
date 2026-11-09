import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/client";
import { canViewListing, isOwnListing } from "@/lib/listings/visibility";
import { sanitizeFileName } from "@/lib/seller/sanitize-filename";
import { getStorageProvider } from "@/lib/storage/storage";

/**
 * Listing documents (certificates, valuation reports, lab documents).
 *
 * Who gets the file:
 * - ADMIN: always.
 * - The owning seller: always.
 * - Anyone else: only when the document is isPublic, VERIFIED, and its listing is public.
 * Everything else gets 404 (no existence leak). Always sent as an attachment with nosniff.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const doc = await prisma.listingDocument.findUnique({
    where: { id },
    select: {
      fileKey: true,
      fileName: true,
      mimeType: true,
      isPublic: true,
      verificationStatus: true,
      gemstone: {
        select: {
          status: true,
          availability: true,
          seller: { select: { approvalStatus: true, userId: true } },
        },
      },
    },
  });
  if (!doc) return notFound();

  const session = await auth();
  const viewer = session?.user ? { id: session.user.id, role: session.user.role } : null;

  const isStaff = viewer?.role === "ADMIN" || isOwnListing(doc.gemstone, viewer?.id);
  const publicDoc =
    doc.isPublic && doc.verificationStatus === "VERIFIED" && canViewListing(doc.gemstone, null);
  if (!isStaff && !publicDoc) return notFound();

  let bytes: Buffer;
  try {
    bytes = await getStorageProvider().get(doc.fileKey);
  } catch {
    return notFound();
  }

  const shared = publicDoc && !isStaff;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${sanitizeFileName(doc.fileName)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": shared ? "public, max-age=60" : "private, no-store",
    },
  });
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "private, no-store" } });
}
