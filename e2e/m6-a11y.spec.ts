import "dotenv/config";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, type BrowserContext, type Page, expect, test } from "@playwright/test";
import { Client } from "pg";
import { hashPassword } from "../lib/auth/password";
import { clearLoginLimits } from "./helpers/rate-limits";

/**
 * M6 accessibility check. Runs axe with the WCAG 2.0 and 2.1 A and AA rule sets on every public M6 page and on the
 * main signed-in pages. A page fails when axe reports any violation with impact "serious" or "critical". Every
 * violation (any impact) is printed so the report can list rule id, impact, count and the first target.
 */

const ADMIN_EMAIL = "admin@gemstone.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe-Local-1";
const BUYER_EMAIL = "demo-buyer-1@example.com";
const BUYER_PASSWORD = "Demo-Buyer-Pass-1";
const SELLER_EMAIL = "himalaya-gem-house@demo.gemstone.local";
const SELLER_PASSWORD = process.env.DEMO_SELLER_PASSWORD || "Demo-Seller-Pass-1";
const SELLER_SLUG = "himalaya-gem-house";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["serious", "critical"]);

type Violation = { id: string; impact: string | null | undefined; count: number; firstTarget: string };
type PageReport = { path: string; violations: Violation[] };

async function login(page: Page, email: string, password: string) {
  await clearLoginLimits();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Loads the path, waits for the page to settle, and runs axe. Returns every violation found. */
async function auditPage(page: Page, path: string): Promise<PageReport> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const violations: Violation[] = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    count: v.nodes.length,
    firstTarget: v.nodes[0]?.target.join(" ") ?? "",
  }));
  return { path, violations };
}

function blocking(report: PageReport): Violation[] {
  return report.violations.filter((v) => BLOCKING.has(v.impact ?? ""));
}

/** Audits each path in one context, prints every violation, then asserts none is serious or critical. */
async function auditAll(context: BrowserContext, paths: string[]) {
  const page = await context.newPage();
  const reports: PageReport[] = [];
  for (const path of paths) reports.push(await auditPage(page, path));

  for (const report of reports) {
    if (report.violations.length > 0) {
      console.log(`[axe] ${report.path}\n${JSON.stringify(report.violations, null, 2)}`);
    } else {
      console.log(`[axe] ${report.path}: no violations`);
    }
  }
  const failing = reports.filter((r) => blocking(r).length > 0).map((r) => ({ path: r.path, blocking: blocking(r) }));
  expect(failing, "pages with serious or critical axe violations").toEqual([]);
}

test.describe("M6 accessibility (axe, WCAG 2.1 A and AA)", () => {
  test.describe.configure({ mode: "serial" });

  test("public M6 pages", async ({ browser }: { browser: Browser }) => {
    test.setTimeout(600_000);
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    let productPath: string | null = null;
    try {
      const row = (
        await db.query(
          `SELECT g.slug FROM "Gemstone" g JOIN "SellerProfile" sp ON sp.id = g."sellerId"
           WHERE sp.slug = $1 AND g.status = 'PUBLISHED' ORDER BY g."createdAt" LIMIT 1`,
          [SELLER_SLUG],
        )
      ).rows[0] as { slug: string } | undefined;
      productPath = row ? `/gemstones/${row.slug}` : null;
    } finally {
      await db.end();
    }
    expect(productPath, "a published demo product must exist").not.toBeNull();

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await auditAll(context, [
      "/",
      "/gemstones",
      "/education",
      "/news",
      "/reference",
      "/newsletter",
      "/legal/terms",
      "/legal/privacy",
      "/legal/cookies",
      "/legal/seller-agreement",
      "/this-page-does-not-exist",
      productPath!,
      `/sellers/${SELLER_SLUG}`,
    ]);
    await context.close();
  });

  test("buyer dashboard", async ({ browser }: { browser: Browser }) => {
    test.setTimeout(300_000);
    // The demo buyer's known password is set here for this run (the demo seed leaves it unusable), as the overflow spec does.
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      await db.query('UPDATE "User" SET "passwordHash" = $1 WHERE email = $2', [await hashPassword(BUYER_PASSWORD), BUYER_EMAIL]);
    } finally {
      await db.end();
    }
    const buyer = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await login(await buyer.newPage(), BUYER_EMAIL, BUYER_PASSWORD);
    await auditAll(buyer, ["/buyer"]);
    await buyer.close();
  });

  test("seller dashboard", async ({ browser }: { browser: Browser }) => {
    test.setTimeout(300_000);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await login(await context.newPage(), SELLER_EMAIL, SELLER_PASSWORD);
    await auditAll(context, ["/seller"]);
    await context.close();
  });

  test("admin newsletter overview", async ({ browser }: { browser: Browser }) => {
    test.setTimeout(300_000);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await login(await context.newPage(), ADMIN_EMAIL, ADMIN_PASSWORD);
    await auditAll(context, ["/admin/newsletter"]);
    await context.close();
  });
});
