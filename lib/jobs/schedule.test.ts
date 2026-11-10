import { describe, expect, it } from "vitest";
import { JOBS, istDayKey, istInstant, isDue, type JobDefinition } from "./schedule";

const interval = (everyMs: number): JobDefinition => ({
  name: "t", lockName: "t", timeoutMs: 1000, schedule: { kind: "interval", everyMs },
});
const daily: JobDefinition = {
  name: "rollup", lockName: "rollup", timeoutMs: 1000, schedule: { kind: "daily-ist", hour: 0, minute: 30 },
};
const at = (iso: string) => new Date(iso);

describe("interval jobs", () => {
  it("is due when it has never run", () => {
    expect(isDue(interval(60_000), undefined, at("2026-01-01T00:00:00Z"))).toBe(true);
  });

  it("is due once the interval has passed, and not before", () => {
    const job = interval(5 * 60_000);
    const last = at("2026-01-01T00:00:00Z");
    expect(isDue(job, last, at("2026-01-01T00:04:59Z"))).toBe(false);
    expect(isDue(job, last, at("2026-01-01T00:05:00Z"))).toBe(true);
  });
});

describe("IST helpers", () => {
  it("00:30 IST is 19:00 UTC the previous day", () => {
    expect(istInstant("2026-03-10", 0, 30).toISOString()).toBe("2026-03-09T19:00:00.000Z");
  });

  it("the IST calendar day rolls over at 18:30 UTC", () => {
    expect(istDayKey(at("2026-03-09T18:29:59Z"))).toBe("2026-03-09");
    expect(istDayKey(at("2026-03-09T18:30:00Z"))).toBe("2026-03-10");
  });
});

describe("daily IST job (00:30 IST)", () => {
  it("is not due before 00:30 IST when it ran at yesterday's 00:30 IST", () => {
    const lastRun = at("2026-03-09T19:00:00Z"); // 00:30 IST on 2026-03-10
    expect(isDue(daily, lastRun, at("2026-03-10T10:00:00Z"))).toBe(false); // 15:30 IST
    expect(isDue(daily, lastRun, at("2026-03-10T18:59:00Z"))).toBe(false); // 00:29 IST on 2026-03-11
  });

  it("is due at 00:30 IST the next day", () => {
    const lastRun = at("2026-03-09T19:00:00Z");
    expect(isDue(daily, lastRun, at("2026-03-10T19:00:00Z"))).toBe(true); // 00:30 IST on 2026-03-11
    expect(isDue(daily, lastRun, at("2026-03-10T19:01:00Z"))).toBe(true);
  });

  it("is not due again after it ran at its 00:30 IST target", () => {
    expect(isDue(daily, at("2026-03-10T19:01:00Z"), at("2026-03-10T19:30:00Z"))).toBe(false);
  });

  it("catches up on a missed run the next time the worker ticks", () => {
    // Worker was down from 00:30 IST until 14:00 IST; last successful run was two days earlier.
    expect(isDue(daily, at("2026-03-08T19:00:00Z"), at("2026-03-10T08:30:00Z"))).toBe(true);
  });

  it("is due on the first tick when it has never run", () => {
    expect(isDue(daily, undefined, at("2026-03-10T08:30:00Z"))).toBe(true);
  });
});

describe("job list", () => {
  it("contains every job the milestone asks for, with unique names and lock names", () => {
    const names = JOBS.map((job) => job.name).sort();
    expect(names).toEqual([
      "analytics-rollup",
      "content-publish",
      "newsletter-campaigns",
      "newsletter-weekly-digest",
      "notify-flush",
      "rate-limit-cleanup",
    ]);
    expect(new Set(JOBS.map((job) => job.lockName)).size).toBe(JOBS.length);
  });

  it("runs notify:flush every 5 minutes and the rollup once a day at 00:30 IST", () => {
    expect(JOBS.find((j) => j.name === "notify-flush")?.schedule).toEqual({ kind: "interval", everyMs: 300_000 });
    expect(JOBS.find((j) => j.name === "analytics-rollup")?.schedule).toEqual({ kind: "daily-ist", hour: 0, minute: 30 });
  });
});
