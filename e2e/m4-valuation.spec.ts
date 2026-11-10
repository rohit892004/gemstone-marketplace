import { mkdirSync } from "node:fs";
import { VALUATION_DISCLAIMER } from "../lib/valuation/disclaimer";
import path from "node:path";
import { type Browser, type BrowserContext, type Locator, type Page, expect, test } from "@playwright/test";
import { sampleJpeg, tokenSentTo } from "./helpers";

/**
 * M4 journey: valuations. Runs after journey.spec.ts and m3-journey.spec.ts on the same database, against a
 * production build with the demo seed (db:seed:demo, then db:seed:m4) loaded. Each run uses fresh buyer names
 * so repeated runs do not see each other's rows.
 */

const stamp = Date.now().toString(36);
const BUYER_NAME = `M4 Buyer ${stamp}`;
const BUYER_EMAIL = `m4-buyer-${stamp}@example.com`;
const BUYER_PASSWORD = "Goodpass-123";
const randomMobile = () => `+91${String(Math.floor(6e9 + Math.random() * 3e9))}`;
const BUYER_MOBILE = randomMobile();

const ADMIN_EMAIL = "admin@gemstone.local";
const ADMIN_PASSWORD = "ChangeMe-Local-1";
const VALUER_EMAIL = "demo.valuer@example.test";
const VALUER_PASSWORD = process.env.M4_DEMO_VALUATOR_PASSWORD?.trim() || "demo-valuer-dev-only-change-me";
// Seller A of the demo seed owns the listings used here. Its password is the e2e demo password.
const SELLER_SLUG = "himalaya-gem-house";
const SELLER_EMAIL = "himalaya-gem-house@demo.gemstone.local";
const SELLER_PASSWORD = process.env.DEMO_SELLER_PASSWORD || "Demo-Seller-Pass-1";

const DISCLAIMER = VALUATION_DISCLAIMER;
const REFERENCE_RE = /GSV-\d{2}-[A-Z0-9]{6}/;
const SHOTS = path.join(__dirname, "..", "screenshots", "m4");
const VIEWPORTS = [
  { width: 390, height: 844, label: "390" },
  { width: 1440, height: 900, label: "1440" },
] as const;

let buyerCtx: BrowserContext;
let sellerCtx: BrowserContext;
let adminCtx: BrowserContext;
let valuerCtx: BrowserContext;
let buyer: Page;
let seller: Page;
let admin: Page;
let valuer: Page;

let buyerListingPath = "";
let sellerListingPath = "";
let buyerValuationId = "";
let buyerRef = "";
let expertValuationId = "";
let expertRef = "";
let sellerValuationId = "";
let sellerRef = "";

