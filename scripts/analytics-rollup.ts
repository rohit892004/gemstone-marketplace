import "dotenv/config";
import { prisma } from "@/lib/db/client";
import { runAnalyticsRollup } from "@/lib/analytics/rollup";

/**
 * Daily analytics rollup: aggregates finished days, deletes raw events past 90 days, runs the tier and referral
 * passes. Schedule it once a day, shortly after midnight UTC: npm run analytics:rollup
 * An optional --as-of=YYYY-MM-DD runs the job as if it were that day (a backfill, or a test that must see today's events).
 */
function asOf(): Date {
  const arg = process.argv.find((value) => value.startsWith("--as-of="));
  if (!arg) return new Date();
  const day = arg.slice("--as-of=".length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("--as-of must be YYYY-MM-DD");
  return new Date(day + "T12:00:00.000Z");
}

async function main(): Promise<void> {
  const summary = await runAnalyticsRollup(asOf(), null);
  console.log(JSON.stringify(summary));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
