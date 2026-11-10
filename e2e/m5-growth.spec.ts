import "dotenv/config";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { Client } from "pg";
import { hashPassword } from "../lib/auth/password";
import { samplePdf, tokenSentTo } from "./helpers";

/**
 * M5 growth journeys: tracking and followers, referrals, the Free listing limit, and admin tier overrides.
 * Runs after the M1 to M4 specs on the same database, against a production build with the demo seed loaded
 * (db:seed:demo, db:seed:m4, db:seed:m5). Each run uses fresh names so repeated runs do not collide.
 *
 * Rollup note: the rollup marker (analytics.rollupThrough) is already at the current UTC day, so events recorded
 * today never reach AnalyticsRollup. The seller's profile and listing view KPIs read the rollup only, so journey a
 * checks the raw AnalyticsEvent rows and the live follower count instead. The rollup runs as of ROLLUP_AS_OF.
 */

const REPO = path.join(__dirname, "..");
const stamp = Date.now().toString(36);
const randomMobile = () => `+91${String(Math.floor(6e9 + Math.random() * 3e9))}`;
const ROLLUP_AS_OF = "2026-11-12";

const ADMIN_EMAIL = "admin@gemstone.local";
const ADMIN_PASSWORD = "ChangeMe-Local-1";
const BUYER_EMAIL = "demo-buyer-1@example.com";
const BUYER_PASSWORD = "Demo-Buyer-Pass-1";
const SELLER_PASSWORD = process.env.DEMO_SELLER_PASSWORD || "Demo-Seller-Pass-1";
const HIMALAYA_SLUG = "himalaya-gem-house";
const HIMALAYA_EMAIL = "himalaya-gem-house@demo.gemstone.local";
const FREE_SELLER_SLUG = "malabar-precious-gems";
const FREE_SELLER_EMAIL = "malabar-precious-gems@demo.gemstone.local";
const FREE_LIMIT_RESTORE = 25;

const SHOTS = path.join(__dirname, "..", "screenshots", "m5");
const VIEWPORTS = [
  { width: 390, height: 844, label: "390" },
  { width: 1440, height: 900, label: "1440" },
] as const;

async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

async function scalar<T = string>(sql: string, params: unknown[] = []): Promise<T> {
  return withDb(async (db) => (await db.query(sql, params)).rows[0] as T);
}

function runRollup(): void {
  execSync(`npm run analytics:rollup -- --as-of=${ROLLUP_AS_OF}`, { cwd: REPO, stdio: "pipe", env: process.env });
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** The number shown under a KPI label (the tile renders the label and value as sibling paragraphs). */
async function kpiNumber(page: Page, label: string): Promise<number> {
  const text = await page.getByText(label, { exact: true }).first().locator("xpath=following-sibling::p[1]").innerText();
  return Number(text.replace(/[^0-9]/g, ""));
}

async function followersKpi(page: Page): Promise<number> {
  await page.goto("/seller/analytics");
  await page.waitForLoadState("networkidle");
  return kpiNumber(page, "Followers");
}

async function qualifiedReferralsOnPage(page: Page): Promise<number> {
  await page.goto("/seller/membership");
  await page.waitForLoadState("networkidle");
  const text = await page.getByText("Qualified referrals", { exact: true }).first().locator("xpath=following-sibling::dd[1]").innerText();
  return Number(text.trim());
}

/** Fills the seller application form the way journey.spec.ts does. */
async function fillSellerApplication(page: Page, args: { email: string; mobile: string; business: string }) {
  // The footer also has a newsletter email field (name="email"), so the form's own field is addressed by id.
  const field = (name: string) => (name === "email" ? page.locator("input#email") : page.locator(`[name="${name}"]`));
  await field("name").fill("M5 Referred Seller");
  await field("email").fill(args.email);
  await field("mobile").fill(args.mobile);
  await field("password").fill("Goodpass-123");
  await field("country").fill("India");
  await field("businessName").fill(args.business);
  await field("businessType").selectOption("PRIVATE_LIMITED");
  await field("addressLine").fill("7 Sadar Bazaar, Jaipur");
  await field("city").fill("Jaipur");
  await field("state").fill("Rajasthan");
  await field("businessCountry").fill("India");
  await field("yearsInBusiness").fill("3");
  await field("specialties").fill("Sapphire");
  await field("idProof").setInputFiles({ name: "id.pdf", mimeType: "application/pdf", buffer: samplePdf() });
  await field("businessProof").setInputFiles({ name: "biz.pdf", mimeType: "application/pdf", buffer: samplePdf() });
  await page.locator('input[name="categoryIds"]').first().check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page).toHaveURL(/\/check-email/);
}