/** Full-page screenshots at both required widths, written to screenshots/m4 (git-ignored). */
async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(SHOTS, `${name}-${vp.label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** The valuation id from a wizard URL such as /valuation/<id>/upload. */
function valuationIdFrom(url: string): string {
  const match = new URL(url).pathname.match(/\/valuation\/([^/]+)\//);
  if (!match) throw new Error(`No valuation id in ${url}`);
  return match[1];
}

/** Text of the detail form fields. Only the fields given are changed. */
type Details = {
  type?: string;
  carat?: string;
  shape?: string;
  dimensions?: string;
  colour?: string;
  clarity?: string;
  grade?: string;
  origin?: string;
  treatment?: string;
  lab?: string;
  certificate?: string;
};

async function fillDetails(page: Page, d: Details) {
  if (d.type !== undefined) await page.locator('select[name="gemstoneType"]').selectOption(d.type);
  if (d.carat !== undefined) await page.locator('[name="carat"]').fill(d.carat);
  if (d.shape !== undefined) await page.locator('[name="shape"]').fill(d.shape);
  if (d.dimensions !== undefined) await page.locator('[name="dimensions"]').fill(d.dimensions);
  if (d.colour !== undefined) await page.locator('[name="colour"]').fill(d.colour);
  if (d.clarity !== undefined) await page.locator('[name="clarity"]').fill(d.clarity);
  if (d.grade !== undefined) await page.locator('select[name="qualityGrade"]').selectOption(d.grade);
  if (d.origin !== undefined) await page.locator('[name="origin"]').fill(d.origin);
  if (d.treatment !== undefined) await page.locator('[name="treatment"]').fill(d.treatment);
  if (d.lab !== undefined) await page.locator('select[name="labId"]').selectOption(d.lab === "" ? "" : { label: d.lab });
  if (d.certificate !== undefined) await page.locator('[name="certificateNumber"]').fill(d.certificate);
  // Read the controls back, so a value that did not stick is caught here and not as a wrong estimate later.
  if (d.type !== undefined) await expect(page.locator('select[name="gemstoneType"]')).toHaveValue(d.type);
  if (d.grade !== undefined) await expect(page.locator('select[name="qualityGrade"]')).toHaveValue(d.grade);
  if (d.lab) await expect(page.locator('select[name="labId"]')).not.toHaveValue("");
}

/** Adds one JPEG through the photo uploader on the upload step. */
async function addPhoto(page: Page) {
  await page.locator('input[name="files"]').setInputFiles({ name: "stone.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() });
  await page.getByRole("button", { name: "Add to valuation", exact: true }).click();
  await expect(page.getByRole("list", { name: "Photos added" }).locator("li").first()).toBeVisible();
  // The photo action refreshes the page. Wait for that to settle before the details are filled in.
  await page.waitForLoadState("networkidle");
}

/** Save draft, then Continue to the review step. */
async function saveAndContinue(page: Page) {
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").first()).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL(/\/valuation\/[^/]+\/review$/);
}

/**
 * Reloads until the expected text shows. A server action can finish after the click returns, so a single reload
 * can read the page before the change is saved.
 */
async function reloadUntilVisible(page: Page, locator: Locator) {
  await expect(async () => {
    await page.reload();
    await expect(locator).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/** Pulls the text of every PDF string literal and joins them, so wrapped lines can be matched. */
function pdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\()])*)\)/g)) parts.push(m[1]);
  return parts.join(" ").replace(/\\([()\\])/g, "$1");
}

const squash = (s: string) => s.replace(/\s+/g, "");

test.describe.serial("M4 valuation journey", () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    buyerCtx = await browser.newContext();
    sellerCtx = await browser.newContext();
    adminCtx = await browser.newContext();
    valuerCtx = await browser.newContext();
    buyer = await buyerCtx.newPage();
    seller = await sellerCtx.newPage();
    admin = await adminCtx.newPage();
    valuer = await valuerCtx.newPage();
  });

  test.afterAll(async () => {
    await Promise.all([buyerCtx?.close(), sellerCtx?.close(), adminCtx?.close(), valuerCtx?.close()]);
  });

  test("buyer registers, verifies email, and logs in", async () => {
    await buyer.goto("/register/buyer");
    await buyer.getByLabel("Full name").fill(BUYER_NAME);
    await buyer.getByLabel("Email").fill(BUYER_EMAIL);
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

  // ---------- 1a. Buyer, listing, automatic result, PDF, verification ----------

  test("buyer requests a valuation on a listing and gets an automatic result with a PDF", async () => {
    await buyer.goto(`/sellers/${SELLER_SLUG}`);
    const hrefs = await buyer.locator('a[href^="/gemstones/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    const unique = [...new Set(hrefs.filter((h) => h.startsWith("/gemstones/")))];
    expect(unique.length).toBeGreaterThan(0);
    buyerListingPath = unique[0];
    // A second listing of the same seller, used later for the seller's own valuation.
    sellerListingPath = unique[1] ?? unique[0];

    await buyer.goto(buyerListingPath);
    await buyer.getByRole("button", { name: "Request valuation", exact: true }).click();
    await buyer.waitForURL(/\/valuation\/[^/]+\/upload$/);
    buyerValuationId = valuationIdFrom(buyer.url());

    // Inputs that give HIGH confidence: lab certificate, certificate number, origin, treatment, grade and the stone details.
    await addPhoto(buyer);
    await fillDetails(buyer, {
      type: "Ruby",
      carat: "1.2",
      shape: "Oval",
      dimensions: "7.2 x 5.1 x 3.4 mm",
      colour: "Pigeon blood red",
      clarity: "Eye clean",
      grade: "FINE",
      origin: "Burma",
      treatment: "None",
      lab: "GIA",
      certificate: `M4-${stamp}`,
    });
    await shot(buyer, "wizard-upload");
    await saveAndContinue(buyer);

    await shot(buyer, "wizard-review");
    await buyer.getByRole("button", { name: "Submit for valuation", exact: true }).click();
    await buyer.waitForURL(new RegExp(`/valuation/${buyerValuationId}$`));

    await expect(buyer.getByRole("heading", { level: 1 })).toHaveText("Valued automatically");
    await expect(buyer.getByRole("heading", { name: "Your indicative estimate" })).toBeVisible();
    buyerRef = REFERENCE_RE.exec(await buyer.getByText(/Ref\. GSV-/).first().innerText())?.[0] ?? "";
    expect(buyerRef).toMatch(REFERENCE_RE);
    await expect(buyer.getByText(DISCLAIMER).first()).toBeVisible();
    await shot(buyer, "result-auto");

    // The PDF comes through the browser session. It must be a PDF with the reference and the disclaimer, and no requester name.
    const pdf = await buyer.request.get(`/api/valuation/${buyerValuationId}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"] ?? "").toContain("application/pdf");
    const bytes = await pdf.body();
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("%PDF");
    const text = pdfText(bytes);
    expect(text).toContain(buyerRef);
    // The PDF and the page use one shared disclaimer, so the wording is identical.
    expect(squash(text)).toContain(squash(VALUATION_DISCLAIMER));
    expect(text).not.toContain("?1");
    expect(text).not.toContain(BUYER_NAME);
    expect(text).not.toContain(BUYER_EMAIL);
  });

  test("the public verification page shows only reference, date, type, status and method", async () => {
    await buyer.goto(`/valuation/verify/${buyerRef}`);
    await expect(buyer.getByText(buyerRef).first()).toBeVisible();
    await expect(buyer.getByText("Valid", { exact: true })).toBeVisible();
    await expect(buyer.getByText("Ruby", { exact: true })).toBeVisible();
    await expect(buyer.getByText("Automatic", { exact: true })).toBeVisible();
    const body = await buyer.locator("body").innerText();
    for (const forbidden of ["₹", "INR", "Estimate", "Range", "Confidence", "Burma", BUYER_NAME, BUYER_EMAIL]) {
      expect(body, `verification page must not show "${forbidden}"`).not.toContain(forbidden);
    }
    await shot(buyer, "verify");
  });

  // ---------- 1b. Low confidence, expert review ----------

  test("a minimal request goes to expert review; the admin assigns the demo valuer", async () => {
    await buyer.goto("/valuation");
    await buyer.getByRole("button", { name: "Start a valuation", exact: true }).click();
    await buyer.waitForURL(/\/valuation\/[^/]+\/upload$/);
    expertValuationId = valuationIdFrom(buyer.url());

    // Minimal details: no lab, no origin, no treatment, no certificate. Confidence comes out LOW.
    await addPhoto(buyer);
    await fillDetails(buyer, { type: "Sapphire", carat: "3.4", grade: "STANDARD", lab: "", origin: "", treatment: "" });
    await saveAndContinue(buyer);
    await buyer.getByRole("button", { name: "Submit for valuation", exact: true }).click();
    await buyer.waitForURL(new RegExp(`/valuation/${expertValuationId}$`));
    await expect(buyer.getByRole("heading", { level: 1 })).toHaveText("With an expert valuer");
    expertRef = REFERENCE_RE.exec(await buyer.getByText(/Ref\. GSV-/).first().innerText())?.[0] ?? "";
    expect(expertRef).toMatch(REFERENCE_RE);
    await shot(buyer, "result-expert-review");

    await login(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.goto("/admin/valuations");
    await admin.locator('select[name="assignment"]').selectOption("unassigned");
    await admin.getByRole("button", { name: "Apply filters", exact: true }).click();
    await admin.waitForURL(/assignment=unassigned/);
    const row = admin.locator("tr").filter({ hasText: expertRef });
    await expect(row).toBeVisible();
    await row.getByRole("link").first().click();
    await admin.waitForURL(new RegExp(`/admin/valuations/${expertValuationId}$`));

    const valuerSelect = admin.locator('select[name="valuatorId"]');
    const valuerValue = await valuerSelect.locator("option").filter({ hasText: VALUER_EMAIL }).first().getAttribute("value");
    expect(valuerValue).toBeTruthy();
    await valuerSelect.selectOption(valuerValue ?? "");
    await admin.getByRole("button", { name: "Save assignment", exact: true }).click();
    await reloadUntilVisible(admin, admin.getByText("Demo valuer").first());
  });

  test("valuator sees the stone but not the requester, asks a question, and the buyer replies with a photo", async () => {
    await login(valuer, VALUER_EMAIL, VALUER_PASSWORD);
    await valuer.goto("/valuator/queue");
    await expect(valuer.getByRole("link", { name: new RegExp(expertRef) })).toBeVisible();
    await shot(valuer, "valuator-queue");
    await valuer.getByRole("link", { name: new RegExp(expertRef) }).click();
    await valuer.waitForURL(new RegExp(`/valuator/valuations/${expertValuationId}$`));
    await expect(valuer.getByRole("heading", { level: 1 })).toHaveText(expertRef);
    await shot(valuer, "valuator-detail");

    // Privacy: the requester's name, email and mobile must not appear on the valuator's page.
    const valuerPage = await valuer.locator("body").innerText();
    expect(valuerPage).not.toContain(BUYER_NAME);
    expect(valuerPage).not.toContain(BUYER_EMAIL);
    expect(valuerPage).not.toContain(BUYER_MOBILE);

    const askForm = valuer.locator("form").filter({ hasText: "Ask for more information" });
    await askForm.locator('textarea[name="body"]').fill("Does the stone have a lab report, or has it been treated? Please say which.");
    await askForm.getByRole("button", { name: "Send question", exact: true }).click();
    await reloadUntilVisible(valuer, valuer.getByText("Waiting for the requester to reply"));

    // The buyer sees the question on the result page, replies, and adds a photo.
    await buyer.goto(`/valuation/${expertValuationId}`);
    await expect(buyer.getByText("The valuer has a question").first()).toBeVisible();
    // The photo goes first: the uploader shows only while the valuer's question is open, and a reply closes it.
    await addPhoto(buyer);
    const replyText = `Lab report attached as a photo. Treatment: none. ${stamp}`;
    await buyer.getByLabel("Your reply").fill(replyText);
    await buyer.getByRole("button", { name: "Send reply", exact: true }).click();
    await reloadUntilVisible(buyer, buyer.getByText(replyText).first());

    // The valuator sees the reply and signs off with an estimate, range, confidence and a note.
    await reloadUntilVisible(valuer, valuer.getByText(replyText).first());
    const signForm = valuer.locator("form").filter({ hasText: "Sign off the valuation" });
    await signForm.locator('[name="estimate"]').fill("150000.00");
    await signForm.locator('[name="low"]').fill("120000.00");
    await signForm.locator('[name="high"]').fill("180000.00");
    await signForm.locator('[name="confidence"]').selectOption("HIGH");
    await signForm.locator('[name="notes"]').fill(`Checked the photos and the stated grade. Demo sign-off ${stamp}.`);
    await signForm.getByRole("button", { name: "Sign off", exact: true }).click();
    await reloadUntilVisible(valuer, valuer.getByText("Signed off").first());
  });

  test("buyer sees the expert result and the notifications for the question and the completion", async () => {
    await buyer.goto(`/valuation/${expertValuationId}`);
    await expect(buyer.getByRole("heading", { level: 1 })).toHaveText("Expert valuation completed");
    await expect(buyer.getByText("Expert review (valuer sign-off)").first()).toBeVisible();

    await buyer.goto("/notifications");
    await expect(buyer.getByText("More information needed").first()).toBeVisible();
    await expect(buyer.getByText("Valuation completed").first()).toBeVisible();
  });

  // ---------- 1c. Seller values an own listing and publishes it ----------

  test("seller requests a valuation on their own listing and publishes it", async () => {
    await login(seller, SELLER_EMAIL, SELLER_PASSWORD);
    await seller.goto(sellerListingPath);
    await seller.getByRole("button", { name: "Request valuation", exact: true }).click();
    await seller.waitForURL(/\/valuation\/[^/]+\/upload$/);
    sellerValuationId = valuationIdFrom(seller.url());

    await addPhoto(seller);
    await fillDetails(seller, {
      type: "Ruby",
      carat: "1.2",
      grade: "FINE",
      origin: "Burma",
      treatment: "None",
      lab: "GIA",
      certificate: `M4S-${stamp}`,
    });
    await saveAndContinue(seller);
    await seller.getByRole("button", { name: "Submit for valuation", exact: true }).click();
    await seller.waitForURL(new RegExp(`/valuation/${sellerValuationId}$`));
    await expect(seller.getByRole("heading", { level: 1 })).toHaveText("Valued automatically");
    sellerRef = REFERENCE_RE.exec(await seller.getByText(/Ref\. GSV-/).first().innerText())?.[0] ?? "";
    expect(sellerRef).toMatch(REFERENCE_RE);

    await seller.getByRole("button", { name: "Publish on my listing", exact: true }).click();
    await reloadUntilVisible(seller, seller.getByText("Published on your listing").first());

    await seller.goto(sellerListingPath);
    await expect(seller.getByRole("heading", { name: "Platform indicative valuation" })).toBeVisible();
    await expect(seller.getByRole("link", { name: `Verify ref. ${sellerRef}` })).toBeVisible();
    await expect(seller.getByText(/^Published \d{1,2} \w+ \d{4}$/).first()).toBeVisible();
  });

  // ---------- 1c-2. A key stone change takes the published report off the listing ----------

  test("changing the carat on the listing removes the published valuation and tells the seller", async () => {
    const { Client } = await import("pg");
    await import("dotenv/config");
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const slug = sellerListingPath.split("/").pop() ?? "";
    const listing = await client.query('SELECT id FROM "Gemstone" WHERE slug = $1', [slug]);
    const listingId = listing.rows[0]?.id as string;
    const publishedFlag = async () =>
      (await client.query('SELECT "publishedOnListing" FROM "Valuation" WHERE reference = $1', [sellerRef])).rows[0]?.["publishedOnListing"];
    try {
      expect(await publishedFlag()).toBe(true);

      await seller.goto(`/seller/listings/${listingId}/edit`);
      const carat = seller.getByLabel("Carat weight");
      await carat.fill(String(Number(await carat.inputValue()) + 0.25));
      await seller.getByRole("button", { name: "Save draft", exact: true }).click();

      await expect.poll(publishedFlag, { timeout: 30_000 }).toBe(false);
    } finally {
      await client.end();
    }

    await seller.goto(sellerListingPath);
    await expect(seller.getByText(`Verify ref. ${sellerRef}`)).toHaveCount(0);

    await seller.goto("/notifications");
    await expect(seller.getByText("Valuation removed from your listing").first()).toBeVisible();
  });

  // ---------- 1d. Privacy between the listing seller and a buyer's valuation ----------

  test("the listing seller cannot see the buyer's valuation", async () => {
    // Own requests only on the seller's valuations list. The buyer's reference must not be there.
    await seller.goto("/seller/valuations");
    // The list streams in after the page shell, so wait for the seller's own row before reading the page.
    await expect(seller.getByText(sellerRef).first()).toBeVisible();
    const list = await seller.locator("body").innerText();
    expect(list).not.toContain(buyerRef);

    // A direct request for the buyer's valuation is the not-found page, with none of its details.
    await seller.goto(`/valuation/${buyerValuationId}`);
    await expect(seller.getByText("This page could not be found").first()).toBeVisible();
    const notFound = await seller.locator("body").innerText();
    expect(notFound).not.toContain(buyerRef);
    expect(notFound).not.toContain("₹");

    const pdf = await seller.request.get(`/api/valuation/${buyerValuationId}/pdf`);
    expect(pdf.status()).not.toBe(200);

    // The buyer did not publish, so the listing shows no platform valuation for the buyer's reference.
    await seller.goto(buyerListingPath);
    await expect(seller.getByRole("heading", { level: 1 })).toBeVisible();
    const listingPage = await seller.locator("body").innerText();
    expect(listingPage).not.toContain(buyerRef);
  });

  // ---------- 1e. Seller edits a posted requirement ----------

  test("seller posts a requirement, edits it, and a contact detail in the notes is masked", async () => {
    const type = `M4 Spinel ${stamp}`;
    await seller.goto("/seller/requirements/new");
    await seller.locator('input[name="gemstoneType"]').fill(type);
    await seller.locator('select[name="categoryId"]').selectOption({ label: "Spinel" });
    await seller.locator('input[name="caratMin"]').fill("1");
    await seller.locator('input[name="caratMax"]').fill("2");
    await seller.getByRole("button", { name: "Post requirement", exact: true }).click();
    await seller.waitForURL(/\/seller\/requirements\/mine$/);

    const row = seller.locator("li, tr, article").filter({ hasText: type }).first();
    await expect(row).toBeVisible();
    const editHref = await row.getByRole("link", { name: "Edit", exact: true }).getAttribute("href");
    expect(editHref).toMatch(/\/seller\/requirements\/mine\/[^/]+\/edit$/);
    await seller.goto(editHref ?? "/seller/requirements/mine");

    await seller.locator('[name="caratMax"]').fill("2.5");
    await seller.locator('textarea[name="notes"]').fill(`M4 edit check ${stamp}: eye clean, pink or padparadscha.`);
    await seller.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(seller.getByText("This page could not be found")).toHaveCount(0);
    await expect(async () => {
      await seller.goto(editHref ?? "/seller/requirements/mine");
      await expect(seller.locator('[name="caratMax"]')).toHaveValue("2.5", { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(seller.locator('textarea[name="notes"]')).toHaveValue(new RegExp(`M4 edit check ${stamp}`));

    // A phone number in the notes. Requirements mask contact details (the buyer's edit uses the same rule), so the
    // saved text shows [hidden contact] and never the number. Wait for the save to land before reading it back.
    await seller.locator('textarea[name="notes"]').fill("Call me on 98765 43210 about the stone.");
    await seller.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(async () => {
      await seller.goto(editHref ?? "/seller/requirements/mine");
      await expect(seller.locator('textarea[name="notes"]')).toHaveValue(/\[hidden contact\]/, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(seller.locator('textarea[name="notes"]')).not.toHaveValue(/98765 43210/);
  });

  // ---------- Screenshots ----------

  test("admin reference price table is shown at both widths", async () => {
    await admin.goto("/admin/valuations/prices");
    await expect(admin.getByRole("heading", { name: "Reference prices" })).toBeVisible();
    await shot(admin, "admin-prices");
  });
});
