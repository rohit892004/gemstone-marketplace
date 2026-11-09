import { getEnv } from "@/lib/config/env";

/**
 * Demo data guard. Demo sellers, listings, reviews and ratings are labelled "Demo" in the UI
 * and must never be created in production.
 */

export const DEMO_LABEL = "Demo";

/** Throws when called in production. Call at the start of every demo seed and demo-only write. */
export function assertDemoAllowed(): void {
  if (getEnv().NODE_ENV === "production") {
    throw new Error("Demo data is not allowed in production. Refusing to run.");
  }
}
