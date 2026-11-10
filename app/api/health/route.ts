import { connection } from "next/server";
import { prisma } from "@/lib/db/client";
import { APP_VERSION } from "@/lib/config/version";
import { buildHealthResult } from "@/lib/health/health";
import { reportError } from "@/lib/observability/report-error";

/**
 * Liveness and database check for load balancers and uptime monitors. No auth. Runs at request time
 * (never cached or prerendered), so a database outage shows up on the next call.
 */
export async function GET() {
  await connection();
  let databaseOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseOk = true;
  } catch (error) {
    // Details are never returned to the caller. They go to the server log and, when configured, to Sentry.
    console.error("health: database check failed");
    await reportError(error, { route: "/api/health" });
  }
  const { httpStatus, body } = buildHealthResult(databaseOk, APP_VERSION);
  return Response.json(body, { status: httpStatus, headers: { "Cache-Control": "no-store" } });
}
