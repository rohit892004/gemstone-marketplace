import { describe, expect, it } from "vitest";
import { isRestricted, RESTRICTION_DAYS, restrictionUntil } from "./restriction";

const NOW = new Date("2026-11-09T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("restrictionUntil", () => {
  it("is seven days from now when the user has no restriction", () => {
    expect(RESTRICTION_DAYS).toBe(7);
    expect(restrictionUntil(NOW, null).getTime()).toBe(NOW.getTime() + 7 * DAY);
  });

  it("replaces an expired restriction with a fresh seven days", () => {
    const expired = new Date(NOW.getTime() - DAY);
    expect(restrictionUntil(NOW, expired).getTime()).toBe(NOW.getTime() + 7 * DAY);
  });

  it("never shortens a longer restriction", () => {
    const longer = new Date(NOW.getTime() + 30 * DAY);
    expect(restrictionUntil(NOW, longer)).toEqual(longer);
  });

  it("extends a shorter active restriction to seven days", () => {
    const shorter = new Date(NOW.getTime() + 2 * DAY);
    expect(restrictionUntil(NOW, shorter).getTime()).toBe(NOW.getTime() + 7 * DAY);
  });
});

describe("isRestricted", () => {
  it("is true only while the end time is in the future", () => {
    expect(isRestricted(new Date(NOW.getTime() + 1000), NOW)).toBe(true);
    expect(isRestricted(new Date(NOW.getTime() - 1000), NOW)).toBe(false);
    expect(isRestricted(null, NOW)).toBe(false);
    expect(isRestricted(undefined, NOW)).toBe(false);
  });
});
