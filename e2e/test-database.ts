import { config as loadEnv } from "dotenv";

/**
 * The end-to-end suite writes to its own database, never the development one. Its name must end in "_test".
 *
 *   E2E_DATABASE_URL   used as-is when set (must name a database ending in "_test")
 *   otherwise          the DATABASE_URL from .env with the database name replaced by "gemstone_test"
 *
 * Prepare it with `npm run test:e2e:db` (creates the database, applies migrations, loads the demo seeds).
 */
loadEnv({ path: ".env" });

export const E2E_DB_SUFFIX = "_test";

export function e2eDatabaseUrl(): string {
  const explicit = process.env.E2E_DATABASE_URL?.trim();
  const base = explicit || process.env.DATABASE_URL?.trim() || "postgres://postgres:postgres@127.0.0.1:54330/gemstone";
  const url = new URL(base);
  if (!explicit) url.pathname = "/gemstone_test";
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name.endsWith(E2E_DB_SUFFIX)) {
    throw new Error(`The e2e suite refuses to use database "${name}". Its name must end in "${E2E_DB_SUFFIX}". Set E2E_DATABASE_URL.`);
  }
  return url.toString();
}

/** Database name only, for log lines. Never prints credentials. */
export function e2eDatabaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}
