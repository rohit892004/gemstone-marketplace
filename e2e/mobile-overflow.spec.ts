import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { hashPassword } from "../lib/auth/password";
import { clearLoginLimits } from "./helpers/rate-limits";

/**
 * No page may scroll sideways at a 390px phone width. Every page the journeys use is visited here, signed in as
 * the role that sees it. The check is document.documentElement.scrollWidth against the viewport width.
 */

test.use({ viewport: { width: 390, height: 844 } });

const ADMIN_EMAIL = "admin@gemstone.local";
const ADMIN_PASSWORD = "ChangeMe-Local-1";
const SELLER_EMAIL = "himalaya-gem-house@demo.gemstone.local";
const SELLER_PASSWORD = process.env.DEMO_SELLER_PASSWORD || "Demo-Seller-Pass-1";
const BUYER_EMAIL = "demo-buyer-1@example.com";
const BUYER_PASSWORD = "Demo-Buyer-Pass-1";
const VALUER_EMAIL = "demo.valuer@example.test";
const VALUER_PASSWORD = process.env.M4_DEMO_VALUATOR_PASSWORD || "demo-valuer-dev-only-change-me";
const SELLER_SLUG = "himalaya-gem-house";

const offenders: string[] = [];

async function login(page: Page, email: string, password: string) {
  await clearLoginLimits();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function measureWhenStable(page: Page): Promise<{ scroll: number; client: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
    } catch (error) {
      if (!String(error).includes("Execution context was destroyed")) throw error;
      await page.waitForLoadState("load", { timeout: 15_000 });
    }
  }
  throw new Error("The page kept navigating; could not measure it.");
}

/** Visits each path, waits for the page to settle, and records any sideways overflow. */
async function checkPages(page: Page, paths: string[]) {
  for (const path of paths) {
    // "networkidle" can never settle on a page that keeps a connection open, so wait for load with a bound instead.
    const response = await page.goto(path, { waitUntil: "load", timeout: 45_000 });
    await page.waitForLoadState("load", { timeout: 15_000 });
    const status = response?.status() ?? 0;
    // A page can redirect after load (client-side). Measure again once the new page has loaded.
    const measure = await measureWhenStable(page);
    if (measure.scroll > measure.client + 1) offenders.push(`${path} (status ${status}): ${measure.scroll}px > ${measure.client}px`);
  }
}

test("no page scrolls sideways at 390px", async ({ browser }) => {
  test.setTimeout(900_000);
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    // Known password for the demo buyer, set for this test only (the demo seed leaves it unusable).
    await db.query('UPDATE "User" SET "passwordHash" = $1 WHERE email = $2', [await hashPassword(BUYER_PASSWORD), BUYER_EMAIL]);

    const listing = await db.query(
      `SELECT g.id, g.slug FROM "Gemstone" g JOIN "SellerProfile" sp ON sp.id = g."sellerId"
       WHERE sp.slug = $1 AND g.status = 'PUBLISHED' ORDER BY g."createdAt" LIMIT 2`,
      [SELLER_SLUG],
    );
    const [first] = listing.rows as Array<{ id: string; slug: string }>;
    const category = (await db.query('SELECT slug FROM "Category" ORDER BY name LIMIT 1')).rows[0]?.slug as string | undefined;
    const reference = (await db.query(`SELECT reference FROM "Valuation" WHERE status = 'AUTO_VALUED' LIMIT 1`)).rows[0]?.reference as string | undefined;
    const valuation = (
      await db.query(
        `SELECT v.id FROM "Valuation" v JOIN "User" u ON u.id = v."assignedValuatorId" WHERE u.email = $1 LIMIT 1`,
        [VALUER_EMAIL],
      )
    ).rows[0]?.id as string | undefined;

    const publicPaths = [
      "/",
      "/gemstones",
      "/sellers",
      `/sellers/${SELLER_SLUG}`,
      first ? `/gemstones/${first.slug}` : null,
      category ? `/categories/${category}` : null,
      "/valuation",
      reference ? `/valuation/verify/${reference}` : null,
      "/learn",
      "/login",
      "/register/buyer",
      "/register/seller",
    ].filter((p): p is string => p !== null);

    const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await checkPages(await anon.newPage(), publicPaths);
    await anon.close();

    const buyerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const buyerPage = await buyerContext.newPage();
    await login(buyerPage, BUYER_EMAIL, BUYER_PASSWORD);
    await checkPages(buyerPage, [
      "/buyer",
      "/buyer/wishlist",
      "/buyer/enquiries",
      "/buyer/valuations",
      "/buyer/reports",
      "/buyer/requirements",
      "/buyer/requirements/new",
      "/conversations",
      "/notifications",
      "/notifications/preferences",
    ]);
    await buyerContext.close();

    const sellerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const sellerPage = await sellerContext.newPage();
    await login(sellerPage, SELLER_EMAIL, SELLER_PASSWORD);
    await checkPages(sellerPage, [
      "/seller",
      "/seller/portfolio",
      "/seller/listings",
      "/seller/listings/new",
      first ? `/seller/listings/${first.id}/edit` : "/seller/listings",
      "/seller/inventory",
      "/seller/inbox",
      "/seller/enquiries",
      "/seller/quotations",
      "/seller/offers",
      "/seller/requirements",
      "/seller/requirements/mine",
      "/seller/valuations",
      "/seller/reports",
      "/seller/analytics",
      "/seller/membership",
      "/conversations",
    ]);
    await sellerContext.close();

    const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    await checkPages(adminPage, [
      "/admin",
      "/admin/sellers",
      "/admin/listings",
      "/admin/listings/all",
      "/admin/documents",
      "/admin/reports",
      "/admin/requirements",
      "/admin/conversations",
      "/admin/moderation",
      "/admin/reviews",
      "/admin/settings",
      "/admin/homepage",
      "/admin/valuations",
      "/admin/valuations/valuators",
      "/admin/valuations/prices",
      "/admin/valuations/settings",
      "/admin/valuations/stats",
      "/admin/analytics",
      "/admin/memberships",
      "/admin/memberships/rules",
      "/admin/referrals",
      reference ? `/admin/valuations/${(await db.query('SELECT id FROM "Valuation" WHERE reference = $1', [reference])).rows[0]?.id}` : "/admin/valuations",
    ]);
    await adminContext.close();

    const valuatorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const valuatorPage = await valuatorContext.newPage();
    await login(valuatorPage, VALUER_EMAIL, VALUER_PASSWORD);
    await checkPages(valuatorPage, ["/valuator/queue", valuation ? `/valuator/valuations/${valuation}` : "/valuator/queue"]);
    await valuatorContext.close();
  } finally {
    await db.end();
  }

  expect(offenders, `Pages that scroll sideways at 390px:\n${offenders.join("\n")}`).toEqual([]);
});
