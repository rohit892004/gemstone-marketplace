import { auth } from "@/lib/auth/auth";
import { checkRole } from "@/lib/auth/require-role";
import { loadValuationMediaForActor } from "@/lib/valuation/documents";

/**
 * Serves a valuation photo or video to the requester, the assigned valuator, or an admin. Anyone else gets 404,
 * so the existence of another person's valuation media is not revealed. Never cached publicly.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; variant: string }> }) {
  const { id, variant } = await ctx.params;
  if (variant !== "thumb" && variant !== "full") return notFound();

  // Session alone is not enough: the account must still be ACTIVE and verified (checkRole reads the database).
  const session = await auth();
  if (!session?.user) return notFound();
  const access = await checkRole(["BUYER", "SELLER", "ADMIN", "VALUATOR"]);
  if (!access.ok) return notFound();
  const actor = { id: access.user.id, role: access.user.role };

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
