import { prisma } from "@/lib/db/client";
import { VALUATOR_QUEUE_STATUSES } from "./valuator-queue";

/**
 * Basic valuation stats for admins. Each query is a simple count or group-by on the status, valuedBy, createdAt or
 * assignedValuatorId columns. The average uses one aggregate over completed expert requests.
 */

export interface ValuationStats {
  statusCounts: Array<{ status: string; count: number }>;
  autoCompletions: number;
  expertCompletions: number;
  averageExpertHours: number | null;
  openPerValuator: Array<{ valuatorId: string | null; name: string; count: number }>;
  newLast7Days: number;
  newLast30Days: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function loadValuationStats(now = new Date()): Promise<ValuationStats> {
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);

  const [statusRows, autoCompletions, expertCompletions, averageRows, openRows, newLast7Days, newLast30Days] =
    await Promise.all([
      prisma.valuation.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.valuation.count({ where: { status: "AUTO_VALUED" } }),
      prisma.valuation.count({ where: { status: "COMPLETED", valuedBy: "EXPERT" } }),
      prisma.$queryRaw<Array<{ hours: number | null }>>`
        SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "submittedAt")) / 3600.0)::float8 AS hours
        FROM "Valuation"
        WHERE "valuedBy" = 'EXPERT' AND "completedAt" IS NOT NULL AND "submittedAt" IS NOT NULL
      `,
      prisma.valuation.groupBy({
        by: ["assignedValuatorId"],
        where: { status: { in: [...VALUATOR_QUEUE_STATUSES] }, withdrawnAt: null },
        _count: { _all: true },
      }),
      prisma.valuation.count({ where: { createdAt: { gte: since7 } } }),
      prisma.valuation.count({ where: { createdAt: { gte: since30 } } }),
    ]);

  const valuatorIds = openRows.map((r) => r.assignedValuatorId).filter((id): id is string => id !== null);
  const valuators = valuatorIds.length
    ? await prisma.user.findMany({ where: { id: { in: valuatorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const nameOf = new Map(valuators.map((v) => [v.id, v.name ?? v.email]));

  const average = averageRows[0]?.hours;
  return {
    statusCounts: statusRows
      .map((row) => ({ status: row.status, count: row._count._all }))
      .sort((a, b) => a.status.localeCompare(b.status)),
    autoCompletions,
    expertCompletions,
    averageExpertHours: typeof average === "number" && Number.isFinite(average) ? Math.round(average * 10) / 10 : null,
    openPerValuator: openRows
      .map((row) => ({
        valuatorId: row.assignedValuatorId,
        name: row.assignedValuatorId === null ? "Unassigned" : nameOf.get(row.assignedValuatorId) ?? "Unknown valuer",
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count),
    newLast7Days,
    newLast30Days,
  };
}
