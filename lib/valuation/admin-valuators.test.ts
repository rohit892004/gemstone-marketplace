import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const tx = {
    user: { updateMany: vi.fn(), findUnique: vi.fn(async () => ({ role: "ADMIN", status: "ACTIVE" })) },
    valuation: { updateMany: vi.fn() },
  };
  return {
    tx,
    prisma: {
      ...tx,
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    },
    audit: vi.fn(),
  };
});

vi.mock("@/lib/db/client", () => ({ prisma: h.prisma }));
vi.mock("@/lib/audit/audit", () => ({ recordAudit: h.audit }));

import { setValuatorActive } from "./admin-valuators";

const admin = { id: "admin_1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setValuatorActive", () => {
  it("deactivating releases open requests back to the admin queue, unassigned", async () => {
    h.tx.user.updateMany.mockResolvedValue({ count: 1 });
    h.tx.valuation.updateMany.mockResolvedValue({ count: 3 });

    const result = await setValuatorActive({ admin, valuatorId: "val_1", active: false });

    expect(result).toEqual({ ok: true, value: true });
    expect(h.tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "val_1", role: "VALUATOR", status: "ACTIVE" },
      data: { status: "SUSPENDED" },
    });
    expect(h.tx.valuation.updateMany).toHaveBeenCalledWith({
      where: { assignedValuatorId: "val_1", status: { in: ["IN_EXPERT_REVIEW", "NEEDS_INFO"] } },
      data: { assignedValuatorId: null },
    });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ meta: { releasedRequests: 3 } }));
  });

  it("does not touch completed or rejected valuations when releasing", async () => {
    h.tx.user.updateMany.mockResolvedValue({ count: 1 });
    h.tx.valuation.updateMany.mockResolvedValue({ count: 0 });
    await setValuatorActive({ admin, valuatorId: "val_1", active: false });
    const where = h.tx.valuation.updateMany.mock.calls[0][0].where;
    expect(where.status.in).not.toContain("COMPLETED");
    expect(where.status.in).not.toContain("REJECTED");
  });

  it("reactivating starts the valuer with no assignments and changes no valuation", async () => {
    h.tx.user.updateMany.mockResolvedValue({ count: 1 });
    const result = await setValuatorActive({ admin, valuatorId: "val_1", active: true });
    expect(result).toEqual({ ok: true, value: true });
    expect(h.tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "val_1", role: "VALUATOR", status: "SUSPENDED" },
      data: { status: "ACTIVE" },
    });
    expect(h.tx.valuation.updateMany).not.toHaveBeenCalled();
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "valuator.reactivated" }));
  });

  it("refuses when the valuer is already in that state, and releases nothing", async () => {
    h.tx.user.updateMany.mockResolvedValue({ count: 0 });
    const result = await setValuatorActive({ admin, valuatorId: "val_1", active: false });
    expect(result.ok).toBe(false);
    expect(h.tx.valuation.updateMany).not.toHaveBeenCalled();
    expect(h.audit).not.toHaveBeenCalled();
  });
});
