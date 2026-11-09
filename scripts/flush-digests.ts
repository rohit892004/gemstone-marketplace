import "dotenv/config";
import { prisma } from "@/lib/db/client";
import { flushMessageDigests } from "@/lib/notifications/service";

/**
 * Sends one batched email per user for message notifications whose 10-minute window has passed.
 * Run on a schedule, for example every 5 minutes: npm run notify:flush
 */
async function main(): Promise<void> {
  const sent = await flushMessageDigests();
  console.log(`Message digests sent: ${sent}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
