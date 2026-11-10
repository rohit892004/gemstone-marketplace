import "dotenv/config";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { type Browser, type Page, expect, test } from "@playwright/test";
import { Client } from "pg";
import { hashPassword } from "../lib/auth/password";

/**
 * M6 screenshots and overflow check. Saves full-page screenshots at 390px and 1440px to screenshots/m6/ and checks that
 * no M6 page scrolls sideways at 390px (document.documentElement.scrollWidth must not exceed the viewport width).
 */

const SHOTS = path.join(__dirname, "..", "screenshots", "m6");
const VIEWPORTS = [
  { width: 390, height: 844, label: "390" },
  { width: 1440, height: 900, label: "1440" },
] as const;

const ADMIN_EMAIL = "admin@gemstone.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe-Local-1";
const BUYER_EMAIL = "demo-buyer-1@example.com";
const BUYER_PASSWORD = "Demo-Buyer-Pass-1";
const SELLER_EMAIL = "himalaya-gem-house@demo.gemstone.local";
const SELLER_PASSWORD = process.env.DEMO_SELLER_PASSWORD || "Demo-Seller-Pass-1";
const SELLER_SLUG = "himalaya-gem-house";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

type Shot = { name: string; path: string; signedIn?: "buyer" | "seller" | "admin" };

test("M6 pages: screenshots at 390 and 1440, and no sideways scroll at 390", async ({ browser }: { browser: Browser }) => {
  test.setTimeout(900_000);
  mkdirSync(SHOTS, { recursive: true });

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  let product: string | undefined;
  try {
    await db.query('UPDATE "User" SET "passwordHash" = $1 WHERE email = $2', [await hashPassword(BUYER_PASSWORD), BUYER_EMAIL]);
    const row = (
      await db.query(
        `SELECT g.slug FROM "Gemstone" g JOIN "SellerProfile" sp ON sp.id = g."sellerId"
         WHERE sp.slug = $1 AND g.status = 'PUBLISHED' ORDER BY g."createdAt" LIMIT 1`,
        [SELLER_SLUG],
      )
    ).rows[0] as { slug: string } | undefined;
    product = row?.slug;
  } finally {
    await db.end();
  }
  expect(product, "a published demo product must exist").toBeTruthy();

  const shots: Shot[] = [
    { name: "homepage", path: "/" },
    { name: "product", path: `/gemstones/${product}` },
    { name: "education-index", path: "/education" },
    { name: "education-article", path: "/education/demo-reading-a-gemstone-lab-report" },
    { name: "news-index", path: "/news" },
    { name: "news-article", path: "/news/demo-new-trade-fair-dates-announced-for-the-coming-season" },
    { name: "reference-index", path: "/reference" },
    { name: "reference-page", path: "/reference/ruby" },
    { name: "newsletter", path: "/newsletter" },
    { name: "newsletter-confirm-invalid", path: "/newsletter/confirm?token=not-a-real-token" },
    { name: "legal-terms", path: "/legal/terms" },
    { name: "not-found", path: "/this-page-does-not-exist" },
    { name: "buyer-dashboard", path: "/buyer", signedIn: "buyer" },
    { name: "seller-dashboard", path: "/seller", signedIn: "seller" },
    { name: "admin-content-editor", path: "/admin/content/new", signedIn: "admin" },
  ];

  const offenders: string[] = [];
  const statuses: string[] = [];
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const anon = await context.newPage();
    const signedIn: Partial<Record<"buyer" | "seller" | "admin", Page>> = {};
    for (const role of ["buyer", "seller", "admin"] as const) {
      const rolePage = await context.newPage();
      const creds = role === "buyer" ? [BUYER_EMAIL, BUYER_PASSWORD] : role === "seller" ? [SELLER_EMAIL, SELLER_PASSWORD] : [ADMIN_EMAIL, ADMIN_PASSWORD];
      await login(rolePage, creds[0]!, creds[1]!);
      signedIn[role] = rolePage;
    }

    for (const shot of shots) {
      const page = shot.signedIn ? signedIn[shot.signedIn]! : anon;
      const response = await page.goto(shot.path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      const status = response?.status() ?? 0;
      statuses.push(`${shot.name}@${viewport.label}: ${status}`);
      await page.screenshot({ path: path.join(SHOTS, `${shot.name}-${viewport.label}.png`), fullPage: true });

      const measure = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: window.innerWidth,
      }));
      if (viewport.label === "390" && measure.scroll > measure.client) {
        offenders.push(`${shot.path}: scrollWidth ${measure.scroll} > ${measure.client}`);
      }
    }
    await context.close();
  }

  console.log(`[m6-visual] statuses\n${statuses.join("\n")}`);
  expect(offenders, "M6 pages that scroll sideways at 390px").toEqual([]);
});
