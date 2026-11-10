/**
 * Pure response builder for GET /api/health. The body carries only the status, the database state and the
 * app version. It never includes env values, hostnames, error messages or stack traces.
 */
export interface HealthBody {
  status: "ok" | "degraded";
  database: "ok" | "down";
  version?: string;
}

export function buildHealthResult(databaseOk: boolean, version: string): { httpStatus: number; body: HealthBody } {
  if (databaseOk) {
    return { httpStatus: 200, body: { status: "ok", database: "ok", version } };
  }
  return { httpStatus: 503, body: { status: "degraded", database: "down" } };
}
