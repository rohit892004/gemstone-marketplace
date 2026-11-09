import "dotenv/config";
import { Client } from "pg";

/**
 * Before the journey: clear the database-backed rate-limit counters. Every run comes from the same
 * machine (same IP), so without this the registration and login limits would trip across runs.
 * Only the DATABASE_URL from .env is used, which is the local test database.
 */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set; the e2e setup needs the local test database.");
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
