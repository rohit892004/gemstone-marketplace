import { expect, test, type Page } from "@playwright/test";

/**
 * Every image on a card page must load as a real image. For each <img> in the DOM we request its src and
 * check for HTTP 200 and an image/* content type. Listing card photos (served from /api/media) must exist
 * on these pages, so a page with no listing photo fails instead of passing vacuously.
 */

const PAGES: { path: string; listingPhotosRequired: boolean }[] = [
  { path: "/", listingPhotosRequired: true },
  { path: "/gemstones", listingPhotosRequired: true },
  { path: "/sellers/himalaya-gem-house", listingPhotosRequired: true },
];

async function imageSources(page: Page): Promise<string[]> {
  return page.$$eval("img", (imgs) =>
    Array.from(new Set(imgs.map((img) => img.getAttribute("src") ?? "").filter((src) => src.length > 0))),
  );
}

test.describe("listing card images", () => {
  for (const { path, listingPhotosRequired } of PAGES) {
    test(`every image on ${path} returns 200 with an image type`, async ({ page }) => {
      await page.goto(path);
      const sources = await imageSources(page);
      expect(sources.length, `${path} renders images`).toBeGreaterThan(0);

      const listingPhotos = sources.filter((src) => src.startsWith("/api/media/"));
      if (listingPhotosRequired) {
        expect(listingPhotos.length, `${path} renders listing photos`).toBeGreaterThan(0);
      }

      const failures: string[] = [];
      for (const src of sources) {
        const response = await page.request.get(src);
        const type = response.headers()["content-type"] ?? "";
        if (response.status() !== 200 || !type.startsWith("image/")) {
          failures.push(`${response.status()} ${type || "no content-type"} ${src}`);
        }
      }
      expect(failures, `images that did not load as images on ${path}`).toEqual([]);
    });
  }

  test("listing card photos on the catalogue are visibly rendered in the browser", async ({ page }) => {
    await page.goto("/gemstones");
    const cards = page.locator('img[src^="/api/media/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    // Lazy images below the fold load on scroll; scroll the list to bring every card into view.
    for (let i = 0; i < count; i++) {
      await cards.nth(i).scrollIntoViewIfNeeded();
    }
    await expect
      .poll(async () => cards.evaluateAll((els) => els.filter((el) => (el as HTMLImageElement).naturalWidth > 0).length), {
        timeout: 15_000,
      })
      .toBe(count);
  });
});
