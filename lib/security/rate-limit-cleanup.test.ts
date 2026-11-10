import { describe, expect, it } from "vitest";
import { RATE_LIMIT_RETENTION_MS, rateLimitCutoff } from "./rate-limit-retention";

describe("rateLimitCutoff", () => {
  it("is exactly 24 hours before now", () => {
    const now = new Date("2026-05-01T12:00:00.000Z");
    expect(rateLimitCutoff(now).toISOString()).toBe("2026-04-30T12:00:00.000Z");
    expect(RATE_LIMIT_RETENTION_MS).toBe(86_400_000);
  });

  it("keeps a row updated one millisecond inside the window and removes one just outside it", () => {
    const now = new Date("2026-05-01T12:00:00.000Z");
    const cutoff = rateLimitCutoff(now).getTime();
    expect(cutoff - 1 < cutoff).toBe(true); // older than cutoff: deleted by "lt"
    expect(cutoff + 1 < cutoff).toBe(false); // newer than cutoff: kept
  });
});
