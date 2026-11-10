import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { sampleJpeg } from "./helpers";
import { clearLoginLimits } from "./helpers/rate-limits";

/**
 * Seller portfolio logo and banner: upload, save, and the image is served and shown publicly.
 * Also checks the messages for refused files name the accepted formats and sizes, and explain HEIC.
 */

const SELLER_EMAIL = "himalaya-gem-house@demo.gemstone.local";
const SELLER_SLUG = "himalaya-gem-house";
const SELLER_PASSWORD = process.env.DEMO_SELLER_PASSWORD || "Demo-Seller-Pass-1";

async function login(page: Page) {
  await clearLoginLimits();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(SELLER_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function samplePng(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 400, channels: 3, background: { r: 60, g: 20, b: 80 } } }).png().toBuffer();
}

/** An iPhone-style HEIC header. Enough for the format check, which is what refuses it. */
function sampleHeic(): Buffer {
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from("ftypheic", "ascii"),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from("mif1heic", "ascii"),
    Buffer.alloc(64),
  ]);
}

test.describe.serial("seller portfolio images", () => {
  test("logo (JPEG) and banner (PNG) save, and show on the public profile", async ({ page }) => {
    await login(page);
    await page.goto("/seller/portfolio");
    await page.locator('input[name="logo"]').setInputFiles({ name: "logo.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() });
    await page.locator('input[name="banner"]').setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: await samplePng() });
    await page.getByRole("button", { name: "Save portfolio" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Portfolio saved." })).toBeVisible({ timeout: 30_000 });

    // The stored images are served through the asset route, as WebP.
    const logo = await page.request.get(`/api/sellers/${SELLER_SLUG}/assets/logo`);
    expect(logo.status()).toBe(200);
    expect(logo.headers()["content-type"]).toBe("image/webp");
    const banner = await page.request.get(`/api/sellers/${SELLER_SLUG}/assets/banner`);
    expect(banner.status()).toBe(200);

    // The public profile shows both.
    await page.goto(`/sellers/${SELLER_SLUG}`);
    await expect(page.locator(`img[src="/api/sellers/${SELLER_SLUG}/assets/logo"]`)).toBeVisible();
    await expect(page.locator(`img[src="/api/sellers/${SELLER_SLUG}/assets/banner"]`)).toBeAttached();
  });

  test("a HEIC photo is refused with the accepted formats and the conversion step", async ({ page }) => {
    await login(page);
    await page.goto("/seller/portfolio");
    await page.locator('input[name="logo"]').setInputFiles({ name: "IMG_1234.HEIC", mimeType: "image/heic", buffer: sampleHeic() });
    await page.getByRole("button", { name: "Save portfolio" }).click();
    // The error explains the conversion step.
    await expect(page.getByRole("alert").filter({ hasText: "HEIC" })).toContainText("converted to JPEG first");
    // The field itself names the accepted formats and the size limit.
    await expect(page.getByText("JPEG, PNG or WebP, up to 15 MB.").first()).toBeVisible();
  });

  test("a large phone-size JPEG (about 12 megapixels) uploads", async ({ page }) => {
    await login(page);
    await page.goto("/seller/portfolio");
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: { r: 120, g: 110, b: 100 }, noise: { type: "gaussian", mean: 120, sigma: 30 } } }).jpeg({ quality: 95 }).toBuffer();
    expect(big.length).toBeGreaterThan(3 * 1024 * 1024);
    await page.locator('input[name="logo"]').setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: big });
    await page.getByRole("button", { name: "Save portfolio" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Portfolio saved." })).toBeVisible({ timeout: 60_000 });
  });

  test("an oversize image says the limit", async ({ page }) => {
    await login(page);
    await page.goto("/seller/portfolio");
    const oversize = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(15 * 1024 * 1024 + 1024)]);
    await page.locator('input[name="banner"]').setInputFiles({ name: "huge.jpg", mimeType: "image/jpeg", buffer: oversize });
    await page.getByRole("button", { name: "Save portfolio" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "larger than 15 MB" })).toBeVisible({ timeout: 30_000 });
  });
});
