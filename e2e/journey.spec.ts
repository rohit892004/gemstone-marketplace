import { mkdirSync } from "node:fs";
import path from "node:path";
import { type Browser, type BrowserContext, type Page, expect, test } from "@playwright/test";
import { sampleJpeg, samplePdf, tokenSentTo } from "./helpers";

/**
 * One serial journey across M1 and M2 on a production build with the demo seed loaded.
 * Each role has its own browser context (its own cookies). Steps depend on earlier ones.
 */

const stamp = Date.now().toString(36);
const BUYER_EMAIL = `buyer-${stamp}@example.com`;
const SELLER_EMAIL = `seller-${stamp}@example.com`;
const PASSWORD = "Goodpass-123";
// Unique per run: mobile numbers are unique in the database, so a fixed number collides across runs.
const randomMobile = () => `+91${String(Math.floor(6e9 + Math.random() * 3e9))}`;
const BUYER_MOBILE = randomMobile();
const SELLER_MOBILE = randomMobile();
const BUSINESS = `E2E Gems ${stamp}`;
const LISTING_TITLE = `E2E Sapphire ${stamp}`;
const ADMIN_EMAIL = "admin@gemstone.local";
const ADMIN_PASSWORD = "ChangeMe-Local-1";
const DEMO_SELLER_EMAIL = "himalaya-gem-house@demo.gemstone.local";
const DEMO_SELLER_PASSWORD = "Demo-Seller-Pass-1";
const SHOTS = path.join(__dirname, "..", "screenshots");

const VIEWPORTS = [
  { width: 390, height: 844, label: "390" },
  { width: 1440, height: 900, label: "1440" },
] as const;

