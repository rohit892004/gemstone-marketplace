import { auth } from "@/lib/auth/auth";
import { loadValuationMediaForActor } from "@/lib/valuation/documents";

/**
 * Serves a valuation photo or video to the requester, the assigned valuator, or an admin. Anyone else gets 404,
 * so the existence of another person's valuation media is not revealed. Never cached publicly.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; variant: string }> }) {
  const { id, variant } = await ctx.params;
  if (variant !== "thumb" && variant !== "full") return notFound();

  const session = await auth();
  if (!session?.user) return notFound();
  const actor = { id: session.user.id, role: session.user.role };

  const file = await loadValuationMediaForActor(id, actor, variant);
  if (!file) return notFound();

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
}
