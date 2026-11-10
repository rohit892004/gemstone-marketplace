import { mkdirSync } from "node:fs";
import path from "node:path";
import { type Browser, type BrowserContext, type Page, expect, test } from "@playwright/test";
import { tokenSentTo } from "./helpers";
import { clearLoginLimits } from "./helpers/rate-limits";

/**
 * M3 journey: enquiries, offers and quotations, requirements in both directions, sellers acting as
 * buyers, and contact-detail moderation. Runs after journey.spec.ts on the same database, against a
 * production build with the demo seed loaded (see docs/README). Each run uses fresh names so repeated
 * runs do not see each other's rows.
 */

const stamp = Date.now().toString(36);
const BUYER_NAME = `E2E Buyer ${stamp}`;
const BUYER_EMAIL = `m3-buyer-${stamp}@example.com`;
const BUYER_PASSWORD = "Goodpass-123";
const randomMobile = () => `+91${String(Math.floor(6e9 + Math.random() * 3e9))}`;
const BUYER_MOBILE = randomMobile();

const ADMIN_EMAIL = "admin@gemstone.local";
const ADMIN_PASSWORD = "ChangeMe-Local-1";
// Demo sellers are approved and carry categories. Seller A (Sapphire, Ruby) owns the listing used for
// enquiries. Seller B (Emerald, Diamond) responds to requirements and enquires with A.
const SELLER_A = { slug: "himalaya-gem-house", email: "himalaya-gem-house@demo.gemstone.local", name: "Himalaya Gem House" };
const SELLER_B = { slug: "deccan-stone-works", email: "deccan-stone-works@demo.gemstone.local", name: "Deccan Stone Works" };
const DEMO_SELLER_PASSWORD = process.env.DEMO_SELLER_PASSWORD ?? "Demo-Seller-Pass-1";

const BUYER_REQ_TYPE = `Emerald ${stamp}`;
const SELLER_REQ_TYPE = `Diamond ${stamp}`;

let buyerCtx: BrowserContext;
let sellerACtx: BrowserContext;
let sellerBCtx: BrowserContext;
let adminCtx: BrowserContext;
const SHOTS = path.join(__dirname, "..", "screenshots");
const VIEWPORTS = [
  { width: 390, height: 844, label: "390" },
  { width: 1440, height: 900, label: "1440" },
] as const;

