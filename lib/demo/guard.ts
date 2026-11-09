import { getEnv } from "@/lib/config/env";

/**
 * Demo data guard. Demo sellers, listings, reviews and ratings are labelled "Demo" in the UI
 * and must never be created in production. Two independent checks, both required:
 *   1. NODE_ENV must not be "production".
 *   2. ALLOW_DEMO_SEED must be "true" (explicit opt-in, default off).
 */

export const DEMO_LABEL = "Demo";

export function assertDemoAllowed(): void {
  const { NODE_ENV, ALLOW_DEMO_SEED } = getEnv();
  if (NODE_ENV === "production") {
    throw new Error("Demo data is not allowed in production. Refusing to run.");
  }
  if (ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo data needs ALLOW_DEMO_SEED=true in the environment. Refusing to run.");
  }
}
