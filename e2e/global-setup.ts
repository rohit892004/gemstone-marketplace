import { Client } from "pg";
import { E2E_DB_SUFFIX, e2eDatabaseName } from "./test-database";

/**
 * Before the journey: clear the database-backed rate-limit counters. Every run comes from the same
 * machine (same IP), so without this the registration and login limits would trip across runs.
 * The URL is the e2e test database set in playwright.config.ts. Refuses any database not named *_test.
 */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set; the e2e setup needs the e2e test database.");
  if (!e2eDatabaseName(url).endsWith(E2E_DB_SUFFIX)) {
    throw new Error(`Refusing to run e2e against database "${e2eDatabaseName(url)}". Use the *${E2E_DB_SUFFIX} database.`);
  }
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to clear rate limits in production.");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query('DELETE FROM "RateLimit"');
    console.log(`[e2e] cleared ${result.rowCount ?? 0} rate-limit counters`);
  } finally {
    await client.end();
  }
}
