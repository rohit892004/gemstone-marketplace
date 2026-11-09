import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { MESSAGING_ROLES } from "@/lib/messaging/access";
import { sanitizeFileName } from "@/lib/seller/sanitize-filename";
import { getStorageProvider } from "@/lib/storage/storage";

/**
 * Message attachments. The attachment is resolved through its message and conversation, and the
 * caller must be a participant. Anything else gets 404. Served as a download with nosniff.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; attachmentId: string }> }) {
  const guard = await requireApiRole(MESSAGING_ROLES, { sellerApproved: true });
  if (!guard.ok) return guard.response;

  const { id, attachmentId } = await ctx.params;
  const attachment = await prisma.messageAttachment.findFirst({
    where: {
      id: attachmentId,
      message: { conversationId: id, conversation: { participants: { some: { userId: guard.user.id } } } },
    },
    select: { storageKey: true, fileName: true, mimeType: true },
  });
  if (!attachment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await getStorageProvider().get(attachment.storageKey);
  } catch {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${sanitizeFileName(attachment.fileName)}"`,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
