import "dotenv/config";
import { prisma } from "@/lib/db/client";
import { runAnalyticsRollup } from "@/lib/analytics/rollup";

/**
 * Daily analytics rollup: aggregates finished days, deletes raw events past 90 days, runs the tier and referral
 * passes. Schedule it once a day, shortly after midnight UTC: npm run analytics:rollup
 */
async function main(): Promise<void> {
  const summary = await runAnalyticsRollup(new Date(), null);
  console.log(JSON.stringify(summary));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
