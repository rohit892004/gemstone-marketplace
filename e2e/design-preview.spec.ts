import { expect, test } from "@playwright/test";

/** The luxury design preview is a development page only. It must not be served by the production build. */
test("design preview returns 404 in production", async ({ request }) => {
  const response = await request.get("/design-preview/luxury");
  expect(response.status()).toBe(404);
});
