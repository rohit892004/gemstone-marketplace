import "dotenv/config";
import { publishDueArticles } from "../../lib/content/service";
import { prisma } from "../../lib/db/client";

/** Runs the worker's content-publish step once, the same call scripts/worker.ts makes. Used by the M6 journey. */
publishDueArticles()
  .then((count) => console.log(`published ${count} due article(s)`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
