import "dotenv/config";
import { execSync } from "node:child_process";
import path from "node:path";
import { type APIResponse, type Page, expect, test } from "@playwright/test";
import { serverLog } from "./helpers";

/**
 * M6 content and newsletter journeys: a scheduled education article published by the worker step, the newsletter
 * subscribe / confirm / preferences / unsubscribe flow, an admin test campaign, the legal pages and 404, and a crawl of
 * the header and footer links. Runs serially against the production build (playwright.config.ts starts it on port 3200)
 * with the demo and M6 seeds loaded. Every run uses fresh titles and addresses so repeated runs do not collide.
 */

const REPO = path.join(__dirname, "..");
const stamp = Date.now().toString(36);

const ADMIN_EMAIL = "admin@gemstone.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe-Local-1";
const SUBSCRIBER_EMAIL = `m6-reader-${stamp}@example.test`;
const SCHEDULED_TITLE = `M6 scheduled guide ${stamp}`;

/** Sleep helper for short polls. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/**
 * Email bodies written by the console provider, one segment per message. Each segment starts with
 * "[email:console] to=<address>". Returns only the segments addressed to `to`.
 */
function emailsTo(to: string): string[] {
  return serverLog()
    .split("[email:console] to=")
    .slice(1)
    .filter((segment) => segment.split("\n")[0]?.trim() === to);
}

/** Waits until a new message for `to` appears (count above `before`) and returns its text. */
async function nextEmailTo(to: string, before: number, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = emailsTo(to);
    if (found.length > before) return found[found.length - 1]!;
    await sleep(500);
  }
  throw new Error(`No new email for ${to} within ${timeoutMs}ms`);
}

function tokenFrom(message: string, pathPart: "confirm" | "preferences"): string {
  const match = message.match(new RegExp(`/newsletter/${pathPart}\\?token=([A-Za-z0-9_-]+)`));
  if (!match) throw new Error(`No ${pathPart} link in the email`);
  return match[1]!;
}

/** Local time as the value a datetime-local input expects (YYYY-MM-DDTHH:mm). */
function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Signs up on /newsletter with one topic and consent. Returns once the page shows the generic message. */
async function signUp(page: Page, email: string, topic: RegExp) {
  await page.goto("/newsletter");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("checkbox", { name: topic }).check();
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Sign up" }).click();
}

