import { connection } from "next/server";
import { prisma } from "@/lib/db/client";
import { APP_VERSION } from "@/lib/config/version";
import { buildHealthResult } from "@/lib/health/health";

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
  } catch {
    // Details are deliberately not returned. The error reporter hook is wired in M6 hardening.
  }
  const { httpStatus, body } = buildHealthResult(databaseOk, APP_VERSION);
  return Response.json(body, { status: httpStatus, headers: { "Cache-Control": "no-store" } });
}
