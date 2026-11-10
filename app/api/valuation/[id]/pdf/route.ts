import { auth } from "@/lib/auth/auth";
import { renderValuationReport } from "@/lib/valuation/documents";

/**
 * Downloads the valuation report PDF. Requester and admin only, and only once a result exists (or after
 * withdrawal). Anyone else, or a request with no result yet, gets 404. Never cached publicly.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user) return notFound();

  const report = await renderValuationReport(id, { id: session.user.id, role: session.user.role });
  if (!report) return notFound();

  return new Response(new Uint8Array(report.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
}