let buyerCtx: BrowserContext;
let sellerCtx: BrowserContext;
let adminCtx: BrowserContext;
let demoCtx: BrowserContext;
let buyer: Page;
let seller: Page;
let admin: Page;
let demo: Page;
let listingPath = "";
let listingEditUrl = "";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  // Wait for the sign-in redirect so the session cookie is set before the next navigation.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Full-page screenshots at both required widths. */
async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(SHOTS, `${name}-${vp.label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test.describe.serial("M1 + M2 journey", () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    buyerCtx = await browser.newContext();
    sellerCtx = await browser.newContext();
    adminCtx = await browser.newContext();
    demoCtx = await browser.newContext();
    buyer = await buyerCtx.newPage();
    seller = await sellerCtx.newPage();
    admin = await adminCtx.newPage();
    demo = await demoCtx.newPage();
  });

  test.afterAll(async () => {
    await Promise.all([buyerCtx?.close(), sellerCtx?.close(), adminCtx?.close(), demoCtx?.close()]);
  });

  // ---------- M1 ----------

  test("buyer registers, verifies email, and logs in", async () => {
    await buyer.goto("/register/buyer");
    await buyer.getByLabel("Full name").fill("E2E Buyer");
    await buyer.getByLabel("Email").fill(BUYER_EMAIL);
    await buyer.getByLabel("Mobile number").fill(BUYER_MOBILE);
    await buyer.getByLabel("Password").fill(PASSWORD);
    await buyer.getByLabel("Country").selectOption({ label: "India" });
    await buyer.getByRole("button", { name: "Create buyer account" }).click();
    await expect(buyer).toHaveURL(/\/check-email/);

    const token = await tokenSentTo(BUYER_EMAIL, "verify-email");
    await buyer.goto(`/verify-email?token=${token}`);
    await buyer.getByRole("button", { name: "Confirm email" }).click();
    await expect(buyer.getByText("Your email address is verified")).toBeVisible();

    await login(buyer, BUYER_EMAIL, PASSWORD);
    await expect(buyer).toHaveURL(/\/buyer/);
  });

  test("seller applies, is pending, and admin approves", async () => {
    await seller.goto("/register/seller");
    // Fields are addressed by their form name: visible labels carry extra text (required markers, hints).
    const field = (name: string) => seller.locator(`[name="${name}"]`);
    await field("name").fill("E2E Seller");
    await field("email").fill(SELLER_EMAIL);
    await field("mobile").fill(SELLER_MOBILE);
    await field("password").fill(PASSWORD);
    await field("country").fill("India");
    await field("businessName").fill(BUSINESS);
    await field("businessType").selectOption("PRIVATE_LIMITED");
    await field("addressLine").fill("12 Johari Bazaar, Jaipur");
    await field("city").fill("Jaipur");
    await field("state").fill("Rajasthan");
    await field("businessCountry").fill("India");
    await field("yearsInBusiness").fill("5");
    await field("specialties").fill("Sapphire, Ruby");
    await field("idProof").setInputFiles({ name: "id.pdf", mimeType: "application/pdf", buffer: samplePdf() });
    await field("businessProof").setInputFiles({ name: "biz.pdf", mimeType: "application/pdf", buffer: samplePdf() });
    await seller.getByRole("button", { name: "Submit application" }).click();
    await expect(seller).toHaveURL(/\/check-email/);

    const token = await tokenSentTo(SELLER_EMAIL, "verify-email");
    await seller.goto(`/verify-email?token=${token}`);
    await seller.getByRole("button", { name: "Confirm email" }).click();
    await expect(seller.getByText("Your email address is verified")).toBeVisible();

    await login(seller, SELLER_EMAIL, PASSWORD);
    await seller.goto("/seller");
    await expect(seller.getByText(/under review/i)).toBeVisible();

    await login(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.goto("/admin/sellers?status=PENDING");
    // The business name is plain text in the row; the detail link sits in that row's action cell.
    await admin.locator("tr").filter({ hasText: BUSINESS }).getByRole("link").first().click();
    await admin.getByRole("button", { name: "Approve seller" }).first().click();
    await expect(admin.getByText(/approved/i).first()).toBeVisible();
  });

  test("approved seller reaches the seller dashboard", async () => {
    await seller.goto("/seller");
    await expect(seller.getByRole("link", { name: /listings/i }).first()).toBeVisible();
  });

  // ---------- M2 ----------

  test("seller creates a listing with photo, certificate and public document", async () => {
    await seller.goto("/seller/listings/new");
    const listingField = (name: string) => seller.locator(`[name="${name}"]`).first();
    await listingField("title").fill(LISTING_TITLE);
    await listingField("categoryId").selectOption({ label: "Sapphire" });
    await listingField("species").fill("Sapphire");
    await listingField("caratWeight").fill("2.5");
    await seller.locator('input[name="priceMode"][value="PRICE"]').check();
    await listingField("price").fill("15000");
    await listingField("currency").selectOption("INR");
    await listingField("availability").selectOption("AVAILABLE");
    await listingField("certificateLabId").selectOption({ label: "GIA" });
    await listingField("certificateNo").fill("E2E-123");
    await seller.getByRole("button", { name: "Save draft" }).click();
    await seller.waitForURL(/\/seller\/listings\/[^/]+\/edit/);
    listingEditUrl = seller.url();

    // Photo.
    await seller.getByLabel("Add images or videos").setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() });
    await seller.getByRole("button", { name: "Upload", exact: true }).click();
    // The first photo becomes the cover automatically, so its controls show "Cover" and no "Set as cover".
    await expect(seller.getByText("Cover").first()).toBeVisible();

    // Certificate document, marked public. Admin verification comes later.
    // The document form is the one holding the file input (the listing form also has a title field).
    const docForm = seller.locator("form").filter({ has: seller.locator('input[name="file"]') });
    await docForm.locator('[name="type"]').selectOption("CERTIFICATE");
    await docForm.locator('[name="title"]').fill("GIA report");
    await docForm.locator('input[name="file"]').setInputFiles({ name: "gia.pdf", mimeType: "application/pdf", buffer: samplePdf() });
    await seller.getByRole("button", { name: "Upload document" }).click();
    await seller.getByRole("button", { name: "Make public" }).first().click();
    await expect(seller.getByRole("button", { name: "Make private" }).first()).toBeVisible();

    await seller.getByRole("button", { name: "Submit for review" }).click();
    await expect(seller.getByText(/pending review|under review|submitted/i).first()).toBeVisible();
  });

  test("admin approves the listing, verifies the document, and features it", async () => {
    await admin.goto("/admin/listings");
    await admin.locator("tr, li, article").filter({ hasText: LISTING_TITLE }).getByRole("link").first().click();
    listingPath = new URL(admin.url()).pathname;
    await admin.getByRole("button", { name: "Approve listing" }).first().click();
    await expect(admin.getByText(/published/i).first()).toBeVisible();

    await admin.goto("/admin/documents");
    // Scope to this run's listing: earlier runs leave their own pending "GIA report" rows in the queue.
    const row = admin.locator("li, tr, article").filter({ hasText: LISTING_TITLE }).filter({ hasText: "GIA report" }).first();
    await row.getByRole("button", { name: "Verify document" }).click();

    await admin.goto("/admin/listings/all");
    const listRow = admin.locator("li, tr, article").filter({ hasText: LISTING_TITLE }).first();
    await listRow.getByRole("button", { name: "Feature", exact: true }).click();
    await expect(listRow.getByText("Featured").first()).toBeVisible();
  });

  test("listing appears in the featured carousel, search, and product page with Verified", async () => {
    await buyer.goto("/");
    await expect(buyer.getByRole("heading", { name: "Featured gemstones" })).toBeVisible();
    await expect(buyer.getByText(LISTING_TITLE).first()).toBeVisible();

    await buyer.goto(`/gemstones?q=${encodeURIComponent(LISTING_TITLE)}`);
    const card = buyer.locator("article").filter({ hasText: LISTING_TITLE }).first();
    await expect(card).toBeVisible();
    await expect(card.getByText("Verified")).toBeVisible();
    await card.getByRole("link").first().click();

    await expect(buyer.getByRole("heading", { name: LISTING_TITLE })).toBeVisible();
    await expect(buyer.getByText("Verified").first()).toBeVisible();
    await expect(buyer.getByRole("link", { name: /View seller portfolio/i })).toBeVisible();
    listingPath = new URL(buyer.url()).pathname;
  });

  test("buyer saves the listing; owning seller cannot", async () => {
    await buyer.goto(listingPath);
    await buyer.getByRole("button", { name: "Save to wishlist" }).click();
    await expect(buyer.getByRole("button", { name: "Saved" })).toBeVisible();

    await seller.goto(listingPath);
    await expect(seller.getByRole("button", { name: "Save to wishlist" })).toBeDisabled();
  });

  test("another (demo) seller saves the listing too", async () => {
    await login(demo, DEMO_SELLER_EMAIL, DEMO_SELLER_PASSWORD);
    await expect(demo).toHaveURL(/\/(seller|dashboard)/);
    await demo.goto(listingPath);
    await demo.getByRole("button", { name: "Save to wishlist" }).click();
    await expect(demo.getByRole("button", { name: "Saved" })).toBeVisible();
  });

  test("screenshots of the main screens at 390px and 1440px", async () => {
    mkdirSync(SHOTS, { recursive: true });
    await buyer.goto("/");
    await shot(buyer, "homepage");
    await buyer.goto("/gemstones");
    await shot(buyer, "catalogue");
    await buyer.goto(listingPath);
    await shot(buyer, "product-page");
    await buyer.goto("/sellers/himalaya-gem-house");
    await shot(buyer, "seller-portfolio");
    await buyer.goto("/buyer/wishlist");
    await shot(buyer, "buyer-dashboard");
    await seller.goto("/seller/listings");
    await shot(seller, "seller-dashboard");
    await admin.goto("/admin/listings");
    await shot(admin, "admin-listing-queue");
    await admin.goto("/admin/documents");
    await shot(admin, "admin-document-queue");
  });
});