test.describe.serial("M6 content and newsletter", () => {
  test("a. admin schedules an education article, the worker publishes it, and it appears on /education", async ({ page }) => {
    test.setTimeout(240_000);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Create the draft. The body links to a category page that the seed provides; that link is checked below.
    await page.goto("/admin/content/new");
    await page.getByLabel("Content type").selectOption("EDUCATION");
    await page.getByLabel("Title").fill(SCHEDULED_TITLE);
    await page.getByLabel("Summary").fill("A short scheduled guide written by the M6 end-to-end journey.");
    await page.getByLabel("Content (Markdown)").fill(
      "## Why sapphire\n\nSapphire is a durable corundum. Browse the [sapphire category](/categories/sapphire) for stones.\n",
    );
    await page.getByRole("button", { name: "Create draft" }).click();
    await page.waitForURL(/\/admin\/content\/[^/]+\?saved=1/, { timeout: 20_000 });
    const articleUrl = page.url();

    // Schedule it two minutes ahead, in the browser's local time.
    const when = new Date(Date.now() + 2 * 60_000);
    await page.locator('input[type="datetime-local"]').fill(localInputValue(when));
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    const statusPanel = page.getByRole("region", { name: "Status" });
    await expect(statusPanel).toContainText("Scheduled", { timeout: 20_000 });
    await expect(statusPanel).toContainText("Publishes at");

    // Not visible on the public listing before the worker runs.
    await page.goto("/education");
    await expect(page.getByRole("link", { name: SCHEDULED_TITLE })).toHaveCount(0);

    // Wait for the scheduled time to pass, then run the worker publish step against the same database.
    await sleep(Math.max(0, when.getTime() - Date.now()) + 5_000);
    const output = execSync("npx tsx e2e/helpers/publish-due.ts", { cwd: REPO, env: process.env, encoding: "utf8" });
    expect(output).toMatch(/published \d+ due article/);

    // The article now appears on the public listing and its page links to a category page that exists.
    await page.goto("/education");
    const link = page.getByRole("link", { name: SCHEDULED_TITLE });
    await expect(link.first()).toBeVisible({ timeout: 20_000 });
    await link.first().click();
    await expect(page.getByRole("heading", { level: 1, name: SCHEDULED_TITLE })).toBeVisible();
    const categoryLink = page.getByRole("link", { name: "sapphire category" });
    await expect(categoryLink).toHaveAttribute("href", "/categories/sapphire");
    const categoryHref = (await categoryLink.getAttribute("href")) ?? "/categories/sapphire";
    const categoryResponse: APIResponse = await page.request.get(categoryHref);
    expect(categoryResponse.status()).toBe(200);
    expect(articleUrl).toContain("/admin/content/");
  });

  test("b. newsletter: sign up, confirm, sign up again, change topics, unsubscribe", async ({ page }) => {
    test.setTimeout(240_000);

    // Sign up with one topic. The response is the same generic message whatever the address.
    const beforeSignup = emailsTo(SUBSCRIBER_EMAIL).length;
    await signUp(page, SUBSCRIBER_EMAIL, /^Education/);
    await expect(page.getByText(/we have sent a confirmation link/)).toBeVisible({ timeout: 20_000 });

    // Confirm from the link in the console log.
    const confirmMail = await nextEmailTo(SUBSCRIBER_EMAIL, beforeSignup);
    await page.goto(`/newsletter/confirm?token=${tokenFrom(confirmMail, "confirm")}`);
    await page.getByRole("button", { name: "Confirm my subscription" }).click();
    await expect(page.getByText("You are subscribed. Thank you for confirming.")).toBeVisible({ timeout: 20_000 });

    // Signing up again with a confirmed address sends the already-subscribed mail, which links to preferences.
    const beforeResignup = emailsTo(SUBSCRIBER_EMAIL).length;
    await signUp(page, SUBSCRIBER_EMAIL, /^Education/);
    await expect(page.getByText(/we have sent a confirmation link/)).toBeVisible({ timeout: 20_000 });
    const alreadyMail = await nextEmailTo(SUBSCRIBER_EMAIL, beforeResignup);
    expect(alreadyMail).toContain("You already receive");
    await page.goto(`/newsletter/preferences?token=${tokenFrom(alreadyMail, "preferences")}`);

    // Add a second topic and save. Reloading shows the saved state.
    await expect(page.getByRole("checkbox", { name: /^Education/ })).toBeChecked();
    await page.getByRole("checkbox", { name: /^Market news/ }).check();
    await page.getByRole("button", { name: "Save my topics" }).click();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /^Market news/ })).toBeChecked({ timeout: 20_000 });
    await expect(page.getByRole("checkbox", { name: /^Education/ })).toBeChecked();

    // Unsubscribe from everything. The page confirms the change.
    await page.getByRole("button", { name: "Unsubscribe from everything" }).click();
    await expect(page.getByText(/You have been unsubscribed/)).toBeVisible({ timeout: 20_000 });
  });

  test("c. admin sends a test campaign to themself", async ({ page }) => {
    test.setTimeout(180_000);
    const subject = `M6 test campaign ${stamp}`;
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const before = emailsTo(ADMIN_EMAIL).length;

    await page.goto("/admin/newsletter/campaigns/new");
    await page.getByLabel("Subject", { exact: true }).fill(subject);
    await page.getByRole("checkbox", { name: /^Education/ }).check();
    await page.getByLabel("Body (Markdown)").fill("## Hello\n\nThis is a **test** of the M6 newsletter.\n");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.waitForURL(/\/admin\/newsletter\/campaigns\/[^/]+$/, { timeout: 20_000 });

    const testSection = page.locator("section[aria-labelledby='test-heading']");
    await testSection.getByRole("button", { name: "Send test" }).click();
    await expect(testSection.getByRole("status")).toContainText(/test/i, { timeout: 20_000 });

    const testMail = await nextEmailTo(ADMIN_EMAIL, before);
    expect(testMail).toContain(`subject: ${subject}`);
  });

  test("d. legal pages render as drafts, unknown URLs show the 404 page, old legal URLs redirect", async ({ page }) => {
    for (const path of ["/legal/terms", "/legal/privacy", "/legal/cookies", "/legal/seller-agreement"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.getByText(/Draft\s*[–-]\s*needs legal review/), path).toBeVisible();
    }

    const missing = await page.goto("/this-page-does-not-exist");
    expect(missing?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "We could not find that page" })).toBeVisible();

    await page.goto("/terms");
    await expect(page).toHaveURL(/\/legal\/terms$/);
    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/legal\/privacy$/);
  });

  test("e. every internal header and footer link on the homepage resolves", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/");
    const hrefs = await page.locator("header a[href], footer a[href]").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );
    const internal = [...new Set(hrefs.filter((href) => href.startsWith("/") && !href.startsWith("//")))].sort();
    expect(internal.length).toBeGreaterThan(5);

    const broken: string[] = [];
    for (const href of internal) {
      const response = await page.request.get(href); // follows redirects
      if (response.status() !== 200) broken.push(`${href} -> ${response.status()}`);
    }
    expect(broken, "links that do not return 200").toEqual([]);
  });
});
