import "dotenv/config";
import { expect, test } from "@playwright/test";
import { serverLog } from "./helpers";

/**
 * Contact form, logged out. The admin email is written by the console provider to e2e/.server.log, so the test
 * reads the log to confirm delivery. Each test notes the log length before it submits and only looks at what was
 * written afterwards, so earlier runs do not interfere.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@gemstone.local";
const stamp = Date.now().toString(36);
const SENDER_EMAIL = `contact-${stamp}@example.test`;
const SUBJECT = "[Contact form] Buying a stone";
const CLEAN_MESSAGE = "Please tell me whether the blue sapphire listing is still available for viewing.";
const REFUSAL =
  "Please do not include phone numbers, email addresses, links, social media handles or app names in your message. Our team will reply to the email address you give us.";

/** Log text written since `offset`. */
const logSince = (offset: number) => serverLog().slice(offset);

async function fillForm(page: import("@playwright/test").Page, message: string) {
  await page.goto("/contact");
  await page.getByLabel("Your name", { exact: true }).fill("Contact Tester");
  // The footer's newsletter field has the same label, so address the contact form inside <main>.
  await page.getByRole("main").getByLabel("Email address", { exact: true }).fill(SENDER_EMAIL);
  await page.getByLabel("Topic", { exact: true }).selectOption("buying");
  await page.getByLabel("Your message", { exact: true }).fill(message);
}

test.describe("contact form", () => {
  test("a clean message is sent to the admin team and recorded", async ({ page }) => {
    const before = serverLog().length;

    await fillForm(page, CLEAN_MESSAGE);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByRole("main").getByRole("status")).toContainText("Thank you. Your message has been sent to the Gemstone Selections team.");

    // Email is printed after the server action responds, so poll the log for the admin copy.
    const deadline = Date.now() + 20_000;
    let segment = "";
    while (Date.now() < deadline) {
      segment = logSince(before)
        .split("[email:console]")
        .find((part) => part.includes(`to=${ADMIN_EMAIL}`) && part.includes(`Email: ${SENDER_EMAIL}`)) ?? "";
      if (segment) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(segment, "admin email for the contact message").not.toBe("");
    expect(segment).toContain(`subject: ${SUBJECT}`);
    expect(segment).toContain(CLEAN_MESSAGE);
  });

  test("a message with a phone number is refused on the field and nothing is sent", async ({ page }) => {
    await page.goto("/contact");
    const before = serverLog().length;

    await fillForm(page, "Call me on 98765 43210 about the sapphire listing, thanks.");
    await page.getByRole("button", { name: "Send message" }).click();

    const field = page.getByLabel("Your message", { exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("main").getByRole("alert").filter({ hasText: REFUSAL })).toBeVisible();
    // No success message is shown for a refused message.
    await expect(page.getByRole("main").getByText("Thank you. Your message has been sent")).toHaveCount(0);

    // Give a delivery a chance to appear, then confirm that nothing was written for this sender.
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const written = logSince(before);
    expect(written).not.toContain(SUBJECT);
    expect(written).not.toContain(SENDER_EMAIL);
    expect(written).not.toContain("98765 43210");
  });
});