/** Full-page screenshots at both required widths, written to screenshots/ (git-ignored). */
async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(SHOTS, `${name}-${vp.label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

let buyer: Page;
let sellerA: Page;
let sellerB: Page;
let admin: Page;
let listingPath = "";
let enquiryPath = "";

async function login(page: Page, email: string, password: string) {
  await clearLoginLimits();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Opens a conversation row in the seller inbox by the counterpart's name. */
async function openInboxRow(page: Page, query: string, name: string) {
  await page.goto(`/seller/inbox${query}`);
  await page.getByRole("link", { name: new RegExp(name) }).first().click();
  await page.waitForURL(/\/conversations\/[^/]+$/);
}

/** Future date in the YYYY-MM-DD form a date input takes. */
function dateInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

test.describe.serial("M3 journey", () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    buyerCtx = await browser.newContext();
    sellerACtx = await browser.newContext();
    sellerBCtx = await browser.newContext();
    adminCtx = await browser.newContext();
    buyer = await buyerCtx.newPage();
    sellerA = await sellerACtx.newPage();
    sellerB = await sellerBCtx.newPage();
    admin = await adminCtx.newPage();
  });

  test.afterAll(async () => {
    await Promise.all([buyerCtx?.close(), sellerACtx?.close(), sellerBCtx?.close(), adminCtx?.close()]);
  });

  test("buyer registers, verifies email, and logs in", async () => {
    await buyer.goto("/register/buyer");
    await buyer.getByLabel("Full name").fill(BUYER_NAME);
    await buyer.getByLabel("Email", { exact: true }).fill(BUYER_EMAIL);
    await buyer.getByLabel("Mobile number").fill(BUYER_MOBILE);
    await buyer.getByLabel("Password").fill(BUYER_PASSWORD);
    await buyer.getByLabel("Country").selectOption({ label: "India" });
    await buyer.getByRole("button", { name: "Create buyer account" }).click();
    await expect(buyer).toHaveURL(/\/check-email/);

    const token = await tokenSentTo(BUYER_EMAIL, "verify-email");
    await buyer.goto(`/verify-email?token=${token}`);
    await buyer.getByRole("button", { name: "Confirm email" }).click();
    await expect(buyer.getByText("Your email address is verified")).toBeVisible();

    await login(buyer, BUYER_EMAIL, BUYER_PASSWORD);
    await expect(buyer).toHaveURL(/\/buyer/);
  });

  test("buyer enquires on a listing, the seller replies and quotes, and the buyer accepts", async () => {
    // Pick a live listing from seller A's portfolio.
    await buyer.goto(`/sellers/${SELLER_A.slug}`);
    const listingLink = buyer.locator('a[href^="/gemstones/"]').first();
    listingPath = (await listingLink.getAttribute("href")) ?? "";
    expect(listingPath).toMatch(/^\/gemstones\//);

    await buyer.goto(listingPath);
    await buyer.getByRole("button", { name: "Chat / Enquire" }).click();
    await buyer.getByPlaceholder(/Is this stone still available/).fill("Is this still available? Could you share a video?");
    await buyer.getByRole("button", { name: "Send enquiry" }).click();
    await buyer.waitForURL(/\/conversations\/[^/]+$/);
    enquiryPath = new URL(buyer.url()).pathname;

    // Seller A replies from the inbox, then sends a quotation.
    await login(sellerA, SELLER_A.email, DEMO_SELLER_PASSWORD);
    await openInboxRow(sellerA, "?side=selling", BUYER_NAME);
    await sellerA.locator("#chat-body").fill("Yes, it is available. I have sent a quotation below.");
    await sellerA.getByRole("button", { name: "Send", exact: true }).click();
    await expect(sellerA.getByText("Yes, it is available.").first()).toBeVisible();

    await sellerA.getByText("Send a quotation", { exact: true }).click();
    await sellerA.locator('input[name="itemTitle"]').fill(`Sapphire quote ${stamp}`);
    await sellerA.locator('input[name="quantity"]').fill("1");
    await sellerA.locator('input[name="amount"]').fill("15000.00");
    await sellerA.locator('input[name="validUntil"]').fill(dateInDays(30));
    await sellerA.locator('textarea[name="terms"]').fill("Payment by bank transfer. Insured delivery.");
    await sellerA.getByRole("button", { name: "Send quotation" }).click();
    await expect(sellerA.getByText(`Sapphire quote ${stamp}`).first()).toBeVisible();

    // Buyer sees the quotation and accepts it.
    await buyer.goto(enquiryPath);
    await expect(buyer.getByText(`Sapphire quote ${stamp}`).first()).toBeVisible();
    await buyer.getByRole("button", { name: "Accept", exact: true }).first().click();
    await expect(buyer.getByText("Accepted").first()).toBeVisible();
  });

  test("buyer posts a requirement, a matching seller responds, and the conversation opens", async () => {
    await buyer.goto("/buyer/requirements/new");
    await buyer.locator('input[name="gemstoneType"]').fill(BUYER_REQ_TYPE);
    await buyer.locator('select[name="categoryId"]').selectOption({ label: "Emerald" });
    await buyer.locator('input[name="caratMin"]').fill("1");
    await buyer.locator('input[name="caratMax"]').fill("3");
    await buyer.getByRole("button", { name: "Post requirement" }).click();
    await buyer.waitForURL(/\/buyer\/requirements\/[^/]+$/);

    // Seller B (Emerald) signs in, finds the requirement on the board and responds.
    await login(sellerB, SELLER_B.email, DEMO_SELLER_PASSWORD);
    await sellerB.goto(`/seller/requirements?type=${encodeURIComponent(BUYER_REQ_TYPE)}`);
    await sellerB.locator("li", { hasText: BUYER_REQ_TYPE }).getByRole("link", { name: "View and respond" }).click();
    await sellerB.waitForURL(/\/seller\/requirements\/[^/]+$/);
    await sellerB.locator("#requirement-response").fill("I have Emerald parcels in this range. Shall I send photos?");
    await sellerB.getByRole("button", { name: "Send response" }).click();
    await sellerB.waitForURL(/\/conversations\/[^/]+$/);

    // The buyer sees the new conversation in their list.
    await buyer.goto("/conversations");
    await expect(buyer.getByText(SELLER_B.name).first()).toBeVisible();
  });

  test("a seller posts a requirement, another seller responds, and the poster never sees it on the board", async () => {
    await sellerA.goto("/seller/requirements/new");
    await sellerA.locator('input[name="gemstoneType"]').fill(SELLER_REQ_TYPE);
    await sellerA.locator('select[name="categoryId"]').selectOption({ label: "Diamond" });
    await sellerA.locator('input[name="caratMin"]').fill("2");
    await sellerA.locator('input[name="caratMax"]').fill("5");
    await sellerA.getByRole("button", { name: "Post requirement" }).click();
    await sellerA.waitForURL(/\/seller\/requirements\/mine$/);
    await expect(sellerA.getByText(SELLER_REQ_TYPE).first()).toBeVisible();

    // Seller A's own board does not show it, not even to the poster.
    await sellerA.goto(`/seller/requirements?type=${encodeURIComponent(SELLER_REQ_TYPE)}`);
    await expect(sellerA.getByText("No open requirements match these filters")).toBeVisible();
    await expect(sellerA.getByText(SELLER_REQ_TYPE)).toHaveCount(0);

    // Seller B (Diamond) responds.
    await sellerB.goto(`/seller/requirements?type=${encodeURIComponent(SELLER_REQ_TYPE)}`);
    await sellerB.locator("li", { hasText: SELLER_REQ_TYPE }).getByRole("link", { name: "View and respond" }).click();
    await sellerB.waitForURL(/\/seller\/requirements\/[^/]+$/);
    const requirementUrl = sellerB.url();
    await sellerB.locator("#requirement-response").fill("I can offer Diamond in this carat range.");
    await sellerB.getByRole("button", { name: "Send response" }).click();
    await sellerB.waitForURL(/\/conversations\/[^/]+$/);

    // This requirement is seller A's own. Opening it by ID shows the not-found page and none of its details.
    // The HTTP status stays 200 because the page is streamed, so the content is what is checked.
    await sellerA.goto(requirementUrl);
    await expect(sellerA.getByText("We could not find that page").first()).toBeVisible();
    await expect(sellerA.getByText(SELLER_REQ_TYPE)).toHaveCount(0);

    // The conversation sits in seller A's inbox under Buying, and in seller B's under Selling.
    await sellerA.goto("/seller/inbox?side=buying");
    await expect(sellerA.getByText(SELLER_B.name).first()).toBeVisible();
    await sellerB.goto("/seller/inbox?side=selling");
    await expect(sellerB.getByText(SELLER_A.name).first()).toBeVisible();
  });

  test("a seller enquires on another seller's listing, and cannot enquire on their own", async () => {
    await sellerB.goto(listingPath);
    await sellerB.getByRole("button", { name: "Chat / Enquire" }).click();
    await sellerB.getByPlaceholder(/Is this stone still available/).fill("Do you have certificates for this stone?");
    await sellerB.getByRole("button", { name: "Send enquiry" }).click();
    await sellerB.waitForURL(/\/conversations\/[^/]+$/);

    await sellerB.goto("/seller/inbox?side=buying");
    await expect(sellerB.getByText(SELLER_A.name).first()).toBeVisible();

    // Seller A on their own listing: no enquiry form, only the explanation.
    await sellerA.goto(listingPath);
    await expect(sellerA.getByText("This is your listing, so you cannot enquire about it.")).toBeVisible();
    await expect(sellerA.getByRole("button", { name: "Send enquiry" })).toHaveCount(0);
  });

  test("a message with a phone number is masked and appears in the admin flagged queue", async () => {
    await buyer.goto(enquiryPath);
    await buyer.locator("#chat-body").fill("Call me on 98765 43210 after six.");
    await buyer.getByRole("button", { name: "Send", exact: true }).click();

    await expect(buyer.getByText("[hidden contact]").first()).toBeVisible();
    await expect(buyer.getByText("98765 43210")).toHaveCount(0);

    await login(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.goto("/admin/moderation");
    await expect(admin.getByText(BUYER_NAME).first()).toBeVisible();
    // The queue stores and shows the masked text only.
    await expect(admin.locator("body")).not.toContainText("98765 43210");
  });

  test("a seller is refused when saving a phone number in the portfolio about text", async () => {
    await sellerA.goto("/seller/portfolio");
    const about = sellerA.locator('textarea[name="description"]');
    await about.fill("Visit us or call 98765 43210 to view stones.");
    await sellerA.getByRole("button", { name: "Save portfolio" }).click();

    await expect(sellerA.getByText(/Remove the contact details from About/)).toBeVisible();

    // The refused text was not saved. Reloading shows the previous value.
    await sellerA.reload();
    await expect(sellerA.locator('textarea[name="description"]')).not.toHaveValue(/98765 43210/);

    // The attempt is in the flagged queue as seller profile text.
    await admin.goto("/admin/moderation");
    await expect(admin.getByText("Seller profile text").first()).toBeVisible();
    await expect(admin.locator("body")).not.toContainText("98765 43210");
  });

  test("screenshots of the M3 screens at 390px and 1440px", async () => {
    await sellerA.goto("/seller/inbox");
    await shot(sellerA, "m3-seller-inbox-everything");
    await sellerA.goto("/seller/inbox?side=buying");
    await shot(sellerA, "m3-seller-inbox-buying");
    await sellerA.goto("/seller/inbox?side=selling");
    await shot(sellerA, "m3-seller-inbox-selling");

    await buyer.goto(enquiryPath);
    await shot(buyer, "m3-chat-thread-buyer");
    await sellerA.goto(enquiryPath);
    await shot(sellerA, "m3-chat-thread-seller");

    await buyer.goto("/buyer/requirements/new");
    await shot(buyer, "m3-requirement-form-buyer");
    await sellerA.goto("/seller/requirements/new");
    await shot(sellerA, "m3-requirement-form-seller");
    await sellerA.goto("/seller/requirements/mine");
    await shot(sellerA, "m3-own-requirements-seller");

    await sellerB.goto("/seller/requirements");
    await shot(sellerB, "m3-requirements-board");

    await sellerA.goto("/seller/quotations");
    await shot(sellerA, "m3-seller-quotations");

    await buyer.goto("/notifications");
    await shot(buyer, "m3-notification-centre-buyer");
    await sellerA.goto("/notifications");
    await shot(sellerA, "m3-notification-centre-seller");

    await admin.goto("/admin/moderation");
    await shot(admin, "m3-admin-flagged-queue");
  });
});
