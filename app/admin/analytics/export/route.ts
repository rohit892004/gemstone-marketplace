import { toCsv, safeFileName, type CsvCell } from "@/lib/analytics/csv";
import { loadPlatformDashboard } from "@/lib/analytics/platform-dashboard";
import { PLATFORM_CSV_HEADER, platformDailyCsvRows } from "@/lib/analytics/platform-summary";
import { parseRange } from "@/lib/analytics/seller-trends";
import { requireApiRole } from "@/lib/auth/require-role";

/**
 * Platform analytics as CSV: the daily totals, then the top categories and top searches. Admin only. No tier limit.
 */
export async function GET(request: Request) {
  const access = await requireApiRole(["ADMIN"]);
  if (!access.ok) return access.response;

  const requested = parseRange(new URL(request.url).searchParams.get("range"));
  const data = await loadPlatformDashboard({ requestedRange: requested });

  const lines: CsvCell[][] = [[...PLATFORM_CSV_HEADER], ...platformDailyCsvRows(data.rows, data.days)];
  lines.push([]);
  lines.push(["Top categories", "Listing views"]);
  for (const row of data.topCategories) lines.push([row.name, row.count]);
  lines.push([]);
  lines.push(["Top searches", "Searches"]);
  for (const row of data.topTerms) lines.push([row.name, row.count]);

  const fileName = safeFileName(`platform-analytics-${requested}-days-${data.lastFigureDay ?? "no-data"}.csv`);
  return new Response(toCsv(lines), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
