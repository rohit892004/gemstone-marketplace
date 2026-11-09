import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/client";
import { getStorageProvider } from "@/lib/storage/storage";

/**
 * Seller logo and banner. Stored privately and served only through here.
 *
 * Shared caching only for APPROVED sellers viewed by someone who is not the owner.
 * Everyone else gets 404, so an unapproved seller's assets are not revealed.
 * Files are processed WebP with metadata already stripped (see lib/media/pipeline.ts).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await ctx.params;
  if (kind !== "logo" && kind !== "banner") return notFound();

  const seller = await prisma.sellerProfile.findUnique({
    where: { slug },
    select: { approvalStatus: true, logoKey: true, bannerKey: true, userId: true },
  });
  if (!seller) return notFound();

  const session = await auth();
  const isOwner = session?.user?.id === seller.userId;
  const isAdmin = session?.user?.role === "ADMIN";
  const approved = seller.approvalStatus === "APPROVED";
  if (!isOwner && !isAdmin && !approved) return notFound();

  const key = kind === "logo" ? seller.logoKey : seller.bannerKey;
  if (!key) return notFound();

  let bytes: Buffer;
  try {
    bytes = await getStorageProvider().get(key);
  } catch {
    return notFound();
  }

  const shared = approved && !isOwner && !isAdmin;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": shared ? "public, max-age=3600" : "private, no-store",
    },
  });
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "private, no-store" } });
}
