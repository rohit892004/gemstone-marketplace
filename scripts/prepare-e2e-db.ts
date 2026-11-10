/**
 * Prepares the end-to-end test database (gemstone_test): creates it if missing, applies migrations and loads
 * the same seeds as the development database. Safe to re-run; the seeds are idempotent.
 *
 *   npm run test:e2e:db
 *
 * Never touches the development database: every command gets the e2e URL, and e2eDatabaseUrl() refuses
 * any name that does not end in _test.
 */
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { e2eDatabaseName, e2eDatabaseUrl } from "../e2e/test-database";

const url = e2eDatabaseUrl();
const name = e2eDatabaseName(url);

async function ensureDatabase(): Promise<void> {
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const found = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (found.rowCount === 0) {
      // Name is checked by e2eDatabaseUrl() above, so it is safe to quote directly.
      await client.query(`CREATE DATABASE "${name}"`);
      console.log(`[e2e-db] created database ${name}`);
    } else {
      console.log(`[e2e-db] database ${name} exists`);
    }
  } finally {
    await client.end();
  }
}

function run(script: string, extraEnv: Record<string, string> = {}): void {
  const result = spawnSync("npm", ["run", script], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, DATABASE_URL: url, ...extraEnv },
  });
  if (result.status !== 0) {
    console.error(`[e2e-db] "npm run ${script}" failed with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

async function main(): Promise<void> {
  await ensureDatabase();
  run("db:deploy");
  run("db:seed");
  run("db:seed:demo", { DEMO_SELLER_PASSWORD: "Demo-Seller-Pass-1" });
  run("db:seed:m4", { ALLOW_DEMO_SEED: "true" });
  run("db:seed:m5", { ALLOW_DEMO_SEED: "true" });
  run("db:seed:m6", { ALLOW_DEMO_SEED: "true" });
  console.log(`[e2e-db] ${name} is ready`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
