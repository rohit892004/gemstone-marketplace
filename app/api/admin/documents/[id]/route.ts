import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { requireApiRole } from "@/lib/auth/require-role";
import { documentResponseHeaders } from "@/lib/admin/document-download";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/security/client-ip";
import { assertValidStorageKey, getStorageProvider } from "@/lib/storage/storage";

/**
 * Private seller documents. The only route that serves them.
 *
 * Failure modes:
 * - not an admin: 401/403 from requireApiRole
 * - unknown id: 404
 * - stored fileKey fails assertValidStorageKey: 404 (the key is treated as not servable;
 *   the document id is logged server-side, the key is never returned)
 * - file missing on disk (ENOENT): 404
 * - any other storage failure: 500 with a generic body
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiRole(["ADMIN"]);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const doc = await prisma.sellerDocument.findUnique({
    where: { id },
    select: { id: true, sellerId: true, fileKey: true, fileName: true, mimeType: true },
  });
  if (!doc) return notFound();

  try {
    assertValidStorageKey(doc.fileKey);
  } catch {
    console.error("[documents] refusing to serve document with an invalid storage key", doc.id);
    return notFound();
  }

  let bytes: Buffer;
  try {
    bytes = await getStorageProvider().get(doc.fileKey);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.error("[documents] stored file is missing for document", doc.id);
      return notFound();
    }
    console.error("[documents] failed to read document", doc.id, error);
    return Response.json({ error: "INTERNAL" }, { status: 500 });
  }

  await recordAudit({
    action: AuditAction.DOCUMENT_DOWNLOADED,
    actorId: gate.user.id,
    entityType: "SellerDocument",
    entityId: doc.id,
    ip: getClientIp(request.headers),
    meta: { sellerId: doc.sellerId },
  });

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: documentResponseHeaders(doc, bytes.byteLength),
  });
}

function notFound(): Response {
  return Response.json({ error: "NOT_FOUND" }, { status: 404 });
}
