import { loadSellerDashboard } from "@/lib/analytics/seller-dashboard";
import { toCsv, safeFileName } from "@/lib/analytics/csv";
import { SELLER_CSV_HEADER, sellerDailyCsvRows } from "@/lib/analytics/seller-summary";
import { parseRange } from "@/lib/analytics/seller-trends";
import { requireApiRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { canExportCsv } from "@/lib/membership/tiers";
import { membershipSnapshot } from "@/lib/membership/service";

/**
 * Daily seller analytics as CSV. Elite only (canExportCsv), the same range rules as the page, and the signed-in
 * seller's own figures only. Private and never cached.
 */
export async function GET(request: Request) {
  const access = await requireApiRole(["SELLER"], { sellerApproved: true });
  if (!access.ok) return access.response;

  const profile = await prisma.sellerProfile.findUnique({ where: { userId: access.user.id }, select: { id: true } });
  if (!profile) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const snapshot = await membershipSnapshot(profile.id);
  if (!canExportCsv(snapshot.tier)) {
    return new Response("CSV export is an Elite benefit.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }

  const requested = parseRange(new URL(request.url).searchParams.get("range"));
  const data = await loadSellerDashboard({
    sellerProfileId: profile.id,
    requestedRange: requested,
    tierCapDays: snapshot.rule.analyticsDays,
  });

  const csv = toCsv([[...SELLER_CSV_HEADER], ...sellerDailyCsvRows(data.rows, data.days)]);
  const fileName = safeFileName(`seller-analytics-${data.range.days}-days-${data.lastFigureDay ?? "no-data"}.csv`);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
