import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/client";
import { canViewListing, isOwnListing } from "@/lib/listings/visibility";
import { getStorageProvider } from "@/lib/storage/storage";

/**
 * Serves listing images. Public only when the listing is public. Otherwise 404, so the
 * existence of a hidden or unpublished image is not revealed.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; variant: string }> }) {
  const { id, variant } = await ctx.params;
  if (variant !== "thumb" && variant !== "full") return notFound();

  const media = await prisma.gemstoneMedia.findUnique({
    where: { id },
    select: {
      status: true,
      type: true,
      fileKey: true,
      thumbKey: true,
      mimeType: true,
      gemstone: {
        select: {
          status: true,
          availability: true,
          seller: { select: { approvalStatus: true, userId: true } },
        },
      },
    },
  });
  if (!media || media.status !== "READY") return notFound();

  const session = await auth();
  const viewer = session?.user ? { id: session.user.id, role: session.user.role } : null;
  if (!canViewListing(media.gemstone, viewer)) return notFound();

  const key = variant === "thumb" && media.thumbKey ? media.thumbKey : media.fileKey;
  const mimeType = variant === "thumb" && media.thumbKey ? "image/webp" : media.mimeType;

  let bytes: Buffer;
  try {
    bytes = await getStorageProvider().get(key);
  } catch {
    return notFound();
  }

  // Shared caches may store the response only when anyone could see it and the viewer is not the owner.
  const publicToAnyone = canViewListing(media.gemstone, null) && !isOwnListing(media.gemstone, viewer?.id);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": publicToAnyone ? "public, max-age=3600" : "private, no-store",
    },
  });
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "private, no-store" } });
}
