import { connection } from "next/server";
import { checkRole } from "@/lib/auth/require-role";
import { coverContentType, isCoverKey } from "@/lib/content/cover";
import { isPubliclyVisible, type ContentStatusName } from "@/lib/content/status";
import { prisma } from "@/lib/db/client";
import { getStorageProvider } from "@/lib/storage/storage";

/**
 * Serves article cover images. Only keys shaped content/<id>/cover-<random>.<ext> AND referenced by an article
 * are served, so no other stored object can be reached through this route. Published, visible covers are public
 * and cacheable. Covers of drafts, scheduled or archived items are served to signed-in admins only, uncached.
 */

const NOT_FOUND = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }): Promise<Response> {
  await connection();
  const { key: segments } = await context.params;
  const key = segments.join("/");
  if (!isCoverKey(key)) return NOT_FOUND();
  const contentType = coverContentType(key);
  if (!contentType) return NOT_FOUND();

  const article = await prisma.article.findFirst({
    where: { coverKey: key },
    select: { status: true, publishedAt: true },
  });
  if (!article) return NOT_FOUND();

  const publiclyVisible = isPubliclyVisible(article.status as ContentStatusName, article.publishedAt, new Date());
  if (publiclyVisible) {
    return serve(key, contentType, "public, max-age=3600");
  }

  const access = await checkRole(["ADMIN"]);
  if (!access.ok) return NOT_FOUND();
  return serve(key, contentType, "private, no-store");
}

async function serve(key: string, contentType: string, cacheControl: string): Promise<Response> {
  let bytes: Buffer;
  try {
    bytes = await getStorageProvider().get(key);
  } catch {
    return NOT_FOUND();
  }
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.length),
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