/** Fills the new-listing form (the same fields journey.spec.ts uses). Caller clicks the submit button. */
async function fillListingForm(page: Page, title: string) {
  const listingField = (name: string) => page.locator(`[name="${name}"]`).first();
  await listingField("title").fill(title);
  await listingField("categoryId").selectOption({ label: "Sapphire" });
  await listingField("species").fill("Sapphire");
  await listingField("caratWeight").fill("1.8");
  await page.locator('input[name="priceMode"][value="PRICE"]').check();
  await listingField("price").fill("9000");
  await listingField("currency").selectOption("INR");
  await listingField("availability").selectOption("AVAILABLE");
  await listingField("certificateLabId").selectOption({ label: "GIA" });
  await listingField("certificateNo").fill(`M5-${stamp}`);
}

test.describe.serial("M5 growth", () => {
  test("a. buyer views and follows a seller; the seller sees the follower", async ({ browser }) => {
    test.setTimeout(240_000);
    const sellerId = (await scalar<{ id: string }>('SELECT id FROM "SellerProfile" WHERE slug = $1', [HIMALAYA_SLUG])).id;
    const listing = await scalar<{ id: string; slug: string }>(
      `SELECT g.id, g.slug FROM "Gemstone" g WHERE g."sellerId" = $1 AND g.status = 'PUBLISHED' ORDER BY g."createdAt" LIMIT 1`,
      [sellerId],
    );
    const buyerId = (await scalar<{ id: string }>('SELECT id FROM "User" WHERE email = $1', [BUYER_EMAIL])).id;
    await withDb(async (db) => {
      await db.query('UPDATE "User" SET "passwordHash" = $1 WHERE id = $2', [await hashPassword(BUYER_PASSWORD), buyerId]);
      // Start from "not following" so the follower count moves by exactly one.
      await db.query('DELETE FROM "Follow" WHERE "followerId" = $1 AND "sellerId" = $2', [buyerId, sellerId]);
    });

    const sellerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const buyerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const seller = await sellerCtx.newPage();
      await login(seller, HIMALAYA_EMAIL, SELLER_PASSWORD);
      const followersBefore = await followersKpi(seller);

      const buyer = await buyerCtx.newPage();
      await login(buyer, BUYER_EMAIL, BUYER_PASSWORD);
      await buyer.goto(`/gemstones/${listing.slug}`);
      await buyer.waitForLoadState("networkidle");
      await buyer.goto(`/sellers/${HIMALAYA_SLUG}`);
      await buyer.waitForLoadState("networkidle");
      await buyer.getByRole("button", { name: "Follow seller", exact: true }).click();
      await expect(buyer.getByRole("button", { name: "Following", exact: true })).toBeVisible();

      // Tracking: the buyer's visits are recorded as raw events today (views dedupe per visitor, item and day).
      const today = new Date().toISOString().slice(0, 10);
      await expect
        .poll(async () => (await scalar<{ n: number }>(`SELECT count(*)::int AS n FROM "AnalyticsEvent" WHERE day = $1 AND ("gemstoneId" = $2 OR "sellerId" = $3)`, [today, listing.id, sellerId])).n, { timeout: 20_000 })
        .toBeGreaterThan(0);
      await expect
        .poll(async () => (await scalar<{ n: number }>('SELECT count(*)::int AS n FROM "Follow" WHERE "followerId" = $1 AND "sellerId" = $2', [buyerId, sellerId])).n)
        .toBe(1);

      runRollup();

      // Followers are read live, so the seller's count rises by one after the follow.
      await expect.poll(() => followersKpi(seller), { timeout: 20_000 }).toBe(followersBefore + 1);
    } finally {
      await buyerCtx.close();
      await sellerCtx.close();
    }
  });

  test("b. a referred seller qualifies once approved and published; the referrer's count rises", async ({ browser }) => {
    test.setTimeout(420_000);
    const sellerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const referredCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const seller = await sellerCtx.newPage();
      await login(seller, HIMALAYA_EMAIL, SELLER_PASSWORD);
      // The referral link is created on first visit to the membership page.
      await seller.goto("/seller/membership");
      await seller.waitForLoadState("networkidle");
      const link = await seller.locator("#referral-link").inputValue();
      const code = /ref=([A-Z0-9]+)/.exec(link)?.[1];
      expect(code, `referral code in link ${link}`).toBeTruthy();
      const qualifiedBefore = await qualifiedReferralsOnPage(seller);

      const referredEmail = `m5-referred-${stamp}@example.com`;
      const business = `M5 Referred ${stamp}`;
      const listingTitle = `M5 Referred Listing ${stamp}`;

      // Step 1: the new seller applies through the referral link (the origin in the link is not used; the code is).
      const referred = await referredCtx.newPage();
      await referred.goto(`/register/seller?ref=${code}`);
      await fillSellerApplication(referred, { email: referredEmail, mobile: randomMobile(), business });

      // Step 2: verify the email from the console log.
      const token = await tokenSentTo(referredEmail, "verify-email");
      await referred.goto(`/verify-email?token=${token}`);
      await referred.getByRole("button", { name: "Confirm email" }).click();
      await expect(referred.getByText("Your email address is verified")).toBeVisible();

      // Step 3: an admin approves the seller.
      const admin = await adminCtx.newPage();
      await login(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
      await admin.goto("/admin/sellers?status=PENDING");
      await admin.locator("tr").filter({ hasText: business }).getByRole("link").first().click();
      await admin.getByRole("button", { name: "Approve seller" }).first().click();
      await expect(admin.getByText(/approved/i).first()).toBeVisible();

      // Step 4: the referred seller publishes one listing (submit, then admin approves it).
      await login(referred, referredEmail, "Goodpass-123");
      await referred.goto("/seller/listings/new");
      await fillListingForm(referred, listingTitle);
      await referred.getByRole("button", { name: "Submit for review" }).click();
      await expect(referred.getByText(/pending review|under review|submitted/i).first()).toBeVisible();

      await admin.goto("/admin/listings");
      await admin.locator("tr, li, article").filter({ hasText: listingTitle }).getByRole("link").first().click();
      await admin.getByRole("button", { name: "Approve listing" }).first().click();
      await expect(admin.getByText(/published/i).first()).toBeVisible();

      // A flagged referral (same IP or device as another recent sign-up) waits for an admin. Clear it so the
      // journey can qualify. A flag is never cleared automatically.
      const flagged = await scalar<{ flagged: boolean }>(
        'SELECT r.flagged FROM "Referral" r JOIN "User" u ON u.id = r."referredUserId" WHERE u.email = $1',
        [referredEmail],
      );
      if (flagged.flagged) {
        await admin.goto("/admin/referrals");
        await admin.locator("li").filter({ hasText: business }).getByRole("button", { name: "Clear flag" }).click();
        await expect
          .poll(async () => (await scalar<{ flagged: boolean }>('SELECT r.flagged FROM "Referral" r JOIN "User" u ON u.id = r."referredUserId" WHERE u.email = $1', [referredEmail])).flagged)
          .toBe(false);
      }

      // Step 5: the rollup qualifies the referral (approved and with a published listing).
      runRollup();
      const status = await scalar<{ status: string }>(
        'SELECT r.status FROM "Referral" r JOIN "User" u ON u.id = r."referredUserId" WHERE u.email = $1',
        [referredEmail],
      );
      expect(status.status).toBe("QUALIFIED");

      // Step 6: the referrer's membership page shows one more qualified referral.
      await expect.poll(() => qualifiedReferralsOnPage(seller), { timeout: 20_000 }).toBe(qualifiedBefore + 1);
    } finally {
      await referredCtx.close();
      await adminCtx.close();
      await sellerCtx.close();
    }
  });

  test("c. a Free seller is refused a publish over the limit; the Free limit is restored", async ({ browser }) => {
    test.setTimeout(240_000);
    const freeSellerId = (await scalar<{ id: string }>('SELECT id FROM "SellerProfile" WHERE slug = $1', [FREE_SELLER_SLUG])).id;
    const published = (
      await scalar<{ n: number }>(`SELECT count(*)::int AS n FROM "Gemstone" WHERE "sellerId" = $1 AND status = 'PUBLISHED'`, [freeSellerId])
    ).n;
    const tier = (await scalar<{ tier: string }>('SELECT tier FROM "SellerMembership" WHERE "sellerId" = $1', [freeSellerId])).tier;
    expect(tier, "the limit test needs a Free seller").toBe("FREE");
    expect(published).toBeGreaterThan(0);

    const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const sellerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const admin = await adminCtx.newPage();
    const setFreeLimit = async (value: number) => {
      await admin.goto("/admin/memberships/rules");
      await admin.waitForLoadState("networkidle");
      await admin.locator("#FREE-activeListingLimit").fill(String(value));
      await admin.getByRole("button", { name: "Save tier rules" }).click();
      await expect
        .poll(async () => (await scalar<{ limit: number | null }>(`SELECT "activeListingLimit" AS limit FROM "TierRule" WHERE tier = 'FREE'`)).limit)
        .toBe(value);
    };
    try {
      await login(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
      await setFreeLimit(published);

      const seller = await sellerCtx.newPage();
      await login(seller, FREE_SELLER_EMAIL, SELLER_PASSWORD);
      const title = `M5 Limit ${stamp}`;
      await seller.goto("/seller/listings/new");
      await fillListingForm(seller, title);
      await seller.getByRole("button", { name: "Submit for review" }).click();

      await expect(seller.getByText(`allows ${published} active listings`)).toBeVisible();
      // The refusal happens before anything is written: no new listing, and the published count is unchanged.
      const after = (await scalar<{ n: number }>(`SELECT count(*)::int AS n FROM "Gemstone" WHERE "sellerId" = $1 AND status = 'PUBLISHED'`, [freeSellerId])).n;
      expect(after).toBe(published);
      const live = (await scalar<{ n: number }>(`SELECT count(*)::int AS n FROM "Gemstone" WHERE "sellerId" = $1 AND title = $2 AND status IN ('PUBLISHED','PENDING_REVIEW')`, [freeSellerId, title])).n;
      expect(live).toBe(0);
    } finally {
      // Always restore the Free limit, even when the test above fails.
      await setFreeLimit(FREE_LIMIT_RESTORE);
      await adminCtx.close();
      await sellerCtx.close();
    }
  });

  test("d. admin overrides a seller's tier; the seller sees it until it is cleared", async ({ browser }) => {
    test.setTimeout(240_000);
    const sellerRow = await scalar<{ id: string; businessName: string }>('SELECT id, "businessName" FROM "SellerProfile" WHERE slug = $1', [HIMALAYA_SLUG]);
    const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const sellerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const admin = await adminCtx.newPage();
      await login(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
      await admin.goto("/admin/memberships");
      await admin.waitForLoadState("networkidle");
      const card = admin.locator("li").filter({ has: admin.getByRole("heading", { name: sellerRow.businessName, exact: true }) }).first();
      await card.locator(`#tier-${sellerRow.id}`).selectOption("ELITE");
      await card.locator(`#reason-${sellerRow.id}`).fill(`M5 e2e override ${stamp}`);
      await card.getByRole("button", { name: "Set tier", exact: true }).click();
      await expect
        .poll(async () => (await scalar<{ manualOverride: boolean; tier: string }>('SELECT "manualOverride", tier FROM "SellerMembership" WHERE "sellerId" = $1', [sellerRow.id])).manualOverride)
        .toBe(true);

      const seller = await sellerCtx.newPage();
      await login(seller, HIMALAYA_EMAIL, SELLER_PASSWORD);
      await seller.goto("/seller/membership");
      await expect(seller.locator("p", { hasText: "Current membership:" })).toContainText("Elite");
      await expect(seller.getByText("Set by the Gemstone Selections team.")).toBeVisible();

      await admin.goto("/admin/memberships");
      await admin.waitForLoadState("networkidle");
      const cardAgain = admin.locator("li").filter({ has: admin.getByRole("heading", { name: sellerRow.businessName, exact: true }) }).first();
      await cardAgain.getByRole("button", { name: "Clear override", exact: true }).click();
      await expect
        .poll(async () => (await scalar<{ manualOverride: boolean }>('SELECT "manualOverride" FROM "SellerMembership" WHERE "sellerId" = $1', [sellerRow.id])).manualOverride)
        .toBe(false);

      // The notice goes. The tier itself stays until the next evaluation.
      await seller.goto("/seller/membership");
      await seller.waitForLoadState("networkidle");
      await expect(seller.getByText("Set by the Gemstone Selections team.")).toHaveCount(0);
    } finally {
      await sellerCtx.close();
      await adminCtx.close();
    }
  });

  test("screenshots of the M5 screens at 390px and 1440px", async ({ browser }) => {
    test.setTimeout(420_000);
    mkdirSync(SHOTS, { recursive: true });
    const sellerCtx = await browser.newContext();
    const adminCtx = await browser.newContext();
    try {
      const seller = await sellerCtx.newPage();
      await login(seller, HIMALAYA_EMAIL, SELLER_PASSWORD);
      const admin = await adminCtx.newPage();
      await login(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
      const shots: Array<[Page, string, string]> = [
        [seller, "/seller/analytics", "seller-analytics"],
        [seller, "/seller/membership", "seller-membership"],
        [admin, "/admin/memberships", "admin-memberships"],
        [admin, "/admin/analytics", "admin-analytics"],
        [admin, "/admin/referrals", "admin-referrals"],
      ];
      for (const [page, route, name] of shots) {
        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.width === 390 ? 844 : 900 });
          await page.goto(route);
          await page.waitForLoadState("networkidle");
          await page.screenshot({ path: path.join(SHOTS, `${name}-${vp.label}.png`), fullPage: true });
        }
      }
    } finally {
      await sellerCtx.close();
      await adminCtx.close();
    }
  });
});
