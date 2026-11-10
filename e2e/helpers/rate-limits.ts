import "dotenv/config";
import { Client } from "pg";

/**
 * The login limit is 30 attempts per IP per 15 minutes. One machine runs the whole suite, so a long run
 * would trip it and fail unrelated journeys. Each login clears the login counters first. Test database only.
 */
export async function clearLoginLimits(): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to clear rate limits in production.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`DELETE FROM "RateLimit" WHERE key LIKE 'login:%'`);
  } finally {
    await client.end();
  }
}
