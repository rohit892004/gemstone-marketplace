import { beforeEach, describe, expect, it, vi } from "vitest";

// Every admin valuation service function must refuse a non-admin actor by itself (no reliance on the caller).
// The role check runs before any other database access, so the prisma mock below only needs user.findUnique.

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: { user: { findUnique: h.findUnique } } }));

import { AuthzError } from "@/lib/auth/authz-error";
import { loadValuationStats } from "./admin-stats";
import { importReferencePriceCsv, saveEditedPrices, saveMultiplierPercents, addMultiplier, savePriceRow } from "./admin-prices";
import { saveThresholdSettings } from "./admin-settings";
import { createValuator, resendSetPasswordLink, setValuatorActive } from "./admin-valuators";

const actor = { id: "user_1" };

type Call = () => Promise<unknown>;

const calls: Array<[string, Call]> = [
  ["loadValuationStats", () => loadValuationStats(actor)],
  ["savePriceRow", () => savePriceRow({ admin: actor, cell: {} as never })],
  ["importReferencePriceCsv", () => importReferencePriceCsv({ admin: actor, text: "" })],
  ["saveMultiplierPercents", () => saveMultiplierPercents({ admin: actor, updates: [] })],
  ["addMultiplier", () => addMultiplier({ admin: actor, kind: "x", key: "x", label: "x", percent: "1" })],
  ["saveEditedPrices", () => saveEditedPrices({ admin: actor, updates: [] })],
  ["saveThresholdSettings", () => saveThresholdSettings({ admin: actor, changes: [] } as never)],
  ["createValuator", () => createValuator({ admin: actor, raw: { name: "", email: "", mobile: "" } })],
  ["resendSetPasswordLink", () => resendSetPasswordLink({ admin: actor, valuatorId: "v" })],
  ["setValuatorActive", () => setValuatorActive({ admin: actor, valuatorId: "v", active: false })],
];

describe("admin valuation services refuse non-admins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const [name, call] of calls) {
    it(`${name} refuses a BUYER, a SELLER, a VALUATOR and a suspended admin`, async () => {
      for (const account of [
        { role: "BUYER", status: "ACTIVE" },
        { role: "SELLER", status: "ACTIVE" },
        { role: "VALUATOR", status: "ACTIVE" },
        { role: "ADMIN", status: "SUSPENDED" },
      ]) {
        h.findUnique.mockResolvedValueOnce(account);
        await expect(call()).rejects.toBeInstanceOf(AuthzError);
      }
      expect(h.findUnique).toHaveBeenCalledTimes(4);
    });

    it(`${name} refuses an unknown actor`, async () => {
      h.findUnique.mockResolvedValueOnce(null);
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  }
});
