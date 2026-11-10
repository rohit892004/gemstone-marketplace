import { requireApiRole } from "@/lib/auth/require-role";
import { loadExportRows, exportCsvText } from "@/lib/valuation/admin-prices";

/**
 * Reference price CSV export. Admin only: requireApiRole answers 401 or 403 for everyone else. The file has the same
 * header the importer expects, so an export can be imported again unchanged.
 */
export async function GET(): Promise<Response> {
  const auth = await requireApiRole(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const csv = exportCsvText(await loadExportRows());
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gemstone-reference-prices-${date}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
