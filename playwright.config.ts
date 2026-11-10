import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./e2e/test-database";

/**
 * End-to-end tests run against a PRODUCTION build (`npm run build` first) with the demo seed loaded.
 * Emails use the console provider, so the server writes them to e2e/.server.log, which the tests read
 * to get verification links. The journey is one serial flow; workers stay at 1.
 *
 * The suite uses its own database (gemstone_test). The app server and the global setup both get that URL,
 * so nothing the tests create reaches the development database. Prepare it with `npm run test:e2e:db`.
 */
const E2E_DATABASE_URL = e2eDatabaseUrl();
process.env.DATABASE_URL = E2E_DATABASE_URL;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3200",
    trace: "retain-on-failure",
    // Fail a missing element in seconds, not after the whole test timeout.
    actionTimeout: 15_000,
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next start -p 3200 > e2e/.server.log 2>&1",
    url: "http://localhost:3200",
    reuseExistingServer: false,
    timeout: 180_000,
    // Lets the console email provider run under NODE_ENV=production so the log captures links.
    // APP_URL matches the port the server runs on, so referral links and emails point at the e2e server.
    // ALLOW_DEMO_SEED is forced off here: `next start` loads .env, where it is "true" for local seeding, and the
    // production guard in lib/config/env.ts refuses that value, which would make every page a 500.
    env: { ALLOW_NON_DELIVERING_PROVIDERS: "true", APP_URL: "http://localhost:3200", ALLOW_DEMO_SEED: "false", DATABASE_URL: E2E_DATABASE_URL },
  },
});
